// Rules: mec112.pursuit, mec112.setup-the-uruk-hai, rr.in-play-and-out-of-play (data/rules/entries.json). The Uruk-hai family: the pursuit value (pursuit.ts), the Captives (captive.ts) and the filters and amount that read them.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { loggedCaptiveMatches, runCaptive } from "./captive.ts";
import { runPursuit } from "./pursuit.ts";

// The verbs src/catalog/families/uruk.ts adds. Null when the verb is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, _steps: EngineStep[]): ScenarioState | null {
  return runPursuit(state, instruction, focus, ctx) ?? runCaptive(state, instruction, focus);
}

export const manifest: RulesFamily = {
  name: "uruk",
  verbs: ["SetPursuit", "RaisePursuit", "LowerPursuit", "TakeCaptive", "AttachCaptive", "ReturnCaptive"],
  run,
  // "X is the pursuit value" (143069:B:1): 0 while no tracker is set.
  amount: (state, amount) => (amount.pursuit === true ? (state.pursuit ?? 0) : null),
  // The `loggedCaptive` filter (143069:A:1).
  pick: (state, id, spec) => loggedCaptiveMatches(state, id, spec.loggedCaptive),
};
