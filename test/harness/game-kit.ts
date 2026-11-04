import type { LoadoutSeat } from "../../src/campaign/loadout.ts";
import { characters, legalAttackEnemies } from "../../src/rules/combat/combat.ts";
import type { EngineStep } from "../../src/rules/core/intents.ts";
import { definePrinted, type PrintedCard } from "../../src/rules/core/printed.ts";
import { expectOk } from "../../src/rules/core/test-fixture.ts";
import { legalIntents, legalTargets, reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";
import type { StartScenario } from "../../src/rules/setup/setup.ts";

import { faceProblems } from "./face-check.ts";

// Test helper. The parts every scenario's seeded whole game (test/scenarios/<scenario-id>/game.ts) shares: the stand-in heroes
// and the free-event deck, the loop that plays a game to its end, and the auto-player's extra answers most scenarios give
// (attack together, engage one enemy at a time). A scenario's game.ts keeps only what is its own: its start, its answers,
// its goldens.

// Stand-in heroes, three a seat, with the numbers each scenario's game gives them, and a deck of free events.
export const STRONG_HEROES = ["q1", "q2", "q3", "q4", "q5", "q6"];
export const FILLER = "filler";

export function fillerLoadout(seatCount: 1 | 2): LoadoutSeat[] {
  const deck = Array.from({ length: 30 }, () => FILLER);
  const first = { heroes: ["q1", "q2", "q3"], deck };
  return seatCount === 1 ? [first] : [first, { heroes: ["q4", "q5", "q6"], deck }];
}

/** The free event the filler decks hold: costs nothing and does nothing. */
export function fillerCard(): PrintedCard {
  return definePrinted({ code: FILLER, name: FILLER, type: "event", sphere: "neutral", cost: 0 });
}

export type PlayedGame = { start: StartScenario; kept: ScenarioState; state: ScenarioState; intents: PlayerIntent[]; steps: EngineStep[] };

/**
 * Plays a game from its start: the first seat keeps its opening hand (a second seat's Keep is the first of `intents`), then
 * `answer` gives every intent until the scenario is lost, or won and every Resolution choice is answered, or `limit` intents.
 */
export function playToEnd(start: StartScenario, ctx: ReduceContext, answer: (state: ScenarioState, memory: Set<string>) => PlayerIntent, limit: number): PlayedGame {
  const opened = expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx));
  const kept = opened.state;
  const steps: EngineStep[] = [...opened.steps];
  let state = kept;
  const intents: PlayerIntent[] = [];
  const memory = new Set<string>();
  for (let turn = 0; turn < limit && !state.lost && !(state.stageCleared && state.window == null); turn += 1) {
    const intent = answer(state, memory);
    const result = expectOk(reduce(state, intent, ctx));
    state = result.state;
    steps.push(...result.steps);
    intents.push(intent);
    // A card in the staging area, engaged or active shows its face (face-check.ts).
    const facedown = faceProblems(state);
    if (facedown.length > 0) throw new Error(`After intent ${intents.length} (${JSON.stringify(intent)}): ${facedown.join("; ")}`);
  }
  return { start, kept, state, intents, steps };
}

/**
 * In a player attack window: every ready character that may attack (and `may` allows) attacks the first enemy any of them can
 * reach, together. Null when the window is another, or nobody can attack.
 */
export function attackTogether(state: ScenarioState, ctx: ReduceContext, may: (id: string) => boolean = () => true): PlayerIntent | null {
  if (state.window?.kind !== "playerAttack" || !legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) return null;
  const seat = state.activeSeat;
  const ready = characters(state, seat, ctx.cards).filter((id) => may(id) && legalTargets(state, { type: "DeclareAttackers", cardId: id }, ctx).length > 0);
  const enemy = ready.map((id) => legalAttackEnemies(state, seat, id, ctx.cards)[0]).find((id) => id != null);
  const attackers = ready.filter((id) => enemy != null && legalAttackEnemies(state, seat, id, ctx.cards).includes(enemy));
  return enemy && attackers.length > 0 ? { type: "DeclareAttackers", enemyId: enemy, attackerIds: attackers } : null;
}

/**
 * In the optional engagement step: the seat engages the first enemy it may, one at a time, while it is engaged with fewer
 * enemies than `most` (by default its hero count). Null otherwise, and the auto-player declines.
 */
export function engageOneEach(state: ScenarioState, ctx: ReduceContext, most?: number): PlayerIntent | null {
  if (state.window?.kind !== "optionalEngage") return null;
  const seat = state.seats[state.activeSeat];
  const enemy = legalTargets(state, { type: "Engage" }, ctx)[0];
  return enemy && seat && seat.engaged.length < (most ?? seat.heroes.length) ? { type: "Engage", enemyId: enemy } : null;
}
