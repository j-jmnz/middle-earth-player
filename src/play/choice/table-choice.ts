// Rules: rr.action-windows, rr.step-3-1, rr.travel, rr.optional-engagement, rr.step-6-4-3, rr.step-6-8-1, mec109.archery
// (data/rules/entries.json).
//
// How the player answers the open moment on the table. A sheet (sheets.ts, bar-sheets.ts) says what the rules allow; this
// file says what a tap on a card does with it and which buttons confirm it. A tap only picks: it never sends an intent.
// Every intent goes out from a button, and a button that sends one without anything picked first (Pass, Keep, Leave
// undefended, Do not travel) must be tapped twice: once to arm it, once to confirm (docs/design-system-table.md). The one
// exception is a moment with a single answer (`onlyAnswer`): there is no decision to take back, so its answer is picked
// already and one tap, on the card or the button, sends it.
//
// When every choice of a sheet is a card drawn whole on the table, the cards are picked on the canvas and the dock beside the
// table holds the buttons. Otherwise (an either/or of an effect, a seat, a card out of play, an attachment that only peeks
// out under its host) the sheet opens as a paper panel whose tiles are picked the same way. The numbers beside the choice
// are readout.ts.
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import { cardTriggerSheet, distributeIntent, multiIntent, paySheet, playSheet, sheetSendsPass } from "./bar-sheets.ts";
import type { CombatMark } from "../layout/layout.ts";
import { firstShares, shareOf, sharesReady, tapShare, type Share } from "./pay.ts";
import type { LegalIntent } from "../store/store.ts";
import type { Sheet, SheetNames, SheetStat } from "./sheet-types.ts";
import { fortitudeCommitCaution } from "../readouts/fortitude.ts";

/** What the player has picked for the open sheet. `key` is the sheet's: a new sheet starts a new choice. */
export type Choice = { key: string; ids: readonly string[]; shares: readonly Share[] };

/**
 * The choice a sheet starts with: the characters already put toward a commit, the first guess of a payment, or the one
 * ability of a card the player tapped to use.
 */
export function startChoice(sheet: Sheet): Choice {
  const none: Choice = { key: sheet.key, ids: [], shares: [] };
  if (sheet.kind === "multi") return { ...none, ids: sheet.preselected.filter((id) => sheet.options.some((item) => item.id === id)) };
  if (sheet.kind === "distribute" && sheet.purpose.kind !== "archery") return { ...none, shares: firstShares(poolsOf(sheet)) };
  if (sheet.kind === "trigger" && sheet.preselect) return { ...none, ids: [sheet.preselect] };
  return none;
}

/**
 * The choice for this sheet: the one held if it is the sheet's, else the moment's only answer when it has one
 * (`onlyAnswer`), else a fresh one.
 */
export function choiceFor(sheet: Sheet, held: Choice | null, only: Choice | null = null): Choice {
  if (held && held.key === sheet.key) return held;
  return only ?? startChoice(sheet);
}

function poolsOf(sheet: Extract<Sheet, { kind: "distribute" }>) {
  return { total: sheet.total, exact: sheet.exact, pools: sheet.options.map((item) => ({ heroId: item.id, max: item.max })), ...(sheet.distinct ? { distinct: sheet.distinct } : {}) };
}

// The ways a fixed total can be shared: none when the cards cannot take it all, one when a single card takes it or every
// card must give all it can, more otherwise (and always more for a total that need not be met).
function shareWays(sheet: Extract<Sheet, { kind: "distribute" }>): "none" | "one" | "more" {
  if (!sheet.exact) return "more";
  const room = sheet.options.reduce((sum, item) => sum + item.max, 0);
  if (room < sheet.total) return "none";
  return sheet.options.length === 1 || room === sheet.total ? "one" : "more";
}

/**
 * The moment's only answer, when it has exactly one (user request, 2026-10-25: one tap when there is only one legal
 * choice): the choice it starts from, with the card picked or the shares given, or no pick for a lone button (Pass,
 * Continue, Leave undefended). Null when there is more than one answer, or none. The engine's list must hold a single
 * intent as well, so an Action event the sheet does not show, or the Pass behind a sheet opened from the table, keeps the
 * moment a decision.
 */
export function onlyAnswer(sheet: Sheet, legal: readonly LegalIntent[]): Choice | null {
  if (legal.length !== 1) return null;
  const none: Choice = { key: sheet.key, ids: [], shares: [] };
  const lone = (ids: readonly string[], buttons: number): Choice | null => (ids.length + buttons !== 1 ? null : { ...none, ids: ids.slice(0, 1) });
  switch (sheet.kind) {
    case "pick":
      return lone(
        sheet.options.map((item) => item.id),
        (sheet.primary ? 1 : 0) + (sheet.alternative ? 1 : 0),
      );
    case "multi":
      if (sheet.alternative) return null;
      if (sheet.options.length === 0) return sheet.allowEmpty ? none : null;
      return !sheet.allowEmpty ? lone(
        sheet.options.map((item) => item.id),
        0,
      ) : null;
    case "distribute":
      return shareWays(sheet) === "one" ? { ...none, shares: firstShares(poolsOf(sheet)) } : null;
    case "trigger":
      return lone(
        sheet.options.map((item) => item.id),
        sheet.pass ? 1 : 0,
      );
    case "window":
      return (sheet.commit?.options.length ?? 0) + sheet.plays.length + sheet.triggers.length === 0 ? none : null;
    case "outcome":
      return null;
  }
}

// What the table needs to open the sheets a tap leads to.
export type TapContext = { game: ScenarioState; ctx: ReduceContext; legal: readonly LegalIntent[]; names: SheetNames };

/** The cards of the seat's discard pile the open window lets it play (Elven-light, 10145:A:1): its pile glows and its list plays them. */
export function discardPlays(game: ScenarioState, seat: number, sheet: Sheet): readonly string[] {
  if (sheet.kind !== "window") return [];
  return sheet.plays.filter((id) => game.cards[id]?.zone === "discard" && game.cards[id]?.controller === seat);
}

/** The cards a tap does something with while this sheet is open: they glow on the table. */
export function tappable(sheet: Sheet): ReadonlySet<string> {
  switch (sheet.kind) {
    case "pick":
    case "multi":
    case "distribute":
      return new Set(sheet.options.map((item) => item.id));
    case "trigger":
      return new Set(sheet.options.map((item) => item.cardId));
    case "window":
      return new Set([...(sheet.commit?.options.map((item) => item.id) ?? []), ...sheet.plays, ...sheet.triggers.map((item) => item.cardId)]);
    case "outcome":
      return new Set();
  }
}

export type TapResult = { kind: "choice"; choice: Choice } | { kind: "open"; sheet: Sheet } | { kind: "none" };

function toggle(ids: readonly string[], id: string): readonly string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

/**
 * What a tap on a card (or on its tile in a panel) does: it picks or unpicks it, adds one to its share, or opens the sheet
 * that card leads to (a host for an attachment, the attackers of an enemy, the payment of a card). Never an intent. A trigger
 * tile names its ability (`cardId|effectId`); a tap on the card moves through its abilities.
 */
export function tap(sheet: Sheet, held: Choice | null, id: string, table: TapContext): TapResult {
  const choice = choiceFor(sheet, held);
  switch (sheet.kind) {
    case "pick": {
      const item = sheet.options.find((candidate) => candidate.id === id);
      if (!item) return { kind: "none" };
      // Choosing an enemy to attack, or a host for an attachment, is not a decision yet: it opens the next question.
      if ("next" in item) return { kind: "open", sheet: item.next };
      return { kind: "choice", choice: { ...choice, ids: choice.ids[0] === id ? [] : [id] } };
    }
    case "multi":
      if (!sheet.options.some((item) => item.id === id)) return { kind: "none" };
      return { kind: "choice", choice: { ...choice, ids: toggle(choice.ids, id) } };
    case "distribute": {
      const item = sheet.options.find((candidate) => candidate.id === id);
      if (!item) return { kind: "none" };
      return { kind: "choice", choice: { ...choice, shares: tapShare(choice.shares, id, item.max, sheet.exact ? sheet.total : null) } };
    }
    case "trigger": {
      if (sheet.options.some((item) => item.id === id)) return { kind: "choice", choice: { ...choice, ids: [id] } };
      const options = sheet.options.filter((item) => item.cardId === id);
      if (options.length === 0) return { kind: "none" };
      const at = options.findIndex((item) => item.id === choice.ids[0]);
      const next = options[(at + 1) % options.length];
      return { kind: "choice", choice: { ...choice, ids: next ? [next.id] : [] } };
    }
    case "window": {
      if (sheet.commit?.options.some((item) => item.id === id)) return { kind: "choice", choice: { ...choice, ids: toggle(choice.ids, id) } };
      if (sheet.plays.includes(id)) {
        const opened = playSheet(table.game, table.ctx, table.legal, table.names, id);
        return opened ? { kind: "open", sheet: opened } : { kind: "none" };
      }
      const use = cardTriggerSheet(table.game, table.names, sheet.triggers, id);
      return use ? { kind: "open", sheet: use } : { kind: "none" };
    }
    case "outcome":
      return { kind: "none" };
  }
}

/** How a card the sheet names is marked on the table: picked, given a share (with the amount), or only choosable. */
export function marked(sheet: Sheet, choice: Choice): ReadonlyMap<string, number> {
  const marks = new Map<string, number>();
  if (sheet.kind === "distribute") {
    for (const share of choice.shares) if (share.amount > 0) marks.set(share.id, share.amount);
    return marks;
  }
  if (sheet.kind === "trigger") {
    for (const id of choice.ids) {
      const item = sheet.options.find((option) => option.id === id);
      if (item) marks.set(item.cardId, 1);
    }
    return marks;
  }
  for (const id of choice.ids) marks.set(id, 1);
  return marks;
}

/** The share a distribute sheet has given a card, for a panel tile. */
export function shareFor(sheet: Sheet, choice: Choice, cardId: string): number {
  return sheet.kind === "distribute" ? shareOf(choice.shares, cardId) : 0;
}

/**
 * The fight the pick would make, drawn on the table before it is confirmed: the defender picked beside the attacking enemy,
 * the hero an undefended attack would hit, or the attackers picked against an enemy.
 */
export function fightPreview(game: ScenarioState, sheet: Sheet, choice: Choice): { enemyId: string; ids: readonly string[]; kind: CombatMark["kind"] } | null {
  if (sheet.kind === "multi" && sheet.build.kind === "attack") return choice.ids.length > 0 ? { enemyId: sheet.build.enemyId, ids: choice.ids, kind: "attack" } : null;
  const enemyId = game.pendingAttack?.enemyId;
  if (sheet.kind !== "pick" || !enemyId) return null;
  // No defender to pick: the hero Leave undefended names already stands beside the enemy.
  const leave = sheet.alternative && "intent" in sheet.alternative && sheet.alternative.intent.type === "Undefended" ? sheet.alternative.intent.heroId : undefined;
  if (!choice.ids[0]) return leave && sheet.options.length === 0 ? { enemyId, ids: [leave], kind: "undefended" } : null;
  const item = sheet.options.find((option) => option.id === choice.ids[0]);
  if (!item || !("intent" in item)) return null;
  if (item.intent.type === "DeclareDefender") return { enemyId, ids: [item.id], kind: "defense" };
  if (item.intent.type === "Undefended") return { enemyId, ids: [item.id], kind: "undefended" };
  return null;
}

export type DockAction =
  | { kind: "intent"; intent: PlayerIntent }
  // Pass this window and every step window up to the next stop (stops.ts).
  | { kind: "passToStop" }
  // Set this free Response to Always, and use it now (stops.ts).
  | { kind: "alwaysUse"; effectId: string; intent: PlayerIntent }
  | { kind: "open"; sheet: Sheet }
  // The scenario is over: the resolution screen.
  | { kind: "outcome" }
  // Put the picks back: nothing is sent.
  | { kind: "clear" }
  // Close a sheet the player opened (a payment, a host): nothing is sent.
  | { kind: "close" };

// `arm`: the button sends an intent with nothing picked first, so the first tap only arms it, and `armed` is the caption the
// button shows under it while armed (what the second tap does). `reach` marks an answer that goes past one window, drawn in gold
// (docs/design-system-table.md, Two taps): "phase" ends the player's phase (End planning), "run" passes up to the next stop.
export type DockReach = "phase" | "run";
export type DockButton = { label: string; action: DockAction; arm: boolean; armed?: string; testID: string; reach?: DockReach };

export type Dock = {
  // The one filled button, always in the same place: the confirm of what is picked, or (with nothing picked) Pass,
  // Continue, Done or Keep.
  primary: DockButton | null;
  // Why the primary is not ready yet, or null.
  why: string | null;
  secondary: readonly DockButton[];
  // The moment has one answer: the primary sends it on one tap, and so does a tap on its card.
  single: boolean;
};

// The name in a tile's label, without the numbers a tile adds.
function short(label: string): string {
  return label.split(" · ")[0] ?? label;
}

function alternativeButton(alternative: NonNullable<Extract<Sheet, { kind: "pick" | "multi" }>["alternative"]>): DockButton {
  return {
    label: alternative.label,
    action: "intent" in alternative ? { kind: "intent", intent: alternative.intent } : { kind: "open", sheet: alternative.next },
    arm: "intent" in alternative,
    ...("intent" in alternative && alternative.caution ? { armed: alternative.caution } : {}),
    testID: "sheet-alternative",
  };
}

const PASS = (label: string, testID: string, armed: string): DockButton => ({ label, action: { kind: "intent", intent: { type: "Pass" } }, arm: true, armed, testID });

// The verb on a pick's primary: the card picked is named on the line above it, so the pill stays short.
function verbOf(verb: string): string {
  return verb.split(" ")[0] ?? verb;
}

/**
 * The buttons that answer the sheet. `overlay` is true for a sheet the player opened from the table (a payment, a host, an
 * Action), which gets a Cancel that sends nothing. `passLegal` adds Pass when the rules allow it and the sheet has none.
 * `surface` words the sentence under a primary that waits for a pick. `single` (the moment has one answer) arms nothing.
 */
export function dockFor(
  sheet: Sheet,
  choice: Choice,
  table: TapContext,
  options: {
    overlay: boolean;
    passLegal: boolean;
    surface: "table" | "panel";
    single?: boolean;
    // The armed line of "Pass to next stop", when this window can be passed that way (stops.ts).
    stopPass?: string | null;
    // The free Responses the player may set to Always (stops.ts, isFreeResponse).
    free?: ReadonlySet<string>;
  },
): Dock {
  const secondary: DockButton[] = [];
  let primary: DockButton | null = null;
  let why: string | null = null;
  const pickWords = options.surface === "panel" ? "Choose one above." : "Tap a glowing card.";
  switch (sheet.kind) {
    case "pick": {
      if (sheet.primary) {
        const armed = sheet.caution ?? (sheet.primary.intent.type === "Pass" ? "Tap again to close it" : `Tap again to ${sheet.primary.label.toLowerCase()}`);
        primary = { label: sheet.primary.label, action: { kind: "intent", intent: sheet.primary.intent }, arm: !sheet.selectionMade || sheet.caution != null, armed, testID: "sheet-primary" };
      } else if (sheet.options.length > 0) {
        const item = sheet.options.find((option) => option.id === choice.ids[0]) ?? null;
        const label = sheet.confirm ?? verbOf(sheet.verb);
        const action: DockAction = !item ? { kind: "clear" } : "intent" in item ? { kind: "intent", intent: item.intent } : { kind: "open", sheet: item.next };
        // A pick whose result the player may not expect (the game lost, resources spent for nothing) asks twice.
        const caution = action.kind === "intent" ? (item?.caution ?? sheet.caution) : undefined;
        primary = caution ? { label, action, arm: true, armed: caution, testID: "sheet-primary" } : { label, action, arm: false, testID: "sheet-primary" };
        if (!item) why = options.surface === "panel" ? pickWords : "Tap a glowing card to choose it.";
      }
      // With nothing to pick (no defender is ready, no location to travel to), the alternative is the one filled button.
      if (sheet.alternative && !primary) primary = { ...alternativeButton(sheet.alternative), testID: "sheet-alternative" };
      else if (sheet.alternative) secondary.push(alternativeButton(sheet.alternative));
      break;
    }
    case "multi": {
      const count = choice.ids.length;
      const label = count === 0 && sheet.allowEmpty ? `${sheet.verb} no one` : `${sheet.verb} ${count}`;
      // A Fortitude commit that cannot pass names the failure it makes certain; no one committed is armed either way.
      const failing = sheet.fortitude ? fortitudeCommitCaution(sheet.fortitude, choice.ids) : null;
      primary = { label, action: { kind: "intent", intent: multiIntent(sheet, choice.ids) }, arm: count === 0 || failing != null, armed: failing ?? "Tap again: nobody is committed", testID: "sheet-primary" };
      if (!sheet.allowEmpty && count === 0) why = sheet.options.length === 0 ? "No character can be chosen." : options.surface === "panel" ? "Choose at least one above." : "Tap at least one glowing card.";
      if (sheet.alternative) secondary.push(alternativeButton(sheet.alternative));
      break;
    }
    case "distribute": {
      const purpose = sheet.purpose;
      const label = purpose.kind === "archery" ? "Assign" : purpose.kind === "play" ? "Play" : "Use";
      const action: DockAction = { kind: "intent", intent: distributeIntent(sheet, choice.shares) };
      primary = sheet.caution ? { label, action, arm: true, armed: sheet.caution, testID: "sheet-primary" } : { label, action, arm: false, testID: "sheet-primary" };
      if (!sharesReady(choice.shares, sheet.total, sheet.exact)) why = sheet.options.length === 0 ? "Nothing can pay this." : `Assign all ${sheet.total} first.`;
      if (choice.shares.length > 0) secondary.push({ label: "Clear", action: { kind: "clear" }, arm: false, testID: "sheet-clear" });
      break;
    }
    case "trigger": {
      const item = sheet.options.find((option) => option.id === choice.ids[0]) ?? null;
      if (item) {
        const intent: PlayerIntent = { type: "Trigger", cardId: item.cardId, effectId: item.effectId };
        const action: DockAction = item.pay ? { kind: "open", sheet: paySheet(table.game, table.names, item.pay, { kind: "trigger", cardId: item.cardId, effectId: item.effectId }) } : { kind: "intent", intent };
        // An ability that can lose the game asks twice, with the loss named (item.caution).
        primary = item.caution ? { label: "Use", action, arm: true, armed: item.caution, testID: "sheet-primary" } : { label: "Use", action, arm: false, testID: "sheet-primary" };
        if (sheet.pass) secondary.push(PASS(sheet.pass, "sheet-pass", sheet.passCaution ?? `Tap again: ${sheet.pass.toLowerCase()} without it`));
        // A free Response may be set to Always: the table then uses it whenever it is offered (a standing answer).
        if (!item.pay && !item.caution && options.free?.has(item.effectId)) secondary.push({ label: "Always use", action: { kind: "alwaysUse", effectId: item.effectId, intent }, arm: true, armed: "Tap again: use it now and every time", testID: "sheet-always" });
      } else if (sheet.pass) {
        // Nothing picked: the window's own Pass is the one filled button, in the same place.
        primary = PASS(sheet.pass, "sheet-pass", sheet.passCaution ?? "Tap again: nothing is used");
      } else if (sheet.options.length > 0) {
        primary = { label: "Use", action: { kind: "clear" }, arm: false, testID: "sheet-primary" };
        why = pickWords;
      }
      break;
    }
    case "window": {
      const count = choice.ids.length;
      if (sheet.commit && count > 0) {
        primary = { label: `Commit ${count}`, action: { kind: "intent", intent: { type: "Commit", cardIds: [...choice.ids] } }, arm: false, testID: "table-commit" };
      } else if (sheet.mustCommit != null) {
        // A hero must commit (A Fell Dread): Pass is not legal, so the primary waits for a pick and says who.
        primary = { label: "Commit", action: { kind: "clear" }, arm: false, testID: "table-commit" };
        why = sheet.mustCommit;
      } else if (sheet.pass != null && sheet.armed != null) {
        // Nothing picked: Pass is the filled button. In the commit window it sends no one on the quest.
        // In planning it ends the player's phase, so it is the gold End planning.
        const pass = PASS(sheet.pass, "table-pass", sheet.armed);
        primary = sheet.passReach ? { ...pass, reach: sheet.passReach } : pass;
      }
      if (options.stopPass && count === 0) secondary.push({ label: "Pass to stop", action: { kind: "passToStop" }, arm: true, armed: options.stopPass, testID: "table-pass-to-stop", reach: "run" });
      break;
    }
    case "outcome":
      primary = { label: sheet.action, action: { kind: "outcome" }, arm: false, testID: "sheet-outcome" };
      break;
  }
  if (options.passLegal && !sheetSendsPass(sheet) && !options.overlay) secondary.push(PASS("Pass", "sheet-pass-window", "Tap again to pass"));
  if (options.overlay) secondary.push({ label: "Cancel", action: { kind: "close" }, arm: false, testID: "sheet-cancel" });
  const single = options.single ?? false;
  if (!single) return { primary, why, secondary, single };
  const once = (button: DockButton): DockButton => ({ ...button, arm: false });
  return { primary: primary ? once(primary) : null, why, secondary: secondary.map(once), single };
}

/** True when the dock's primary can be pressed now. */
export function primaryReady(dock: Dock): boolean {
  return dock.primary != null && dock.why == null && dock.primary.action.kind !== "clear";
}

/**
 * True when the sheet is answered on the table: every card it asks about is drawn there whole (`onTable`), or it asks about
 * no card at all. Otherwise it opens as a paper panel.
 */
export function onTheTable(sheet: Sheet, onTable: (cardId: string) => boolean): boolean {
  switch (sheet.kind) {
    case "pick":
    case "multi":
    case "distribute":
      return sheet.options.every((item) => onTable(item.id));
    case "trigger":
      return sheet.options.every((item) => onTable(item.cardId));
    case "window":
    case "outcome":
      return true;
  }
}

/**
 * The words over a sheet, in the dock or on a panel: the step (with the timing of a Response or an Action, and the seat in
 * two-handed play), the moment, a sentence, and the engine's numbers for it.
 */
export function headerOf(sheet: Sheet, game: ScenarioState): { step: string; lead: string; title: string; note: string | null; stats: readonly SheetStat[] } {
  // What leads the dock's title: the seat that is asked in two-handed play ("Player 1 · "), and for a Response or an Action the timing, since the
  // step overline is not drawn ("Response · Pathless Country"). The step names both for a screen reader too.
  const seat = game.seatCount > 1 ? `Player ${game.activeSeat + 1} · ` : "";
  switch (sheet.kind) {
    case "pick":
    case "multi":
      return { step: `${seat}${sheet.step}`, lead: seat, title: sheet.title, note: sheet.note, stats: sheet.stats ?? [] };
    case "distribute":
      return { step: `${seat}${sheet.step}`, lead: seat, title: sheet.title, note: sheet.note, stats: [] };
    case "trigger": {
      // A title that already says the timing ("Response") is not led by it twice.
      const timing = sheet.title.startsWith(sheet.timing) ? "" : `${sheet.timing} · `;
      return { step: `${seat}${sheet.timing} · ${sheet.step}`, lead: seat + timing, title: sheet.title, note: sheet.note, stats: [] };
    }
    case "window":
      return { step: `${seat}${sheet.step}`, lead: seat, title: sheet.title, note: sheet.note, stats: [] };
    case "outcome":
      return { step: sheet.step, lead: "", title: sheet.title, note: sheet.note, stats: [] };
  }
}

/** The cards picked so far, in words, for the line above the primary: a trigger's ability is its printed line. */
export function pickedWords(sheet: Sheet, choice: Choice, names: SheetNames): string | null {
  if (sheet.kind === "trigger") {
    const item = sheet.options.find((option) => option.id === choice.ids[0]);
    return item ? `${short(item.label)}: ${item.text ?? item.timing}` : null;
  }
  if (sheet.kind === "pick") {
    const item = sheet.options.find((option) => option.id === choice.ids[0]);
    return item ? short(item.label) : null;
  }
  return choice.ids.length > 0 ? choice.ids.map((id) => names.card(id)).join(", ") : null;
}
