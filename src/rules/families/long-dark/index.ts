// Rules: dwd.locate-test, dwd.locate-test-example, dwd.lost-effects, dwd.revealing-enemies (data/rules/entries.json); ledger lines 04087:B:1, 04092:A:1, 04095:A:1, 04099:A:2, 901605:A:1, 901607:A:1. The verbs src/catalog/families/long-dark.ts adds and the hooks the core calls: the locate test (locate.ts),
// the Lost timing (lost.ts), the progress a location holds back for its test (hold.ts, progress.ts), the surge an enemy gains as it is revealed (surge.ts), the pick filter of Gathering Ground (pick.ts) and the Travel effect that ends the travel (travel.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { longDarkCondition } from "./conditions.ts";
import { locateTest } from "./locate.ts";
import { triggerLost } from "./lost.ts";
import { placeHeldProgress } from "./progress.ts";
import { enemyGainsSurge } from "./surge.ts";
import { endTravel } from "./travel.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "LocateTest":
      return locateTest(state, instruction, focus, ctx, steps);
    case "TriggerLost":
      return triggerLost(state, instruction, focus, ctx, steps);
    case "PlaceHeldProgress":
      return placeHeldProgress(state, focus, ctx, steps);
    case "EndTravel":
      return endTravel(state);
    // A marker the revealed hook reads.
    case "EnemiesGainSurge":
      return state;
    default:
      return null;
  }
}

export const manifest: RulesFamily = {
  name: "long-dark",
  verbs: ["LocateTest", "TriggerLost", "PlaceHeldProgress", "EndTravel", "EnemiesGainSurge"],
  run,
  condition: (state, condition, scope, ctx) => longDarkCondition(state, condition, scope, ctx),
  revealed: enemyGainsSurge,
};
