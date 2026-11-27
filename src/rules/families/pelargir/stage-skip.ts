// Rules: rr.quest-advancement, rr.removed-from-game, ats.cair-andros-remove-stage (data/rules/entries.json); ledger lines 05068:B:2, 05069:B:4, 05033:A:2.
// A stage that bypasses the next one when it is completed ("advance to stage 3A (bypassing stage 2)"). A constant on the stage sets `skipsNextStage` while its condition holds. A stage that RemoveStage took out of the quest deck is bypassed too (the card holds `removedStage`).
import { flagged, type ScenarioState } from "../../core/state.ts";

/** advanceStage's next stage code when the stage being left holds `skipsNextStage`: the stage after the next one in the quest's order. When a stage was removed from the quest, the first later stage that is still in the quest deck. Undefined when neither applies, so the caller reads the ordinary next stage. */
export function skippedStage(state: ScenarioState, currentId: string, index: number): string | undefined {
  if (index >= 0 && Object.values(state.cards).some((card) => card.removedStage === true)) return state.stages.slice(index + 1).find((stage) => state.questDeck.some((id) => state.cards[id]?.code === stage.code))?.code;
  if (state.modifiers.length === 0 || index < 0 || !flagged(state, currentId, "skipsNextStage")) return undefined;
  return state.stages[index + 2]?.code;
}
