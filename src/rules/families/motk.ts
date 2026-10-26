import type { Instruction } from "../../catalog/boundary.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import type { ScenarioState } from "../state.ts";
import type { Focus } from "./index.ts";

// The verbs src/catalog/families/motk.ts adds, for the Messenger of the King hero versions of allies (codes 99<ally code>). Null when the verb is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  void state;
  void instruction;
  void focus;
  void ctx;
  void steps;
  return null;
}
