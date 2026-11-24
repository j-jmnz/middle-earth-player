// Rules: rr.quest-advancement, rr.removed-from-game (data/rules/entries.json); ledger lines 05068:B:2, 05069:B:4.
// A stage that bypasses the next one when it is completed ("advance to stage 3A (bypassing stage 2)"). A constant on the stage sets `skipsNextStage` while its condition holds.
import { flagged, type ScenarioState } from "../../core/state.ts";

/** advanceStage's next stage code when the stage being left holds `skipsNextStage`: the stage after the next one in the quest's order. Undefined when it does not, so the caller reads the ordinary next stage. */
export function skippedStage(state: ScenarioState, currentId: string, index: number): string | undefined {
  if (state.modifiers.length === 0 || index < 0 || !flagged(state, currentId, "skipsNextStage")) return undefined;
  return state.stages[index + 2]?.code;
}
