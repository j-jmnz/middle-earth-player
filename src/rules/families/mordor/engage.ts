// Rules: rr.engaged, rr.constant-ability, rr.cannot (data/rules/entries.json); ledger lines 21066:A:2, 21066:A:3, 21058:A:1 (docs/scenarios/vengeance-of-mordor/the-temple-of-doom.md, Readings).
// The enemies that engage by a constant line: Khamûl the Easterling engages the first player and Ulchor's Guard engages the player Thane Ulchor is engaged with (the flags `engagesFirstPlayer` and `engagesWithUlchor`, swept once nothing is resolving),
// and the enemy only the player it is engaged with can defend against (`defendOnlyByEngaged`; the attack side is the pelennor flag `attackOnlyByEngaged`).
import type { PrintedCard } from "../../core/printed.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { engageEnemies } from "../ring-maker/engage.ts";

const ULCHOR = "21054";
const FLAGS: readonly string[] = ["engagesFirstPlayer", "engagesWithUlchor"];

/** The seat Thane Ulchor is engaged with, or null. */
function ulchorSeat(state: ScenarioState): number | null {
  const ulchor = Object.values(state.cards).find((card) => card.code === ULCHOR && card.zone === "engaged");
  return ulchor?.controller ?? null;
}

/** The settle sweep: each enemy that holds `engagesFirstPlayer` engages the first player, each that holds `engagesWithUlchor` the seat Ulchor is engaged with (and stays where it is while he is engaged with none). */
export function engageSweep(state: ScenarioState, _ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.modifiers.length === 0 || state.stack.length > 0 || state.lost || state.failure || state.pendingAttack || state.pendingStrike) return state;
  if (!state.modifiers.some((modifier) => FLAGS.includes(modifier.stat))) return state;
  return engageEnemies(state, steps, (next, id) => (flagged(next, id, "engagesFirstPlayer") ? next.firstPlayer : flagged(next, id, "engagesWithUlchor") ? ulchorSeat(next) : null));
}

/** "Only the engaged player can declare ... defenders against" an enemy (21066:A:3): a character of another seat cannot defend the attack of the enemy in progress. */
export function defenderBarredByEngagement(state: ScenarioState, _defender: PrintedCard, _cards: ReadonlyMap<string, PrintedCard>, defenderId: string): string | null {
  const enemyId = state.pendingAttack?.enemyId;
  if (enemyId == null || !flagged(state, enemyId, "defendOnlyByEngaged")) return null;
  const enemy = state.cards[enemyId];
  return enemy?.zone === "engaged" && state.cards[defenderId]?.controller === enemy.controller ? null : "Only the engaged player can declare defenders against that enemy";
}
