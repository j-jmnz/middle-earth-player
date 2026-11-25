// Rules: rr.optional-engagement, rr.engaged (data/rules/entries.json); ledger lines 05042:A:1, 05043:A:1, 05044:A:1.
// What the engine notes for the optional engagement step of Peril in Pelargir: an engagement the player chose. It is noted only in a game with a record that reads it, so no other game's state moves.
import { gameReads } from "../../core/game-reads.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";

/** The player optionally engages the enemy (the `Engage` intent of the optional engagement step): the enemy is marked `engagedOptionally` until the phase ends, before the engagement is announced, in a game with a record that reads the flag. */
export function noteOptionalEngage(state: ScenarioState, enemyId: string, ctx: ReduceContext): ScenarioState {
  if (!state.cards[enemyId] || !gameReads(state, ctx, '"stat":"engagedOptionally"')) return state;
  return { ...state, modifiers: [...state.modifiers, { instanceId: enemyId, sourceId: enemyId, stat: "engagedOptionally", amount: 1, until: "endOfPhase" }] };
}
