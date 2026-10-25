// Rules: rr.action-windows, rr.step-3-1, rr.travel, rr.optional-engagement, rr.step-6-4-3, rr.step-6-8-1, mec109.archery
// (data/rules/entries.json).
//
// How the player answers the open moment on the table. A sheet (sheets.ts, bar-sheets.ts) says what the rules allow; this
// file says what a tap on a card does with it and which buttons confirm it. A tap only picks: it never sends an intent.
// Every intent goes out from a button, and a button that sends one without anything picked first (Pass, Keep, Leave
// undefended, Do not travel) must be tapped twice: once to arm it, once to confirm (docs/design-system.md, Table).
//
// When every choice of a sheet is a card on the table, the cards are picked on the canvas and the dock beside the table holds
// the buttons. Otherwise (an either/or of an effect, a seat, a card out of play) the sheet opens as a paper panel whose tiles
// are picked the same way.
import { hideWillpower } from "../rules/hide.ts";
import { modifiedStat } from "../rules/keywords.ts";
import { committedWillpower, stagingThreat } from "../rules/quest.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../rules/reduce.ts";

import { cardTriggerSheet, distributeIntent, multiIntent, paySheet, playSheet } from "./bar-sheets.ts";
import { firstShares, shareOf, shareSum, sharesReady, tapShare, type Share } from "./pay.ts";
import type { LegalIntent } from "./store.ts";
import type { Sheet, SheetNames, SheetStat } from "./sheet-types.ts";

/** What the player has picked for the open sheet. `key` is the sheet's: a new sheet starts a new choice. */
export type Choice = { key: string; ids: readonly string[]; shares: readonly Share[] };

/** The choice a sheet starts with: the characters already put toward a commit, or the first guess of a payment. */
export function startChoice(sheet: Sheet): Choice {
  if (sheet.kind === "multi") return { key: sheet.key, ids: sheet.preselected.filter((id) => sheet.options.some((item) => item.id === id)), shares: [] };
  if (sheet.kind === "distribute" && sheet.purpose.kind !== "archery") {
    return { key: sheet.key, ids: [], shares: firstShares({ seat: 0, cardId: "", total: sheet.total, exact: sheet.exact, pools: sheet.options.map((item) => ({ heroId: item.id, max: item.max })) }) };
  }
  return { key: sheet.key, ids: [], shares: [] };
}

/** The choice for this sheet: the one held if it is the sheet's, a fresh one otherwise. */
export function choiceFor(sheet: Sheet, held: Choice | null): Choice {
  return held && held.key === sheet.key ? held : startChoice(sheet);
}

// What the table needs to open the sheets a tap leads to.
export type TapContext = { game: ScenarioState; ctx: ReduceContext; legal: readonly LegalIntent[]; names: SheetNames };

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
 * that card leads to (a host for an attachment, the attackers of an enemy, the payment of a card). Never an intent.
 */
export function tap(sheet: Sheet, held: Choice | null, cardId: string, table: TapContext): TapResult {
  const choice = choiceFor(sheet, held);
  switch (sheet.kind) {
    case "pick": {
      const item = sheet.options.find((candidate) => candidate.id === cardId);
      if (!item) return { kind: "none" };
      // Choosing an enemy to attack, or a host for an attachment, is not a decision yet: it opens the next question.
      if ("next" in item) return { kind: "open", sheet: item.next };
      return { kind: "choice", choice: { ...choice, ids: choice.ids[0] === cardId ? [] : [cardId] } };
    }
    case "multi":
      if (!sheet.options.some((item) => item.id === cardId)) return { kind: "none" };
      return { kind: "choice", choice: { ...choice, ids: toggle(choice.ids, cardId) } };
    case "distribute": {
      const item = sheet.options.find((candidate) => candidate.id === cardId);
      if (!item) return { kind: "none" };
      return { kind: "choice", choice: { ...choice, shares: tapShare(choice.shares, cardId, item.max, sheet.exact ? sheet.total : null) } };
    }
    case "trigger": {
      // A card with two abilities: each tap moves to the next one.
      const options = sheet.options.filter((item) => item.cardId === cardId);
      if (options.length === 0) return { kind: "none" };
      const at = options.findIndex((item) => item.id === choice.ids[0]);
      const next = options[(at + 1) % options.length];
      return { kind: "choice", choice: { ...choice, ids: next ? [next.id] : [] } };
    }
    case "window": {
      if (sheet.commit?.options.some((item) => item.id === cardId)) return { kind: "choice", choice: { ...choice, ids: toggle(choice.ids, cardId) } };
      if (sheet.plays.includes(cardId)) {
        const opened = playSheet(table.game, table.ctx, table.legal, table.names, cardId);
        return opened ? { kind: "open", sheet: opened } : { kind: "none" };
      }
      const use = cardTriggerSheet(table.game, table.names, sheet.triggers, cardId);
      return use ? { kind: "open", sheet: use } : { kind: "none" };
    }
    case "outcome":
      return { kind: "none" };
  }
}

/** How a card the sheet names is marked on the table: picked, given a share (with the amount), or only choosable. */
export function marked(sheet: Sheet, held: Choice | null): ReadonlyMap<string, number> {
  const choice = choiceFor(sheet, held);
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

export type DockAction =
  | { kind: "intent"; intent: PlayerIntent }
  | { kind: "open"; sheet: Sheet }
  // The scenario is over: the resolution screen.
  | { kind: "outcome" }
  // Put the picks back: nothing is sent.
  | { kind: "clear" }
  // Close a sheet the player opened (a payment, a host): nothing is sent.
  | { kind: "close" };

// `arm`: the button sends an intent with nothing picked first, so the first tap only arms it.
export type DockButton = { label: string; action: DockAction; arm: boolean; testID: string };

export type Dock = {
  primary: DockButton | null;
  // Why the primary is not ready yet, or null.
  why: string | null;
  secondary: readonly DockButton[];
};

// The name in a primary's label: the option's own words, without the numbers a tile adds.
function short(label: string): string {
  return label.split(" · ")[0] ?? label;
}

/**
 * The buttons that answer the sheet. `overlay` is true for a sheet the player opened from the table (a payment, a host, an
 * Action), which gets a Cancel that sends nothing. `passLegal` adds Pass when the rules allow it and the sheet has none.
 */
export function dockFor(sheet: Sheet, held: Choice | null, table: TapContext, options: { overlay: boolean; passLegal: boolean }): Dock {
  const choice = choiceFor(sheet, held);
  const secondary: DockButton[] = [];
  let primary: DockButton | null = null;
  let why: string | null = null;
  let sendsPass = false;
  switch (sheet.kind) {
    case "pick": {
      if (sheet.primary) {
        primary = { label: sheet.primary.label, action: { kind: "intent", intent: sheet.primary.intent }, arm: !sheet.selectionMade, testID: "sheet-primary" };
        sendsPass = sheet.primary.intent.type === "Pass";
      } else if (sheet.options.length > 0) {
        const item = sheet.options.find((option) => option.id === choice.ids[0]) ?? null;
        const label = sheet.confirm ?? (item ? `${sheet.verb} ${short(item.label)}`.trim() : sheet.verb);
        const action: DockAction | null = item ? ("intent" in item ? { kind: "intent", intent: item.intent } : { kind: "open", sheet: item.next }) : null;
        primary = { label, action: action ?? { kind: "clear" }, arm: false, testID: "sheet-primary" };
        if (!item) why = "Choose one first.";
      }
      const alternative = sheet.alternative;
      if (alternative) {
        secondary.push({
          label: alternative.label,
          action: "intent" in alternative ? { kind: "intent", intent: alternative.intent } : { kind: "open", sheet: alternative.next },
          arm: "intent" in alternative,
          testID: "sheet-alternative",
        });
        sendsPass ||= "intent" in alternative && alternative.intent.type === "Pass";
      }
      break;
    }
    case "multi": {
      const count = choice.ids.length;
      const ready = sheet.allowEmpty || count > 0;
      const label = count === 0 && sheet.allowEmpty ? `${sheet.verb} no one` : `${sheet.verb} ${count}`;
      primary = { label, action: { kind: "intent", intent: multiIntent(sheet, choice.ids) }, arm: count === 0, testID: "sheet-primary" };
      if (!ready) why = sheet.options.length === 0 ? "No character can be chosen." : "Tap at least one character.";
      const alternative = sheet.alternative;
      if (alternative) {
        secondary.push({
          label: alternative.label,
          action: "intent" in alternative ? { kind: "intent", intent: alternative.intent } : { kind: "open", sheet: alternative.next },
          arm: "intent" in alternative,
          testID: "sheet-alternative",
        });
      }
      break;
    }
    case "distribute": {
      const ready = sharesReady(choice.shares, sheet.total, sheet.exact);
      const purpose = sheet.purpose;
      const label = purpose.kind === "archery" ? "Assign" : purpose.kind === "play" ? "Play" : "Use";
      primary = { label, action: { kind: "intent", intent: distributeIntent(sheet, choice.shares) }, arm: false, testID: "sheet-primary" };
      if (!ready) why = sheet.options.length === 0 ? "Nothing can pay this." : `Assign all ${sheet.total} first.`;
      if (choice.shares.length > 0) secondary.push({ label: "Clear", action: { kind: "clear" }, arm: false, testID: "sheet-clear" });
      break;
    }
    case "trigger": {
      const item = sheet.options.find((option) => option.id === choice.ids[0]) ?? null;
      if (sheet.options.length > 0) {
        const action: DockAction = !item
          ? { kind: "clear" }
          : item.pay
            ? { kind: "open", sheet: paySheet(table.game, table.names, item.pay, { kind: "trigger", cardId: item.cardId, effectId: item.effectId }) }
            : { kind: "intent", intent: { type: "Trigger", cardId: item.cardId, effectId: item.effectId } };
        primary = { label: item ? `Use ${short(item.label)}` : "Use", action, arm: false, testID: "sheet-primary" };
        if (!item) why = sheet.pass ? "Tap a glowing card, or pass." : "Tap a glowing card.";
      }
      if (sheet.pass) {
        secondary.push({ label: sheet.pass, action: { kind: "intent", intent: { type: "Pass" } }, arm: true, testID: "sheet-pass" });
        sendsPass = true;
      }
      break;
    }
    case "window": {
      if (sheet.commit) {
        const count = choice.ids.length;
        primary = { label: `Commit ${count}`, action: { kind: "intent", intent: { type: "Commit", cardIds: [...choice.ids] } }, arm: false, testID: "table-commit" };
        if (count === 0) why = "Tap characters to commit them.";
      }
      secondary.push({ label: sheet.pass, action: { kind: "intent", intent: { type: "Pass" } }, arm: true, testID: "table-pass" });
      sendsPass = true;
      break;
    }
    case "outcome":
      primary = { label: sheet.result === "won" ? "Choose rewards" : "Continue", action: { kind: "outcome" }, arm: false, testID: "sheet-outcome" };
      sendsPass = true;
      break;
  }
  if (options.passLegal && !sendsPass && !options.overlay) secondary.push({ label: "Pass", action: { kind: "intent", intent: { type: "Pass" } }, arm: true, testID: "sheet-pass-window" });
  if (options.overlay) secondary.push({ label: "Cancel", action: { kind: "close" }, arm: false, testID: "sheet-cancel" });
  return { primary, why, secondary };
}

/** True when the dock's primary can be pressed now. */
export function primaryReady(dock: Dock): boolean {
  return dock.primary != null && dock.why == null && dock.primary.action.kind !== "clear";
}

/**
 * True when the sheet is answered on the table: every card it asks about is drawn there (`onTable`), or it asks about no card
 * at all. Otherwise it opens as a paper panel.
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

// The engine's numbers for the moment, as the dock shows them beside the choice: willpower against threat while questing,
// attack against defense in an attack. Each number is read with the engine's own functions on the current state; the picks
// only say whose numbers to add.
export type Readout = { kind: "quest" | "hide" | "attack" | "defense"; stats: readonly SheetStat[]; result: string | null };

const WILL = (value: number): SheetStat => ({ icon: "willpower", value, word: "Willpower" });
const THREAT = (value: number): SheetStat => ({ icon: "threat", value, word: "Threat" });
const ATTACK = (value: number): SheetStat => ({ icon: "attack", value, word: "Attack" });
const DEFENSE = (value: number): SheetStat => ({ icon: "defense", value, word: "Defense" });

function questResult(willpower: number, threat: number): string {
  if (willpower > threat) return `${willpower - threat} progress if nothing changes`;
  if (willpower < threat) return `Threat +${threat - willpower} if nothing changes`;
  return "No progress and no threat if nothing changes";
}

function damageWords(attack: number, defense: number): string {
  const damage = Math.max(0, attack - defense);
  return damage === 0 ? "No damage" : `${damage} damage`;
}

/** The numbers to show beside the open sheet, or null when the moment has none. */
export function readoutFor(game: ScenarioState, ctx: ReduceContext, sheet: Sheet | null, held: Choice | null): Readout | null {
  const choice = sheet ? choiceFor(sheet, held) : null;
  // A Hide test's action window: the willpower committed against the threat of the cards discarded (mec109.hide-tests).
  if (sheet?.kind === "trigger" && sheet.hide) {
    const { willpower, threat, x } = sheet.hide;
    return { kind: "hide", stats: [WILL(willpower), THREAT(threat)], result: willpower >= threat ? `Hide ${x}: passed if nothing changes` : `Hide ${x}: failed if nothing changes` };
  }
  const willOf = (id: string) => {
    const card = game.cards[id];
    return card ? modifiedStat(game, card, "willpower", ctx.cards) : 0;
  };
  // The quest: committed willpower (and the characters picked to join it) against the threat in staging.
  if (game.phase === "Quest" && !game.questResolved && (game.mode === "questCommit" || game.mode === "staging" || game.mode === "resolution")) {
    if (sheet?.kind === "multi" && sheet.build.kind === "CommitHide") {
      const frame = [...game.stack].reverse().find((item) => item.data.kind === "hide");
      const committed = frame?.data.kind === "hide" ? frame.data.committedIds : [];
      const willpower = hideWillpower(game, game.activeSeat, [...committed, ...(choice?.ids ?? [])], ctx);
      return { kind: "hide", stats: [WILL(willpower)], result: frame?.data.kind === "hide" ? `Hide ${frame.data.x}: the threat of the cards discarded is compared after you commit.` : null };
    }
    const picked = sheet?.kind === "window" && sheet.commit ? (choice?.ids ?? []).filter((id) => !game.cards[id]?.committed) : [];
    const willpower = committedWillpower(game, ctx.cards) + picked.reduce((sum, id) => sum + willOf(id), 0);
    const threat = stagingThreat(game, ctx.cards);
    const staged = game.mode !== "questCommit";
    return { kind: "quest", stats: [WILL(willpower), THREAT(threat)], result: staged ? questResult(willpower, threat) : "Staging comes next: each player reveals an encounter card." };
  }
  // An enemy attacks: its attack against the defender picked or declared.
  const attack = game.pendingAttack;
  if (attack) {
    const enemy = game.cards[attack.enemyId];
    if (!enemy) return null;
    const strength = modifiedStat(game, enemy, "attack", ctx.cards);
    const defenderId = attack.defenderId ?? (sheet?.kind === "pick" && game.window?.kind === "defense" ? choice?.ids[0] : undefined);
    const defender = defenderId && !attack.undefended ? game.cards[defenderId] : undefined;
    const shadowNote = attack.shadowResolved ? "" : " before its shadow card";
    if (!defender) {
      const hit = attack.heroId ? game.cards[attack.heroId] : undefined;
      return { kind: "defense", stats: [ATTACK(strength)], result: hit || attack.undefended ? `Undefended: ${strength} damage${shadowNote}` : `Undefended, a hero takes ${strength} damage${shadowNote}` };
    }
    const defense = modifiedStat(game, defender, "defense", ctx.cards);
    return { kind: "defense", stats: [ATTACK(strength), DEFENSE(defense)], result: `${damageWords(strength, defense)}${shadowNote}` };
  }
  // The players attack: the attackers picked (or declared) against the enemy's defense.
  const strike = game.pendingStrike;
  const building = sheet?.kind === "multi" && sheet.build.kind === "attack" ? sheet.build.enemyId : null;
  const enemyId = strike?.enemyId ?? building;
  if (enemyId) {
    const enemy = game.cards[enemyId];
    if (!enemy) return null;
    const attackers = strike?.attackerIds ?? choice?.ids ?? [];
    const total = attackers.reduce((sum, id) => {
      const card = game.cards[id];
      return sum + (card ? modifiedStat(game, card, "attack", ctx.cards, enemyId) : 0);
    }, 0);
    const defense = modifiedStat(game, enemy, "defense", ctx.cards);
    return { kind: "attack", stats: [ATTACK(total), DEFENSE(defense)], result: damageWords(total, defense) };
  }
  return null;
}

/** The share a distribute sheet has given a card, for the canvas and a panel tile. */
export function shareFor(sheet: Sheet, held: Choice | null, cardId: string): number {
  return sheet.kind === "distribute" ? shareOf(choiceFor(sheet, held).shares, cardId) : 0;
}

/** How much a distribute sheet has given so far. */
export function sharedSoFar(sheet: Sheet, held: Choice | null): number {
  return sheet.kind === "distribute" ? shareSum(choiceFor(sheet, held).shares) : 0;
}

