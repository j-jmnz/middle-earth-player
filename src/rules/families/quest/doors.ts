// Rules: dwd.doors-of-durin, rr.active-location, rr.current-quest (data/rules/entries.json); ledger line 04065:A:1.
//
// "Progress tokens that would be placed on Doors of Durin are instead placed on the current quest card": a location that holds `progressToQuest` (its constant) takes none, from a card effect (questing places none on it: it has no quest
// points, so the active location takes none and the stage gets the whole total). What would be placed goes on the main quest stage, as a quest card takes progress from a card effect; the location is never explored.
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { restricted } from "../../interpret/restrictions.ts";
import { putOnStage, questPointsOf } from "../../quest/quest.ts";
import { afterProgress } from "../../quest/stage-reveal.ts";

/** The location holds `progressToQuest`: its progress goes to the quest stage. */
export function sendsProgressToQuest(state: ScenarioState, id: string): boolean {
  return state.modifiers.length > 0 && flagged(state, id, "progressToQuest");
}

/** `amount` progress that would be placed on a location holding `progressToQuest` goes on the current quest stage (the advance it makes is announced). */
export function progressToQuest(state: ScenarioState, amount: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const stageId = state.questStage;
  const quest = stageId ? state.cards[stageId] : undefined;
  if (!stageId || !quest || amount <= 0 || state.stageCleared) return state;
  const before = steps.length;
  const placed = putOnStage(state, stageId, amount, questPointsOf(state, quest, ctx.cards), ctx.cards, steps, (current) => restricted(current, ctx, "advance").length === 0, currentCause(steps, UNATTRIBUTED), { counted: false });
  return afterProgress(placed, before, ctx, steps);
}
