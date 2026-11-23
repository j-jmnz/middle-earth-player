// Rules: hob.riddle-area, hob.riddles, hob.riddles-steps-2-and-3 (data/rules/entries.json); ledger lines of the Dungeons Deep and Caverns Dim cards (docs/scenarios/the-hobbit.md, Dungeons Deep and Caverns Dim).
// The verbs and hooks src/catalog/families/riddles.ts adds: the riddle area (area.ts), answering a riddle (answer.ts), the riddle cards as they are revealed (reveal.ts), Gollum's attack on Bilbo and who may defend (gollum.ts) and the riddle conditions (conditions.ts).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { answerRiddle, riddleStep } from "./answer.ts";
import { areaIds, createRiddleArea, gollumEngagesFirstPlayer, leaveRiddleArea, placeInRiddleArea } from "./area.ts";
import { riddleHolds } from "./conditions.ts";
import { defenseReason, gollumAttacksBilbo, undefendedTargets } from "./gollum.ts";
import { treacheryGainsSurge } from "./surge.ts";
import { discardUntilRiddle, nameEncounterType, removeRiddleProgress, resolveNormally } from "./reveal.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "CreateRiddleArea":
      return createRiddleArea(state, instruction, focus, ctx, steps);
    case "PlaceInRiddleArea":
      return placeInRiddleArea(state, instruction, ctx);
    // Markers on constant records: AnswerRiddle reads the riddle, riddlesIgnored reads the stage's marker.
    case "Riddle":
    case "IgnoreRiddles":
    case "TreacheriesGainSurge":
      return state;
    case "AnswerRiddle":
      return answerRiddle(state, instruction, focus, ctx, steps);
    case "RiddleStep":
      return riddleStep(state, instruction, focus, ctx, steps);
    case "ResolveNormally":
      return resolveNormally(state, focus, ctx, steps);
    case "DiscardUntilRiddle":
      return discardUntilRiddle(state, focus, ctx);
    case "NameEncounterType":
      return nameEncounterType(state, instruction, focus, steps);
    case "RemoveRiddleProgress":
      return removeRiddleProgress(state, ctx, steps);
    case "GollumAttacksBilbo":
      return gollumAttacksBilbo(state, ctx, steps);
    case "LeaveRiddleArea":
      return leaveRiddleArea(state);
    case "GollumEngagesFirstPlayer":
      return gollumEngagesFirstPlayer(state, steps);
    default:
      return null;
  }
}

export const manifest: RulesFamily = {
  name: "riddles",
  verbs: ["CreateRiddleArea", "PlaceInRiddleArea", "Riddle", "AnswerRiddle", "RiddleStep", "ResolveNormally", "DiscardUntilRiddle", "NameEncounterType", "RemoveRiddleProgress", "GollumAttacksBilbo", "LeaveRiddleArea", "GollumEngagesFirstPlayer", "IgnoreRiddles", "TreacheriesGainSurge"],
  run,
  revealed: (state, cardId, ctx) => treacheryGainsSurge(state, cardId, ctx),
  condition: (state, condition, scope, ctx) => riddleHolds(state, condition, scope, ctx),
  pool: (state, spec) => (spec.riddleArea ? areaIds(state) : null),
  combat: { defense: (state, defender, cards, defenderId) => defenseReason(state, defender, cards, defenderId), undefended: (state) => undefendedTargets(state) },
};
