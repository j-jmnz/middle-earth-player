// Rules: rr.action-windows, rr.step-3-1, rr.travel, rr.optional-engagement, rr.step-6-4-3, rr.step-6-8-1, mec109.archery
// (data/rules/entries.json).
//
// How the player answers the open moment on the table. A sheet (sheets.ts, bar-sheets.ts) says what the rules allow; this
// file says what a tap on a card does with it and which buttons confirm it. A tap only picks: it never sends an intent.
// Every intent goes out from a button, and a button that sends one without anything picked first (Pass, Keep, Leave
// undefended, Do not travel) must be tapped twice: once to arm it, once to confirm (docs/design-system.md, Table).
//
// When every choice of a sheet is a card drawn whole on the table, the cards are picked on the canvas and the dock beside the
// table holds the buttons. Otherwise (an either/or of an effect, a seat, a card out of play, an attachment that only peeks
// out under its host) the sheet opens as a paper panel whose tiles are picked the same way. The numbers beside the choice
// are readout.ts.
import type { PlayerIntent, ReduceContext, ScenarioState } from "../rules/reduce.ts";

import { cardTriggerSheet, distributeIntent, multiIntent, paySheet, playSheet, sheetSendsPass } from "./bar-sheets.ts";
import type { CombatMark } from "./layout.ts";
import { firstShares, shareOf, sharesReady, tapShare, type Share } from "./pay.ts";
import type { LegalIntent } from "./store.ts";
import type { Sheet, SheetNames, SheetStat } from "./sheet-types.ts";

/** What the player has picked for the open sheet. `key` is the sheet's: a new sheet starts a new choice. */
export type Choice = { key: string; ids: readonly string[]; shares: readonly Share[] };

/**
 * The choice a sheet starts with: the characters already put toward a commit, the first guess of a payment, or the one
 * ability of a card the player tapped to use.
 */
export function startChoice(sheet: Sheet): Choice {
  if (sheet.kind === "multi") return { key: sheet.key, ids: sheet.preselected.filter((id) => sheet.options.some((item) => item.id === id)), shares: [] };
  if (sheet.kind === "distribute" && sheet.purpose.kind !== "archery") {
    return { key: sheet.key, ids: [], shares: firstShares({ seat: 0, cardId: "", total: sheet.total, exact: sheet.exact, pools: sheet.options.map((item) => ({ heroId: item.id, max: item.max })) }) };
  }
  if (sheet.kind === "trigger" && sheet.preselect) return { key: sheet.key, ids: [sheet.preselect], shares: [] };
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
  if (sheet.kind !== "pick" || !enemyId || !choice.ids[0]) return null;
  const item = sheet.options.find((option) => option.id === choice.ids[0]);
  if (!item || !("intent" in item)) return null;
  if (item.intent.type === "DeclareDefender") return { enemyId, ids: [item.id], kind: "defense" };
  if (item.intent.type === "Undefended") return { enemyId, ids: [item.id], kind: "undefended" };
  return null;
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

// `arm`: the button sends an intent with nothing picked first, so the first tap only arms it, and `armed` is the caption the
// button shows under it while armed (what the second tap does).
export type DockButton = { label: string; action: DockAction; arm: boolean; armed?: string; testID: string };

export type Dock = {
  // The one filled button, always in the same place: the confirm of what is picked, or (with nothing picked) Pass,
  // Continue, Done or Keep.
  primary: DockButton | null;
  // Why the primary is not ready yet, or null.
  why: string | null;
  secondary: readonly DockButton[];
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
 * `surface` words the sentence under a primary that waits for a pick.
 */
export function dockFor(sheet: Sheet, choice: Choice, table: TapContext, options: { overlay: boolean; passLegal: boolean; surface: "table" | "panel" }): Dock {
  const secondary: DockButton[] = [];
  let primary: DockButton | null = null;
  let why: string | null = null;
  const pickWords = options.surface === "panel" ? "Choose one above." : "Tap a glowing card.";
  switch (sheet.kind) {
    case "pick": {
      if (sheet.primary) {
        const armed = sheet.primary.intent.type === "Pass" ? "Tap again to close it" : `Tap again to ${sheet.primary.label.toLowerCase()}`;
        primary = { label: sheet.primary.label, action: { kind: "intent", intent: sheet.primary.intent }, arm: !sheet.selectionMade, armed, testID: "sheet-primary" };
      } else if (sheet.options.length > 0) {
        const item = sheet.options.find((option) => option.id === choice.ids[0]) ?? null;
        const label = sheet.confirm ?? verbOf(sheet.verb);
        const action: DockAction = !item ? { kind: "clear" } : "intent" in item ? { kind: "intent", intent: item.intent } : { kind: "open", sheet: item.next };
        primary = { label, action, arm: false, testID: "sheet-primary" };
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
      primary = { label, action: { kind: "intent", intent: multiIntent(sheet, choice.ids) }, arm: count === 0, armed: "Tap again: nobody is committed", testID: "sheet-primary" };
      if (!sheet.allowEmpty && count === 0) why = sheet.options.length === 0 ? "No character can be chosen." : options.surface === "panel" ? "Choose at least one above." : "Tap at least one glowing card.";
      if (sheet.alternative) secondary.push(alternativeButton(sheet.alternative));
      break;
    }
    case "distribute": {
      const purpose = sheet.purpose;
      const label = purpose.kind === "archery" ? "Assign" : purpose.kind === "play" ? "Play" : "Use";
      primary = { label, action: { kind: "intent", intent: distributeIntent(sheet, choice.shares) }, arm: false, testID: "sheet-primary" };
      if (!sharesReady(choice.shares, sheet.total, sheet.exact)) why = sheet.options.length === 0 ? "Nothing can pay this." : `Assign all ${sheet.total} first.`;
      if (choice.shares.length > 0) secondary.push({ label: "Clear", action: { kind: "clear" }, arm: false, testID: "sheet-clear" });
      break;
    }
    case "trigger": {
      const item = sheet.options.find((option) => option.id === choice.ids[0]) ?? null;
      if (item) {
        const action: DockAction = item.pay
          ? { kind: "open", sheet: paySheet(table.game, table.names, item.pay, { kind: "trigger", cardId: item.cardId, effectId: item.effectId }) }
          : { kind: "intent", intent: { type: "Trigger", cardId: item.cardId, effectId: item.effectId } };
        primary = { label: "Use", action, arm: false, testID: "sheet-primary" };
        if (sheet.pass) secondary.push(PASS(sheet.pass, "sheet-pass", `Tap again: ${sheet.pass.toLowerCase()} without it`));
      } else if (sheet.pass) {
        // Nothing picked: the window's own Pass is the one filled button, in the same place.
        primary = PASS(sheet.pass, "sheet-pass", "Tap again: nothing is used");
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
      } else {
        // Nothing picked: Pass is the filled button. In the commit window it sends no one on the quest.
        primary = PASS(sheet.pass, "table-pass", sheet.armed);
      }
      break;
    }
    case "outcome":
      primary = { label: sheet.action, action: { kind: "outcome" }, arm: false, testID: "sheet-outcome" };
      break;
  }
  if (options.passLegal && !sheetSendsPass(sheet) && !options.overlay) secondary.push(PASS("Pass", "sheet-pass-window", "Tap again to pass"));
  if (options.overlay) secondary.push({ label: "Cancel", action: { kind: "close" }, arm: false, testID: "sheet-cancel" });
  return { primary, why, secondary };
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
export function headerOf(sheet: Sheet, game: ScenarioState): { step: string; title: string; note: string | null; stats: readonly SheetStat[] } {
  const seat = game.seatCount > 1 ? `Player ${game.activeSeat + 1} · ` : "";
  switch (sheet.kind) {
    case "pick":
    case "multi":
      return { step: `${seat}${sheet.step}`, title: sheet.title, note: sheet.note, stats: sheet.stats ?? [] };
    case "distribute":
      return { step: `${seat}${sheet.step}`, title: sheet.title, note: sheet.note, stats: [] };
    case "trigger":
      return { step: `${seat}${sheet.timing} · ${sheet.step}`, title: sheet.title, note: sheet.note, stats: [] };
    case "window":
      return { step: `${seat}${sheet.step}`, title: sheet.title, note: sheet.note, stats: [] };
    case "outcome":
      return { step: sheet.step, title: sheet.title, note: sheet.note, stats: [] };
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
