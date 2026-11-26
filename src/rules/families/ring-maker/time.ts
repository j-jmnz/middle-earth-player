// Rules: mec108.time-x, rr.current-quest (data/rules/entries.json); ledger lines 07020:A:2, 07022:A:1.
// Cards of The Fords of Isen that take time counters off the current quest stage: the stage's Time X (families/angmar/time.ts) holds the counters, and each one that comes off is taken by the same helper the refresh phase uses, so the last one is heard.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { removeTimeCounterFrom, timeOf } from "../angmar/time.ts";
import type { Focus } from "../index.ts";

/** RemoveTimeFromQuest: up to `amount` time counters come off the current quest stage, one at a time. A stage with no Time X, or with no counter left, loses none. */
export function removeTimeFromQuest(state: ScenarioState, instruction: Extract<Instruction, { verb: "RemoveTimeFromQuest" }>, focus: Focus, ctx: ReduceContext, _steps: EngineStep[]): ScenarioState {
  const stage = state.questStage ? state.cards[state.questStage] : undefined;
  if (!stage || timeOf(ctx, stage.code) == null) return state;
  const amount = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  let next = state;
  for (let removed = 0; removed < amount && (next.cards[stage.id]?.resources ?? 0) > 0; removed += 1) next = removeTimeCounterFrom(next, stage.id, ctx);
  return next;
}
