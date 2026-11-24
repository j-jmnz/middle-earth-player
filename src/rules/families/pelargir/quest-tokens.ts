// Rules: rr.quest-advancement, rr.current-quest (data/rules/entries.json); ledger lines 06014:A:2, 06025:A:2.
// Tokens taken off the current quest card: its progress tokens and the resource tokens the Clues and the stages 1 and 2 of The Steward's Fear place on it.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";

/** RemoveQuestTokens: up to `amount` tokens (all of the kind by default) leave the current quest card, progress first when both kinds are named. No current quest, or no token: nothing happens. */
export function removeQuestTokens(state: ScenarioState, instruction: Extract<Instruction, { verb: "RemoveQuestTokens" }>): ScenarioState {
  const card = state.questStage ? state.cards[state.questStage] : undefined;
  if (!card) return state;
  let left = instruction.amount == null || instruction.amount === "all" ? Number.POSITIVE_INFINITY : instruction.amount;
  let progress = card.progress;
  let resources = card.resources;
  if (instruction.kind !== "resource") {
    const taken = Math.min(left, progress);
    progress -= taken;
    left -= taken;
  }
  if (instruction.kind !== "progress") resources -= Math.min(left, resources);
  return progress === card.progress && resources === card.resources ? state : updateCard(state, card.id, { progress, resources });
}
