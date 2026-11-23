// Rules: hob.riddles, hob.riddle-area (data/rules/entries.json); ledger lines 131029:B:1, 131031:B:3, 131075:A:1, 131076:A:1. What the riddle conditions and the riddle marker records read.
import type { Condition, Instruction } from "../../../catalog/boundary.ts";

import { constantInstructions } from "../../interpret/constant-records.ts";
import type { Scope } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { effectsOf } from "../../windows/listen.ts";
import { effectData } from "../encounter/moves.ts";
import { questPointsOf } from "../../quest/quest.ts";
import { shadowCards } from "../../core/zones.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { areaStage } from "./area.ts";

export type RiddleMarker = Extract<Instruction, { verb: "Riddle" }>;

/** The riddle a card prints (the marker of its constant record), or undefined for a card that prints none. */
export function riddleOf(ctx: Pick<ReduceContext, "effects">, code: string): RiddleMarker | undefined {
  for (const effect of effectsOf(ctx, code)) {
    if (effect.timing !== "constant") continue;
    for (const instruction of effect.instructions) if (instruction.verb === "Riddle") return instruction;
  }
  return undefined;
}

/** Whether a card in play ignores riddles: stage 3B's constant (131031:B:3, "All riddle effects are ignored"). */
export const riddlesIgnored = (state: ScenarioState, ctx: ReduceContext): boolean => constantInstructions(state, ctx).some(({ instruction }) => instruction.verb === "IgnoreRiddles");

// A stage is complete when it holds its quest points: a stage with no quest points never is.
function complete(state: ScenarioState, stage: CardInstance | undefined, ctx: ReduceContext): boolean {
  const points = stage ? questPointsOf(state, stage, ctx.cards) : null;
  return stage != null && points != null && stage.progress >= points;
}

// The reveal frame of the source card, revealed from the encounter deck: the first player may answer its riddle.
function revealedFromDeck(state: ScenarioState, sourceId: string | null): boolean {
  return sourceId != null && state.stack.some((frame) => frame.frame === "reveal" && frame.cardId === sourceId && frame.data.kind === "reveal" && frame.data.fromDeck === true && frame.data.canceled !== true);
}

/** The riddle conditions (`riddle` with `is`), or null for any other condition. */
export function riddleHolds(state: ScenarioState, condition: Condition, scope: Scope, ctx: ReduceContext): boolean | null {
  if (condition.kind !== "riddle") return null;
  switch (condition.is) {
    // Stage 1 and stage 2 both hold their quest points; with stage 2 gone (stage 3 reached) only the current stage counts.
    case "complete": {
      const current = state.questStage ? state.cards[state.questStage] : undefined;
      const second = areaStage(state);
      return complete(state, current, ctx) && (second == null || complete(state, second, ctx));
    }
    case "offered":
      return revealedFromDeck(state, scope.sourceId) && !riddlesIgnored(state, ctx);
    case "shadow":
      return shadowCards(scope.sourceId ? state.cards[scope.sourceId] : undefined).some((id) => riddleOf(ctx, state.cards[id]?.code ?? "") != null);
    case "answering":
      return effectData(state)?.named?.includes("riddle:open") === true;
  }
}
