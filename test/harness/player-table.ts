import { readFileSync } from "node:fs";

import type { Effect, ModifierStat } from "../../src/catalog/boundary.ts";
import type { DeckSaveCard } from "../../src/catalog/deck-save.ts";
import { modifiedStat, placeDamage } from "../../src/rules/core/keywords.ts";
import { updateCard, withMode, withThreat, type ScenarioState } from "../../src/rules/core/state.ts";
import { ruleCause } from "../../src/rules/core/cause.ts";
import { attachTo, spawn } from "../../src/rules/core/zones.ts";
import { settle } from "../../src/rules/engine/machine.ts";
import { legalIntents, legalTargets, type PlayerIntent, type ReduceContext } from "../../src/rules/engine/reduce.ts";
import { syncConstants } from "../../src/rules/interpret/constants.ts";
import { fund, payFor, refusal, starterBase } from "../scenarios/a-shadow-of-the-past/starter-scene.ts";

import { causeProblems } from "./cause-check.ts";
import { accepted, begin, buildTable, idsOf, type Run, type Scene, type Table } from "./scene.ts";

// Test helper. The table and the readers that the player-card tests (src/campaign/player-cards) share: a table on the records under test with every
// seat's heroes funded and the constants brought up to date as the reducer does after an intent, the intents the engine offers, a stat as the
// game reads it, the combat windows, and the steps that move a scene along (play a card, attach, pass windows, enter a phase, answer a question).
// Each test file keeps its own `base` (the printed cards it loads) and passes it in.

export type PlayerBase = Awaited<ReturnType<typeof starterBase>>;

/** The table on the records under test: each seat's heroes hold `resources`, the constants are up to date. */
export function playerTable(base: PlayerBase, effects: readonly Effect[], scene: Scene = {}, resources = 6): Table {
  const tab = buildTable(base, { ring: "none", start: "planning", ...scene, effects });
  let state = tab.state;
  for (let seat = 0; seat < (scene.seats ?? 1); seat += 1) state = fund(state, seat, resources);
  return { ...tab, state: syncConstants(state, tab.ctx) };
}

/**
 * A file's `table`: `playerTable` on the records it is given, over the printed cards the file loads (`base` is read when the table is built, so a
 * `let base` that a `beforeAll` fills works). Write `const table = playerTableFor(() => base);`.
 */
export function playerTableFor(base: () => PlayerBase): (effects: readonly Effect[], scene?: Scene, resources?: number) => Table {
  return (effects, scene = {}, resources = 6) => playerTable(base(), effects, scene, resources);
}

/** The effect ids of the Trigger intents the engine offers. */
export function triggers(state: ScenarioState, tab: Table): string[] {
  return legalIntents(state, tab.ctx).flatMap((intent) => (intent.type === "Trigger" ? [intent.effectId] : []));
}

/** The option ids of the Choose intents the engine offers. */
export function choices(state: ScenarioState, tab: Table): string[] {
  return legalIntents(state, tab.ctx).flatMap((intent) => (intent.type === "Choose" ? [intent.optionId] : []));
}

/** Whether the engine offers a PlayCard of the card `cardId` in `state` (the table's `ctx`). */
export function canPlay(state: ScenarioState, tab: Table, cardId: string): boolean {
  return legalIntents(state, tab.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === cardId);
}

/** The ids of the cards the engine offers a PlayCard for in `state`, in the order it offers them. */
export function playableCards(state: ScenarioState, tab: Table): string[] {
  return legalIntents(state, tab.ctx).flatMap((intent) => (intent.type === "PlayCard" ? [intent.cardId] : []));
}

/** The engine's refusal (a reason, or null when it would play) of a PlayCard of the first card of `code`, paid as `payFor` pays it. */
export function playRefusal(state: ScenarioState, tab: Table, code: string): string | null {
  const card = idsOf(tab, code);
  return refusal(state, { type: "PlayCard", cardId: card, payments: payFor(state, tab.ctx, card) }, tab.ctx);
}

/** A stat as the game reads it, modifiers included. */
export function stat(state: ScenarioState, tab: Table, id: string, which: Extract<ModifierStat, "attack" | "defense" | "hitPoints" | "willpower" | "threat" | "questPoints" | "engagementCost">): number {
  const card = state.cards[id];
  if (!card) throw new Error(`no card ${id}`);
  return modifiedStat(state, card, which, tab.ctx.cards);
}

/** The table with the threat of `seat`'s player set to `threat`. */
export function threatened(tab: Table, threat: number, seat = 0): Table {
  return { ...tab, state: withThreat(tab.state, seat, threat) };
}

/** The table with the cards `ids` exhausted. */
export function exhausted(tab: Table, ...ids: readonly string[]): Table {
  return { ...tab, state: ids.reduce((state, id) => updateCard(state, id, { exhausted: true }), tab.state) };
}

/** Puts 9 damage on `id` in `state` (a card with that much health is destroyed) and passes the window that opens, through sendUnledgered. */
export function destroyed(state: ScenarioState, tab: Table, id: string): Run {
  return sendUnledgered(begin(placeDamage(state, id, 9, tab.ctx.cards, [], "framework", ruleCause("rr.damage"))), { type: "Pass" }, tab.ctx);
}

/** The combat phase begins with the enemies engaged: its action window (6.2) is open. */
export function combat(state: ScenarioState, tab: Table): Run {
  return begin(settle({ ...withMode(state, "combatStart"), window: null }, tab.ctx, []));
}

/** The combat phase with no enemy attacking: the player attack window, the first seat to declare. */
export const attacking = (state: ScenarioState): ScenarioState => ({ ...withMode(state, "playerAttacks"), window: { kind: "playerAttack" }, activeSeat: 0 });

/**
 * The harness's send (scene.ts), save one cause problem it skips: a step whose cause names a printed line "which is not in the ledger". The packs
 * these tests cover (Over Hill and Under Hill, The Wilds of Rhovanion, The Treason of Saruman) have no entry in data/printed yet, so the check
 * cannot verify that line. Every other cause problem still fails the intent, and a refusal throws IntentRefused.
 */
export function sendUnledgered(run: Run, intent: PlayerIntent, ctx: ReduceContext): Run {
  const result = accepted(run.state, intent, ctx);
  const problems = causeProblems(result.steps).filter((problem) => !/names line \S+, which is not in the ledger/.test(problem));
  if (problems.length > 0) throw new Error(`Steps without a verified cause after ${intent.type}: ${problems.join("; ")}`);
  return { state: result.state, steps: [...run.steps, ...result.steps] };
}

/** A printed stat of a card code (0 when the card has none), read from the table's catalog, not the game. */
export function printed(tab: Table, code: string, which: "attack" | "defense" | "health" | "willpower"): number {
  return tab.ctx.cards.get(code)?.[which] ?? 0;
}

/** The ids a PlayCard of `cardId` may be played on or into (an attachment's hosts, a location's place), sorted. `state` defaults to the table's. */
export function hosts(tab: Table, cardId: string, state: ScenarioState = tab.state): string[] {
  return [...legalTargets(state, { type: "PlayCard", cardId }, tab.ctx)].sort();
}

/** Plays the card `cardId` from hand with its payment, on `hostId` when given, through sendUnledgered. A refusal throws IntentRefused. */
export function play(run: Run, tab: Table, cardId: string, hostId?: string): Run {
  return sendUnledgered(run, { type: "PlayCard", cardId, payments: payFor(run.state, tab.ctx, cardId), ...(hostId ? { hostId } : {}) }, tab.ctx);
}

/** `play` for a card named by its code: the first copy of it in hand in the run's state (the first copy there is when none is), from `run`. */
export function playCode(tab: Table, code: string, run: Run = begin(tab.state)): Run {
  const card = tab.ids[code]?.find((id) => run.state.cards[id]?.zone === "hand") ?? tab.ids[code]?.[0] ?? "";
  return play(run, tab, card);
}

/** Attaches cards the scene put in play to the hosts named ([attachment id, host id]), then brings the constants up to date. */
export function attach(tab: Table, pairs: readonly (readonly [string, string])[]): Table {
  let state = tab.state;
  for (const [id, host] of pairs) state = attachTo(state, id, host);
  return { ...tab, state: syncConstants(state, tab.ctx) };
}

/** Puts cards onto a seat's player discard pile, the last one on top: one [code, seat] row each. (The scene's `discard` is the encounter discard pile.) */
export function discarded(tab: Table, rows: readonly (readonly [string, number])[]): { tab: Table; ids: string[] } {
  let state = tab.state;
  const ids: string[] = [];
  for (const [code, seat] of rows) {
    const made = spawn(state, code, { zone: "discard", seat });
    state = made.state;
    ids.push(made.id);
  }
  return { tab: { ...tab, state }, ids };
}

/**
 * Passes the open framework action windows until the game asks for something else. `responses` passes the response windows too; `engage` answers
 * the optional engagement window with DeclineEngage. A window with no Pass on offer ends the loop.
 */
export function passAll(run: Run, ctx: ReduceContext, windows: { responses?: boolean; engage?: boolean } = {}): Run {
  let next = run;
  for (let guard = 0; guard < 30; guard += 1) {
    const kind = next.state.window?.kind;
    if (windows.engage && kind === "optionalEngage") {
      next = sendUnledgered(next, { type: "DeclineEngage" }, ctx);
    } else if (kind === "frameAction" || (windows.responses && kind === "response")) {
      if (!legalIntents(next.state, ctx).some((intent) => intent.type === "Pass")) break;
      next = sendUnledgered(next, { type: "Pass" }, ctx);
    } else {
      break;
    }
  }
  return next;
}

/** Sends Pass (sendUnledgered) while `keepGoing(run)` holds, at most `max` times. A Pass nobody offers throws IntentRefused, as one Pass does. */
export function passWhile(run: Run, tab: Table, keepGoing: (run: Run) => boolean, max = 10): Run {
  let next = run;
  for (let guard = 0; guard < max && keepGoing(next); guard += 1) next = sendUnledgered(next, { type: "Pass" }, tab.ctx);
  return next;
}

/**
 * The quest phase from its commit step: `commit` (card ids) is committed, then Pass is sent until `stop(run)` holds, a question is asked, the
 * travel step comes or no Pass is offered (at most 20 times), so a Response window of the quest, a staging step or a choice can be read.
 */
export function questUntil(tab: Table, commit: readonly string[], stop: (run: Run) => boolean = () => false): Run {
  const committed = sendUnledgered(begin(tab.state), { type: "Commit", cardIds: [...commit] }, tab.ctx);
  return passWhile(committed, tab, (run) => !stop(run) && run.state.window?.kind !== "choose" && run.state.mode !== "travel" && legalIntents(run.state, tab.ctx).some((intent) => intent.type === "Pass"), 20);
}

/** The engine moves on to `mode` (its phase begins) and runs to its next window. */
export function enter(state: ScenarioState, tab: Table, mode: Parameters<typeof withMode>[1]): Run {
  return begin(settle({ ...withMode(state, mode), window: null }, tab.ctx, []));
}

/** The end of the round: its action window is passed, so the round ends. */
export function endRound(state: ScenarioState, tab: Table): Run {
  return passAll(enter(state, tab, "endRound"), tab.ctx);
}

/** The quest phase's commit step on this state, the lasting effects kept (no engine step runs). */
export const questing = (state: ScenarioState): ScenarioState => ({ ...state, phase: "Quest", boundaryPhase: "Quest", mode: "questCommit", window: { kind: "pass" }, activeSeat: 0 });

/** Answers a question the game asks (a `choose` window) with `optionId`; a run that is not asking one is returned as it is. */
export function chooseIfAsked(run: Run, tab: Table, optionId: string): Run {
  return run.state.window?.kind === "choose" ? sendUnledgered(run, { type: "Choose", optionId }, tab.ctx) : run;
}

/** Answers the questions an effect asks with their first option, while it asks one (at most four). */
export function answerFirst(run: Run, tab: Table): Run {
  let next = run;
  for (let guard = 0; guard < 4 && next.state.window?.kind === "choose"; guard += 1) next = sendUnledgered(next, { type: "Choose", optionId: choices(next.state, tab)[0] ?? "" }, tab.ctx);
  return next;
}

/** A deck of `count` copies of the card `code` for `seat` (a scene's `playerDeck`). */
export const fillers = (code: string, count: number, seat = 0) => Array.from({ length: count }, () => ({ code, seat }));

/** A card row of data/cards/<pack>.json, the fields a deck check reads. */
export type PackRow = { code: string; name: string; type: string; sphere: string | null; deckLimit: number | null };

/** The row of card `code` in data/cards/<pack>.json (the pack's file name, `TLR`), or undefined. */
export function packRow(pack: string, code: string): PackRow | undefined {
  const rows = JSON.parse(readFileSync(new URL(`../../data/cards/${pack}.json`, import.meta.url), "utf8")) as PackRow[];
  return rows.find((card) => card.code === code);
}

/**
 * The deck-save facts (deckSaveRefusal) of a deck of hero "h1", `row`'s card (keyed by its code) and the 50 events "e0" to "e49", each with a
 * deck limit of 3.
 */
export function deckSaveFacts(row: PackRow | undefined): Map<string, DeckSaveCard> {
  const fact = (name: string, typeCode: string, sphereCode: string | null, deckLimit: number | null): DeckSaveCard => ({ name, typeCode, sphereCode, deckLimit, deckLegal: true, traits: null });
  const facts = new Map<string, DeckSaveCard>([["h1", fact("Hero", "hero", "leadership", null)], [row?.code ?? "", fact(row?.name ?? "", row?.type ?? "", row?.sphere ?? null, row?.deckLimit ?? null)]]);
  for (let index = 0; index < 50; index += 1) facts.set(`e${index}`, fact(`Event ${index}`, "event", "leadership", 3));
  return facts;
}
