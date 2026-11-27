// Test helper. The first player's choice of the order the Forced effects of one moment initiate in (rr.forced; the OrderForced verb, src/rules/families/encounter/forced-order.ts).
import type { EngineStep } from "../../src/rules/core/intents.ts";
import { settle } from "../../src/rules/engine/machine.ts";
import type { ScenarioState } from "../../src/rules/engine/reduce.ts";
import type { ReduceContext } from "../../src/rules/interpret/interpret.ts";
import { applyChoice } from "../../src/rules/windows/choices.ts";
import { topFrame } from "../../src/rules/windows/windows.ts";

/** Whether the open choice is that order. */
export function asksForcedOrder(state: ScenarioState): boolean {
  const data = topFrame(state)?.data;
  const wait = data?.kind === "effect" ? data.wait : null;
  return state.window?.kind === "choose" && wait?.kind === "target" && wait.item.instruction.verb === "OrderForced";
}

/** The order questions of a settled state answered with their first option (the order the engine took before the first player chose), while one is open. */
export function inForcedOrder(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (let guard = 0; guard < 8 && next.window?.kind === "choose" && asksForcedOrder(next); guard += 1) next = settle(applyChoice(next, next.window.options[0] ?? ""), ctx, steps);
  return next;
}
