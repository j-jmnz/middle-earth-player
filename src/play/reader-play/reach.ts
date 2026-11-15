// The reader parity model (docs/architecture.md, Tests): which intents a screen reader's user can send at one state of a game, through
// the elements the reader's UI labels. It walks the same pure functions the table's choice hook does: the reader table's rows
// (reader-table-rows.ts), a tap on a card or a tray row (pickResult), the dock's buttons (dockFor, readerDock) and its extras, and the
// sheets those open (playSheet through tap, commitSheet, actionsSheet), refusing a payment the pools cannot make (cannotPay) as the hook
// does. Pure: no renderer, no store.
import type { LegalIntent, PlayerIntent, ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import { actionsSheet, commitSheet, windowSheet } from "../choice/bar-sheets.ts";
import { dockExtras } from "../choice/dock/extras.ts";
import { pickResult, listedOnPaper } from "../choice/pick-route.ts";
import { readerDock } from "../choice/reader-moment.ts";
import { sheetFor } from "../choice/sheets.ts";
import type { Sheet, SheetNames } from "../choice/sheet-types.ts";
import { choiceFor, discardPlays, dockFor, onlyAnswer, onTheTable, primaryReady, tappable, type Choice, type Dock, type DockButton, type TapContext } from "../choice/table-choice.ts";
import { listsResponses, trayTiles } from "../choice/tray-logic.ts";
import { cannotPay } from "../choice/why.ts";
import { highlightKeys, highlightOf } from "../canvas/highlight-of.ts";
import { readerRows, type ReaderRowsDeps } from "../canvas/reader-table-rows.ts";
import { slotNumbers } from "../cards/card-effects.ts";
import { cardSpeech, type CardSpeechDeps } from "../words/card-speech.ts";
import { actingSeat, onTableFor } from "../store/selectors.ts";
import { sharesReady } from "../choice/pay.ts";

/** Intents of one family a reader builds by picking: any subset of `allowed` (a commit, an attack), or any shares within `caps` (a payment, archery). */
export type Family = { kind: "ids"; allowed: ReadonlySet<string>; allowEmpty: boolean } | { kind: "shares"; caps: ReadonlyMap<string, number> };

/** An intent a reader can send, and the elements it goes through (`via`, for the failure message). */
export type Reached = { intent: PlayerIntent; via: string; family?: Family };

export type Reach = {
  sent: Reached[];
  // Elements of the path that carry no words (an empty label).
  unlabelled: string[];
  // A card's button leads nowhere: its payment sheet was refused (the pools cannot pay: the table announces the reason, why.ts) or an attachment has no
  // host (the sheet opens and says so). The card, which of the two, and the words.
  refused: { cardId: string | null; kind: "pay" | "host"; text: string }[];
  // A button that goes to the resolution screen (the outcome sheet's), where the scenario's reward is chosen.
  outcome: boolean;
  // The ids a sheet asks about that no reader element reaches (not on the reader table, not a tray row, not a discard pile's list).
  unreached: string[];
};

export type ReachInput = {
  game: ScenarioState;
  ctx: ReduceContext;
  legal: readonly LegalIntent[];
  names: SheetNames;
  // What the reader table's rows read besides the game (reader-table-rows.ts); `playable` and `discover` are set here from the open sheet.
  rows: Omit<ReaderRowsDeps, "playable" | "discover">;
};

type Where = { overlay: boolean; asPanel: boolean; listed: boolean; depth: number; via: string };

const MAX_DEPTH = 5;

/** The sheet the table opens on for this state: the window's own, else the ordinary action window (use-table-choice.ts, `base`). */
export function baseSheet(game: ScenarioState, ctx: ReduceContext, legal: readonly LegalIntent[], names: SheetNames): Sheet {
  return sheetFor(game, ctx, legal, names) ?? windowSheet(game, ctx, legal, names);
}

class Walk {
  readonly out: Reach = { sent: [], unlabelled: [], refused: [], outcome: false, unreached: [] };
  private readonly seat: number;
  private readonly cardIds: ReadonlySet<string>;
  private readonly pileOpens: ReadonlySet<string>;
  private readonly table: TapContext;
  private readonly passLegal: boolean;
  private readonly input: ReachInput;

  constructor(input: ReachInput) {
    this.input = input;
    const { game, ctx, legal, names } = input;
    this.seat = actingSeat(game);
    this.table = { game, ctx, legal, names };
    this.passLegal = legal.some((intent) => intent.type === "Pass");
    // The reader table is drawn for the open sheet; its rows (cards and piles) do not depend on it but for the piles that wear the play mark.
    const sheet = baseSheet(game, ctx, legal, names);
    const highlight = highlightOf(highlightKeys({ game, seat: this.seat, sheet, choice: choiceFor(sheet, null), panel: false }));
    const rows = readerRows(game, this.seat, { ...input.rows, playable: highlight.tappable, discover: 0 });
    const items = rows.flatMap((section) => section.items);
    this.cardIds = new Set(items.flatMap((item) => (item.kind === "card" ? [item.id] : [])));
    this.pileOpens = new Set(items.flatMap((item) => (item.kind === "pile" && item.opens ? [item.id] : [])));
    // Every button of the reader table says something: a card's label (card-speech.ts) and a pile's.
    const deps: CardSpeechDeps = { nameOf: input.rows.nameOf, inactive: () => false, facts: input.rows.facts, info: (at, seat, cardId) => slotNumbers(at, ctx, cardId, seat), highlight, cards: ctx.cards, sheet, peeking: false };
    for (const item of items) {
      if (item.kind === "card") this.label(cardSpeech(game, this.seat, item.id, deps).label, `reader table card ${item.id}`);
      else if (item.kind === "pile") this.label(item.label, `reader table pile ${item.id}`);
    }
  }

  run(): Reach {
    const { game, ctx, legal, names } = this.input;
    this.explore(baseSheet(game, ctx, legal, names), { overlay: false, asPanel: false, listed: false, depth: 0, via: "" });
    return this.out;
  }

  private label(text: string, what: string): void {
    if (text.trim() === "") this.out.unlabelled.push(what);
  }

  private dockOf(sheet: Sheet, choice: Choice, where: Where, panel: boolean, single: boolean): Dock {
    const plain = dockFor(sheet, choice, this.table, { overlay: where.overlay, passLegal: this.passLegal, surface: panel ? "panel" : "table", single, stopPass: null });
    return readerDock(plain, sheet, true);
  }

  // Opens a sheet as the hook's `open` does: a payment the pools cannot make is refused, announced, and not opened.
  private open(next: Sheet, where: Where, via: string, asPanel = false): void {
    const short = cannotPay(this.input.game, this.input.ctx, next);
    if (short) {
      this.out.refused.push({ cardId: next.kind === "distribute" && next.purpose.kind !== "archery" ? next.purpose.cardId : next.kind === "pick" ? (next.about?.[0] ?? null) : null, kind: "pay", text: `${via}: ${short}` });
      return;
    }
    if (where.depth + 1 > MAX_DEPTH) return;
    this.explore(next, { overlay: true, asPanel, listed: false, depth: where.depth + 1, via });
  }

  // The dock's buttons for a choice: each that sends an intent is recorded, each that opens a sheet is walked.
  private press(dock: Dock, where: Where, via: string, family?: Family): void {
    const buttons: DockButton[] = [...(dock.primary && primaryReady(dock) ? [dock.primary] : []), ...dock.secondary];
    for (const button of buttons) {
      const here = `${via}${via ? " → " : ""}${button.label} button`;
      this.label(button.label, here);
      const action = button.action;
      const attached = button === dock.primary ? family : undefined;
      if (action.kind === "intent" || action.kind === "alwaysUse") this.out.sent.push({ intent: action.intent, via: here, ...(attached ? { family: attached } : {}) });
      else if (action.kind === "passToStop") this.out.sent.push({ intent: { type: "Pass" }, via: here });
      else if (action.kind === "open") this.open(action.sheet, where, here);
      else if (action.kind === "outcome") this.out.outcome = true;
    }
  }

  private explore(sheet: Sheet, where: Where): void {
    const { game, ctx, legal, names } = this.input;
    const reader = true;
    // An attachment no card can take: the sheet opens with nothing to pick and says so.
    if (sheet.kind === "pick" && sheet.options.length === 0 && !sheet.primary && !sheet.alternative && sheet.about?.[0]) this.out.refused.push({ cardId: sheet.about[0], kind: "host", text: `${where.via}: ${sheet.note ?? sheet.title}` });
    const asked = listedOnPaper(where.asPanel || where.listed, listsResponses(sheet, game.window?.kind), reader, sheet.kind, tappable(sheet).size, sheet.kind === "pick" && sheet.look != null);
    const onTable = onTableFor(game, this.seat, new Set());
    const panel = asked || !onTheTable(sheet, onTable);
    const only = onlyAnswer(sheet, legal);
    const single = only != null;
    const start = choiceFor(sheet, null, only);
    const dock0 = this.dockOf(sheet, start, where, panel, single);
    const tiles = panel ? trayTiles(sheet).filter((tile) => tile.look == null) : [];
    const rowIds = new Set(tiles.map((tile) => tile.id));
    for (const tile of tiles) this.label(tile.label, `${where.via} → row ${tile.id}`);
    const discard = new Set(discardPlays(game, this.seat, sheet));
    const reachableBy = (id: string): string | null => {
      if (this.cardIds.has(id)) return `card ${id}`;
      if (rowIds.has(id)) return `row ${id}`;
      if (discard.has(id) && this.pileOpens.has("pile:discard")) return `discard pile list ${id}`;
      return null;
    };
    const ids = [...new Set([...tappable(sheet), ...rowIds])];
    const reached = ids.flatMap((id) => {
      const by = reachableBy(id);
      if (by) return [{ id, by }];
      this.out.unreached.push(`${sheet.kind} ${sheet.key}: ${id}`);
      return [];
    });
    const family = this.familyOf(sheet, reached.map((entry) => entry.id));
    const base = `${where.via}${where.via ? " → " : ""}${sheet.kind} "${sheet.title}"`;
    this.press(dock0, where, base, family);

    // Each pick on its own, from the sheet's start.
    let running: Choice = start;
    for (const { id, by } of reached) {
      const via = `${base} → ${by}`;
      const alone = pickResult(sheet, start, id, this.table, dock0);
      this.followPick(sheet, alone, dock0, where, panel, single, via, family);
      // And the picks added one after another (a commit of several characters, a payment shared among heroes).
      if (sheet.kind === "multi" || sheet.kind === "window" || sheet.kind === "distribute" || sheet.kind === "trigger") {
        const next = pickResult(sheet, running, id, this.table, this.dockOf(sheet, running, where, panel, single));
        if (next.kind === "choice") {
          running = next.choice;
          this.press(this.dockOf(sheet, running, where, panel, single), where, `${via} (with the picks before it)`, family);
        }
      }
      if (sheet.kind === "distribute") this.fill(sheet, id, where, panel, single, `${via} (until the payment is met)`, family);
    }

    // The dock's quiet buttons: Actions (n) and List open sheets of their own.
    const extras = dockExtras({
      sheet,
      undoButton: null,
      panel,
      panelOpen: panel,
      onRead: () => undefined,
      onList: () => {
        if (!where.listed && where.depth + 1 <= MAX_DEPTH) this.explore(sheet, { ...where, listed: true, depth: where.depth + 1 });
      },
      onCommit: () => this.open(commitSheet(game, ctx, names), where, `${base} → List button`, true),
      onActions: () => this.open(actionsSheet(game, ctx, legal, names), where, `${base} → Actions button`, true),
      onChoose: () => undefined,
    });
    for (const extra of extras) {
      this.label(extra.accessibilityLabel ?? extra.label, `${base} → ${extra.testID}`);
      extra.onPress();
    }
  }

  // The result of a pick: the choice it makes is a dock to press, a sheet it opens is walked, a lone answer is sent by the card itself.
  private followPick(sheet: Sheet, result: ReturnType<typeof pickResult>, dock: Dock, where: Where, panel: boolean, single: boolean, via: string, family: Family | undefined): void {
    if (result.kind === "primary") {
      const action = dock.primary?.action;
      if (action?.kind === "intent") this.out.sent.push({ intent: action.intent, via: `${via} (the only answer)` });
      return;
    }
    if (result.kind === "choice") this.press(this.dockOf(sheet, result.choice, where, panel, single), where, via, family);
    else if (result.kind === "open") this.open(result.sheet, where, via);
  }

  // A payment shared among the heroes: pick one hero until the total is met, so a hero that cannot pay alone is still one row.
  private fill(sheet: Sheet, id: string, where: Where, panel: boolean, single: boolean, via: string, family: Family | undefined): void {
    if (sheet.kind !== "distribute") return;
    let choice: Choice = { key: sheet.key, ids: [], shares: [] };
    for (let step = 0; step <= sheet.total + 1; step += 1) {
      const result = pickResult(sheet, choice, id, this.table, this.dockOf(sheet, choice, where, panel, single));
      if (result.kind !== "choice") return;
      choice = result.choice;
      if (sharesReady(choice.shares, sheet.total, sheet.exact)) break;
    }
    this.press(this.dockOf(sheet, choice, where, panel, single), where, via, family);
  }

  private familyOf(sheet: Sheet, ids: readonly string[]): Family | undefined {
    if (sheet.kind === "multi") return { kind: "ids", allowed: new Set(ids), allowEmpty: sheet.allowEmpty };
    if (sheet.kind === "window" && sheet.commit) return { kind: "ids", allowed: new Set(ids.filter((id) => sheet.commit?.options.some((item) => item.id === id))), allowEmpty: false };
    if (sheet.kind === "distribute") return { kind: "shares", caps: new Map(sheet.options.filter((item) => ids.includes(item.id)).map((item) => [item.id, item.max])) };
    return undefined;
  }
}

/** Every intent a reader can send at this state, and what in the reader's UI is wrong on the way (an unlabelled element, a refused sheet). */
export function readerReach(input: ReachInput): Reach {
  return new Walk(input).run();
}
