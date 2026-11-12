// Rules: mec113.fortitude-tests, mec113.player-actions-during-fortitude-tests, rr.surge (data/rules/entries.json); ledger lines 146043:A:3, 146049:A:3, 146075:B:2. The verbs src/catalog/families/mount-doom.ts adds and the hooks the core calls: the Fortitude test (fortitude.ts, commit.ts, failures.ts),
// its conditions (conditions.ts) and pick filter (pick.ts), and the first treachery of each quest phase (treachery.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { livingSeats, type ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { fortitudeCondition } from "./conditions.ts";
import { ignoreEyes, pushFortitude } from "./fortitude.ts";
import { discardUntilLocations } from "./locations.ts";
import { noteFirstTreachery } from "./treachery.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "FortitudeTest":
      return pushFortitude(state, instruction, focus, ctx, steps);
    case "IgnoreFortitudeEyes":
      return ignoreEyes(state, lastPicked(state) || null);
    case "DiscardUntilLocations":
      return discardUntilLocations(state, instruction.perPlayer * livingSeats(state).length, ctx, steps);
    // A marker the reveal hook reads.
    case "FirstTreacheryImmuneSurge":
      return state;
    default:
      return null;
  }
}

export const manifest: RulesFamily = {
  name: "mount-doom",
  verbs: ["FortitudeTest", "IgnoreFortitudeEyes", "FirstTreacheryImmuneSurge", "DiscardUntilLocations"],
  run,
  condition: (state, condition, scope) => fortitudeCondition(state, condition, scope),
  revealed: noteFirstTreachery,
};
