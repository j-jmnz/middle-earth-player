// Rules: mec112.setup-journey-to-the-cross-roads (data/rules/entries.json). The verbs src/catalog/families/harad.ts adds, and the condition `facedownUnder` (under.ts).
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { facedownUnderHolds, placeFacedownUnder } from "./under.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  return instruction.verb === "PlaceFacedownUnder" ? placeFacedownUnder(state, instruction, focus, ctx, steps) : null;
}

export const manifest: RulesFamily = {
  name: "harad",
  condition: (state, condition) => (condition.kind === "facedownUnder" ? facedownUnderHolds(state, condition) : null),
  verbs: ["PlaceFacedownUnder"],
  run,
};
