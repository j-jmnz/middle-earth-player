import type { Instruction } from "../../catalog/boundary.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import type { ScenarioState } from "../state.ts";
import type { Focus } from "./index.ts";

// The verbs src/catalog/families/attack.ts adds, for player attacks: attack modifiers and targets, immediate attacks, attacks into the staging area. Null when the verb is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  void state;
  void instruction;
  void focus;
  void ctx;
  void steps;
  return null;
}
