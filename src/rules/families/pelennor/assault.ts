// Rules: mec113.assault, rr.active-location, rr.quest-advancement (data/rules/entries.json); ledger lines 145075:B:1, 145075:B:4, 145076:B:1.
// Assault: the quest resolution of stage 3B (a failed quest damages Minas Tirith instead of raising threat) and the progress an enemy's destruction places on the stage after the active location.
import type { Instruction } from "../../../catalog/boundary.ts";

import { ruleCause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { placeDamage } from "../../core/keywords.ts";
import type { PrintedCard } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged } from "../../core/state.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { QuestTotals } from "../../interpret/family-manifest.ts";
import { questPointsOf, putOnStage } from "../../quest/quest.ts";
import { restricted } from "../../interpret/restrictions.ts";
import { afterProgress } from "../../quest/stage-reveal.ts";
import { placeOnActive } from "../south/locations.ts";
import type { Focus } from "../index.ts";

type Cards = ReadonlyMap<string, PrintedCard>;

/** A quest that fails under Assault: the players raise no threat, and the group deals the shortfall as damage to Minas Tirith, once (mec113.assault). Null for a quest that does not fail or a stage without the keyword. */
export function assaultQuestResult(state: ScenarioState, totals: QuestTotals, cards: Cards, steps: EngineStep[], minasTirith: string | undefined): ScenarioState | null {
  const stageId = state.questStage;
  if (totals.only != null || !stageId || !flagged(state, stageId, "assault") || totals.threat <= totals.willpower) return null;
  return minasTirith ? placeDamage(state, minasTirith, totals.threat - totals.willpower, cards, steps, "quest", ruleCause("mec113.assault")) : state;
}

/** PlaceProgressActiveFirst: the active location takes what it can, the current quest stage the rest (it advances when full). */
export function placeProgressActiveFirst(state: ScenarioState, instruction: Extract<Instruction, { verb: "PlaceProgressActiveFirst" }>, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const amount = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  if (amount <= 0) return state;
  const before = steps.length;
  const onActive = placeOnActive(state, amount, ctx.cards, steps);
  let next = onActive.state;
  const stageId = next.questStage;
  const stage = stageId ? next.cards[stageId] : undefined;
  if (onActive.remaining > 0 && stageId && stage && !next.stageCleared) {
    const canAdvance = (current: ScenarioState): boolean => restricted(current, ctx, "advance").length === 0;
    next = putOnStage(next, stageId, onActive.remaining, questPointsOf(next, stage, ctx.cards), ctx.cards, steps, canAdvance, ruleCause("mec113.assault"), false);
  }
  return afterProgress(next, before, ctx, steps);
}
