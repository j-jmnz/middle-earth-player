// Rules: hob.burgle (data/rules/entries.json); ledger lines 132039:A:2, 132043:A:2, 132072:B:1, 132072:B:2, 132041:A:3. The result of the last burgle attempt an effect made, noted on that effect's frame for `burgleSucceeded` and `burgleFailed`, and the other conditions the burgle family reads.
import type { Condition } from "../../../catalog/boundary.ts";

import type { ReduceContext } from "../../interpret/interpret.ts";
import type { Scope } from "../../interpret/conditions.ts";
import type { ScenarioState } from "../../core/state.ts";
import { patchTop, topFrame } from "../../windows/windows.ts";
import { burgleEffectOf, nearestBurgle } from "./match.ts";

/** The attempt just finished is noted on the effect that made it. */
export function noteEffectBurgle(state: ScenarioState, success: boolean): ScenarioState {
  const top = topFrame(state);
  if (top?.data.kind !== "effect") return state;
  return patchTop(state, { data: { ...top.data, burgle: success ? "succeeded" : "failed" } });
}

/** Whether a burgle attempt is in its action window (after step 2, before step 3): the window the burgle frame opened is the open one. */
export function burgleActionWindow(state: ScenarioState): boolean {
  const top = topFrame(state);
  return top?.data.kind === "burgle" && top.step === 2 && state.window?.kind === "frameAction";
}

/** The burgle family's conditions, or null for any other. */
export function burgleCondition(state: ScenarioState, condition: Condition, scope: Scope, ctx: ReduceContext): boolean | null {
  switch (condition.kind) {
    case "burgleSucceeded":
    case "burgleFailed": {
      const data = topFrame(state)?.data;
      return data?.kind === "effect" && data.burgle === (condition.kind === "burgleSucceeded" ? "succeeded" : "failed");
    }
    case "burgling":
      return burgleActionWindow(state) && scope.actor === state.firstPlayer;
    case "burgleCanDiscard": {
      const found = nearestBurgle(state);
      return found != null && found.frame.data.need > 0 && found.frame.data.matching.length >= found.frame.data.need;
    }
    case "shadowBurgle": {
      const code = scope.other != null ? state.cards[scope.other]?.code : undefined;
      return code != null && burgleEffectOf(ctx, code) != null;
    }
    default:
      return null;
  }
}
