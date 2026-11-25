// Rules: rr.constant-ability, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 16014:A:2, 16066:B:1, 16067:B:1.
//
// The main quest card of Escape from Umbar: "Seize Them!" loses the game at the end of a round the main quest card was in play for the whole of. The settle hook notes the round a quest card was first seen as a modifier
// of the table (`stageEntered`, the round as the amount, the card as the source), so the condition reads a stage in play from Setup (round 0) as present for round 1, and a stage revealed during a round as present from the next one.
import type { Condition } from "../../../catalog/boundary.ts";
import type { ScenarioState } from "../../core/state.ts";

/** Whether the table already holds a note for this stage card. */
function noted(state: ScenarioState, stageId: string): boolean {
  return state.modifiers.some((modifier) => modifier.instanceId === "table" && modifier.stat === "stageEntered" && modifier.sourceId === stageId);
}

/** The settle hook: notes the current main quest card with the round it is first seen in, once. Nothing is noted in a game with no `stageInPlayWholeRound` record, so no other scenario's state moves. */
export function noteStage(state: ScenarioState, wanted: boolean): ScenarioState {
  const stageId = state.questStage;
  if (!wanted || !stageId || state.stageCleared || noted(state, stageId)) return state;
  return { ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: stageId, stat: "stageEntered", amount: state.round, until: "whileSourceInPlay" }] };
}

/** `stageInPlayWholeRound`: the current main quest card was noted in an earlier round than this one. The card's own note is the only one active (an earlier stage has left play). */
export function stageInPlayWholeRound(state: ScenarioState): boolean {
  const stageId = state.questStage;
  if (!stageId || !noted(state, stageId)) return false;
  return state.modifiers.some((modifier) => modifier.instanceId === "table" && modifier.stat === "stageEntered" && modifier.sourceId === stageId && modifier.amount < state.round);
}

export function haradrimCondition(state: ScenarioState, condition: Condition): boolean | null {
  return condition.kind === "stageInPlayWholeRound" ? stageInPlayWholeRound(state) : null;
}
