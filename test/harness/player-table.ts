import type { Effect } from "../../src/catalog/boundary.ts";
import { modifiedStat } from "../../src/rules/core/keywords.ts";
import { withMode, type ScenarioState } from "../../src/rules/core/state.ts";
import { settle } from "../../src/rules/engine/machine.ts";
import { legalIntents, type PlayerIntent, type ReduceContext } from "../../src/rules/engine/reduce.ts";
import { syncConstants } from "../../src/rules/interpret/constants.ts";
import { fund, starterBase } from "../scenarios/a-shadow-of-the-past/starter-scene.ts";

import { causeProblems } from "./cause-check.ts";
import { accepted, begin, buildTable, type Run, type Scene, type Table } from "./scene.ts";

// Test helper. The table and the readers that the player-card tests (src/campaign/player-cards) share: a table on the records under test with every
// seat's heroes funded and the constants brought up to date as the reducer does after an intent, the intents the engine offers, a stat as the
// game reads it, and the combat windows. Each test file keeps its own `base` (the printed cards it loads) and passes it in.

export type PlayerBase = Awaited<ReturnType<typeof starterBase>>;

/** The table on the records under test: each seat's heroes hold `resources`, the constants are up to date. */
export function playerTable(base: PlayerBase, effects: readonly Effect[], scene: Scene = {}, resources = 6): Table {
  const tab = buildTable(base, { ring: "none", start: "planning", ...scene, effects });
  let state = tab.state;
  for (let seat = 0; seat < (scene.seats ?? 1); seat += 1) state = fund(state, seat, resources);
  return { ...tab, state: syncConstants(state, tab.ctx) };
}

/** The effect ids of the Trigger intents the engine offers. */
export function triggers(state: ScenarioState, tab: Table): string[] {
  return legalIntents(state, tab.ctx).flatMap((intent) => (intent.type === "Trigger" ? [intent.effectId] : []));
}

/** The option ids of the Choose intents the engine offers. */
export function choices(state: ScenarioState, tab: Table): string[] {
  return legalIntents(state, tab.ctx).flatMap((intent) => (intent.type === "Choose" ? [intent.optionId] : []));
}

/** A stat as the game reads it, modifiers included. */
export function stat(state: ScenarioState, tab: Table, id: string, which: "attack" | "defense" | "hitPoints" | "willpower" | "threat"): number {
  const card = state.cards[id];
  if (!card) throw new Error(`no card ${id}`);
  return modifiedStat(state, card, which, tab.ctx.cards);
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
