// Rules: docs/scenarios/standalone-scenarios.md (The Battle of Lake-town), rr.step-3-4, rr.quest-advancement, rr.damage (data/rules/entries.json); ledger lines 50202:B:2, 50203:B:3.
// Stage 2B: when the players quest successfully, any number of the progress tokens that would be placed on the quest card (after the active location took its share) may be discarded instead to remove as much damage from Lake-town. The quest
// holds the flag `progressHealsLakeTown`, so the progress is not placed (quest/quest.ts, PROGRESS_REPLACED) and the stage's record hears it as `progressReplaced` with the amount, which this verb answers: the first player chooses how many to discard (at most
// the damage on Lake-town), and the rest goes on the quest card as usual. Stage 3B's reading of the score is the amounts `lakeTownDamage` and `victoryDisplay` (amounts.ts).
import type { Instruction } from "../../../catalog/boundary.ts";
import { currentCause, ruleCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ScenarioState } from "../../core/state.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { restricted } from "../../interpret/restrictions.ts";
import { putOnStage, questPointsOf } from "../../quest/quest.ts";
import { changeDamageOn } from "../moria/index.ts";
import { openBranch } from "../../windows/choices.ts";
import type { Focus } from "../index.ts";
import { lakeTownId } from "./cards.ts";

type Heal = Extract<Instruction, { verb: "HealLakeTownByProgress" }>;

// The progress that was not discarded goes on the current quest card (rr.step-3-4): the active location took its share before the stage was asked.
function placeRest(state: ScenarioState, amount: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const stageId = state.questStage;
  const stage = stageId == null ? undefined : state.cards[stageId];
  if (stageId == null || stage == null || amount <= 0 || state.stageCleared) return state;
  const gate = (current: ScenarioState) => !restricted(current, ctx, "advance").length;
  return putOnStage(state, stageId, amount, questPointsOf(state, stage, ctx.cards), ctx.cards, steps, gate, ruleCause("rr.step-3-4"), { counted: true });
}

/** HealLakeTownByProgress: the progress that was replaced is `progress` (the event's X on the first call). The first player chooses how many tokens to discard; that much damage comes off Lake-town and the rest of the progress is placed on the stage. */
export function healByProgress(state: ScenarioState, instruction: Heal, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const progress = instruction.progress ?? resolveAmount(state, { x: true }, frameScope(state, focus.seat, focus.sourceId), ctx);
  const lake = lakeTownId(state);
  const card = lake == null ? undefined : state.cards[lake];
  if (instruction.heal == null) {
    const most = card == null ? 0 : Math.min(progress, card.damage);
    if (most <= 0) return placeRest(state, progress, ctx, steps);
    const options = Array.from({ length: most + 1 }, (_, heal) => ({ id: `discard:${heal}`, instructions: [{ verb: "HealLakeTownByProgress" as const, progress, heal }] }));
    return openBranch(state, { instruction: { verb: "Choose", who: "firstPlayer", options }, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, 0, ctx);
  }
  const healed = card == null ? 0 : Math.min(instruction.heal, card.damage);
  let next = state;
  if (card != null && healed > 0) next = changeDamageOn(next, card.id, -healed, steps, ctx);
  return placeRest(next, progress - healed, ctx, steps);
}
