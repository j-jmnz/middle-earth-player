// Rules: mec112.wizardry (data/rules/entries.json); ledger lines 143062:A:1, 143047:A:2, 143052:A:1, 143080:B:2.
// The Wizardry timing of The Road to Isengard: a location's Wizardry effect triggers when it is explored (the core hears the exploring as the location leaves play and the record's trigger `wizardry` answers it),
// when Machines of Isengard triggers the active location's, and when Saruman resolves a shadow card's for the defending player alone (trigger.ts); the enemies that hear a Wizardry shadow card are told as the
// shadow step ends (shadow.ts); the last stage takes back the progress placed this phase (progress.ts).
import type { Condition, Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { cancelPhaseProgress } from "./progress.ts";
import { activeHasWizardry, triggerWizardry } from "./trigger.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "TriggerWizardry":
      return triggerWizardry(state, instruction, focus, ctx, steps);
    case "CancelPhaseProgress":
      return cancelPhaseProgress(state, steps);
    default:
      return null;
  }
}

// "If no Wizardry effect is triggered this way" (143062:A:1): the active location prints none, or there is no active location.
function condition(state: ScenarioState, found: Condition, seat: number, ctx: ReduceContext): boolean | null {
  return found.kind === "hasWizardry" ? activeHasWizardry(state, seat, ctx) : null;
}

export const manifest: RulesFamily = {
  name: "wizardry",
  verbs: ["TriggerWizardry", "CancelPhaseProgress"],
  run,
  condition: (state, found, scope, ctx) => condition(state, found, scope.actor, ctx),
};
