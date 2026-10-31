// Rules: dcce.stormcallers-area, dcce.stormcallers-area-stages, dcce.campaign-mode (data/rules/entries.json). The verbs src/catalog/families/stormcaller.ts adds. The area and its cards are in
// stormcaller-area.ts, the Stormcaller's quest stage in stormcaller-stage.ts, what a record reads in stormcaller-values.ts.
import type { Instruction } from "../../catalog/boundary.ts";

import { lastPicked } from "../player-verbs.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import type { ScenarioState } from "../state.ts";
import type { Focus } from "./index.ts";
import { flipStormcaller, moveToStormcallerArea, prepareStormcallerArea } from "./stormcaller-area.ts";
import { moveProgressToStormcaller, stormcallerProgress } from "./stormcaller-stage.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "PrepareStormcallerArea":
      return prepareStormcallerArea(state, instruction, ctx);
    case "FlipStormcaller":
      return flipStormcaller(state);
    case "MoveProgressToStormcaller":
      return moveProgressToStormcaller(state, instruction, focus, ctx, steps);
    case "StormcallerProgress":
      return stormcallerProgress(state, ctx, steps);
    case "MoveToStormcallerArea":
      return moveToStormcallerArea(state, instruction.target === "picked" ? lastPicked(state) : focus.sourceId);
    // The stage's definition carries the number (catalog/scenario-data.ts stageOf): nothing runs when the record is resolved.
    case "CatchUpWins":
      return state;
    default:
      return null;
  }
}
