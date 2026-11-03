// Rules: dcce.island-map, dcce.exploration (data/rules/entries.json). The verbs src/catalog/families/island.ts adds. The map itself is island/map.ts, traveling on it island/travel.ts, the Gate Key,
// the secrets and the Temple Guardian island/cards.ts, and what a pick or an amount reads of the map island/pick.ts.
import type { Instruction } from "../../../catalog/boundary.ts";

import { lastPicked } from "../../player-verbs.ts";
import type { EngineStep } from "../../intents.ts";
import type { ReduceContext } from "../../interpret.ts";
import type { ScenarioState } from "../../state.ts";
import type { Focus } from "../index.ts";
import { attachGuarded, engageFromVictory, flipSecret, lookAtSecret, placeProgressInStaging, placeSecrets, raiseThreatToAttach, shuffleIntoPlayerDeck } from "./cards.ts";
import { prepareMap, revealCorners, setActive } from "./map.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "PrepareIslandMap":
      return prepareMap(state, instruction.temple);
    case "RevealIslandCorners":
      return revealCorners(state);
    case "SetIslandActive":
      return setActive(state, lastPicked(state));
    case "AttachGuarded":
      return attachGuarded(state, instruction, ctx);
    case "PlaceSecrets":
      return placeSecrets(state, instruction);
    case "FlipSecret":
      return flipSecret(state, focus, ctx, steps);
    case "LookAtSecret":
      return lookAtSecret(state, focus);
    case "EngageFromVictory":
      return engageFromVictory(state, instruction, focus, ctx, steps);
    case "PlaceProgressInStaging":
      return placeProgressInStaging(state, instruction, focus, ctx, steps);
    case "ShuffleIntoPlayerDeck":
      return shuffleIntoPlayerDeck(state, instruction, focus, steps);
    case "RaiseThreatToAttach":
      return raiseThreatToAttach(state, instruction, focus, ctx, steps);
    default:
      return null;
  }
}
