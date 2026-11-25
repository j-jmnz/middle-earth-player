// Rules: rr.quest-advancement, rr.removed-from-game, ats.cair-andros-remove-stage (data/rules/entries.json); ledger lines 05068:B:2, 05069:B:4, 05033:A:2.
// A stage that bypasses the next one when it is completed ("advance to stage 3A (bypassing stage 2)"). A constant on the stage sets `skipsNextStage` while its condition holds. In The Siege of Cair Andros a stage is also bypassed when it was removed from the quest deck.
import { flagged, type ScenarioState } from "../../core/state.ts";

const SIEGE = "the-siege-of-cair-andros";

/** advanceStage's next stage code when the stage being left holds `skipsNextStage`: the stage after the next one in the quest's order. In The Siege of Cair Andros, the first later stage that is still in the quest deck. Undefined when neither applies, so the caller reads the ordinary next stage. */
export function skippedStage(state: ScenarioState, currentId: string, index: number): string | undefined {
  if (state.scenarioId === SIEGE && index >= 0) return state.stages.slice(index + 1).find((stage) => state.questDeck.some((id) => state.cards[id]?.code === stage.code))?.code;
  if (state.modifiers.length === 0 || index < 0 || !flagged(state, currentId, "skipsNextStage")) return undefined;
  return state.stages[index + 2]?.code;
}
