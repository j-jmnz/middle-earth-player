// Rules: dcce.aflame, dcce.stormcaller-elite, dcce.scalable-upgradable (data/rules/entries.json). The verbs src/catalog/families/aflame.ts adds. The cards they move are in aflame/cards.ts, Aflame X itself
// (the end of the round and the sweep that places a burnt location underneath The Havens Burn) in aflame/sweep.ts, what a record reads in aflame/values.ts, aflame/pick.ts and aflame/attack.ts.
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { discardUntilAflame, engageFirstPlayer, healLocations, removeNamedFromGame, searchAflame, stageSetAside } from "./cards.ts";
import type { Focus } from "../index.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "DiscardUntilAflame":
      return discardUntilAflame(state, instruction, focus, ctx, steps);
    case "SearchAflame":
      return searchAflame(state, instruction, focus, ctx, steps);
    case "EngageFirstPlayer":
      return engageFirstPlayer(state, focus, steps);
    case "StageSetAside":
      return stageSetAside(state, instruction, focus, ctx, steps);
    case "RemoveNamedFromGame":
      return removeNamedFromGame(state, instruction, ctx);
    case "HealLocations":
      return healLocations(state, instruction, focus, ctx, steps);
    // A Resolution verb: rules/setup/resolution.ts earns the cards.
    case "EarnDealt":
      return state;
    default:
      return null;
  }
}

export const manifest: RulesFamily = { name: "aflame", verbs: ["DiscardUntilAflame", "SearchAflame", "EngageFirstPlayer", "StageSetAside", "RemoveNamedFromGame", "HealLocations", "EarnDealt"], run };
