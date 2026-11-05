// Rules: emce.treasure, emce.boon-allies, emce.campaign-pool-encounter, emce.campaign-log, rr.guarded (data/rules/entries.json).
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Condition, Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { logCondition } from "./log.ts";
import { attachRandomTreasure } from "./treasure.ts";

// The verbs src/catalog/families/wilderland.ts adds. AttachRandomTreasure runs in the game. The others are not run by the engine: the Resolution
// ones (DiscoverTreasure, BoonAllyOrLogLine, AddEncounterToPool, RemoveFromPool) are run by rules/setup/resolution.ts, and RemoveFromEncounterDeckIfLogged is dealt by
// the campaign checklist (campaign/checklist.ts), so they change nothing here.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "AttachRandomTreasure":
      return attachRandomTreasure(state, instruction, focus, ctx, steps);
    case "DiscoverTreasure":
    case "BoonAllyOrLogLine":
    case "AddEncounterToPool":
    case "RemoveFromPool":
    case "RemoveFromEncounterDeckIfLogged":
      return state;
    default:
      return null;
  }
}

// The conditions that read the Campaign Log's facts (log.ts). A game dealt without the facts holds neither.
function condition(state: ScenarioState, found: Condition): boolean | null {
  return logCondition(found, state.campaignFacts);
}

export const manifest: RulesFamily = { name: "wilderland", condition, verbs: ["AttachRandomTreasure", "DiscoverTreasure", "BoonAllyOrLogLine", "AddEncounterToPool", "RemoveFromPool", "RemoveFromEncounterDeckIfLogged"], run };
