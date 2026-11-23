// Rules: rr.attachment-cards, rr.objective-cards, rr.first-player, rr.damage, rr.reveal, rr.optional-engagement, rr.running-out-of-cards (data/rules/entries.json); the cards of Peril in Pelargir (05019 to 05024, 05037 to 05045, 05065 to 05067).
import type { Instruction } from "../../../catalog/boundary.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { discardEncounterTopMore } from "./discard.ts";
import { noteFirstEnemy, pelargirCondition } from "./first-enemy.ts";
import { attachToHighestThreatCost } from "./host.ts";
import { attachObjectiveTo, attackScrollHolder } from "./scroll.ts";

// The verbs src/catalog/families/pelargir.ts adds. Null when the verb is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "AttachObjectiveTo":
      return attachObjectiveTo(state, instruction, focus, ctx);
    case "AttachToHighestThreatCost":
      return attachToHighestThreatCost(state, instruction, focus, ctx, steps);
    case "AttackScrollHolder":
      return attackScrollHolder(state, instruction, focus, ctx, steps);
    case "DiscardEncounterTopMore":
      return discardEncounterTopMore(state, instruction, focus, ctx, steps);
    default:
      return null;
  }
}

export const manifest: RulesFamily = {
  name: "pelargir",
  verbs: ["AttachObjectiveTo", "AttachToHighestThreatCost", "AttackScrollHolder", "DiscardEncounterTopMore"],
  run,
  condition: (state, condition, scope) => pelargirCondition(state, condition, scope),
  revealed: noteFirstEnemy,
};
