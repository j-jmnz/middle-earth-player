import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Instruction } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { payToPlay, playFromHand } from "./play.ts";
import { chooseX, discardResources, heroesGain, reattach, reduceNextCost, setX, spendResources } from "./verbs.ts";
import type { Focus } from "../index.ts";

// The verbs src/catalog/families/costs.ts adds, for costs: discounts, resource matches, who pays for what, icons, optional doomed. Null when the verb is not one of them.
// ReduceNextCost (effect-schema-verbs.ts) resolves here too. The constants (PaysAsIcons, PaidByIcons, CannotPayFor, ThreatCost,
// PlayCost, ExhaustToReduce) are read where a card is paid for or setup adds threat: they do nothing when run.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "ReduceNextCost":
      return reduceNextCost(state, instruction, focus, ctx);
    case "ChooseX":
      return chooseX(state, instruction, focus, ctx);
    case "SetX":
      return setX(state, instruction.value);
    case "DiscardResources":
      return discardResources(state, instruction, focus, ctx);
    case "SpendResources":
      return spendResources(state, instruction, focus, ctx);
    case "HeroesGainResources":
      return heroesGain(state, instruction, focus, ctx, steps);
    case "Reattach":
      return reattach(state, focus, ctx, steps);
    case "PlayFromHand":
      return playFromHand(state, instruction, focus.seat, focus.sourceId, focus.chosen, ctx);
    case "PayToPlay":
      return payToPlay(state, instruction, focus.seat, focus.sourceId, focus.chosen, ctx, steps);
    case "PaysAsIcons":
    case "PaidByIcons":
    case "CannotPayFor":
    case "ThreatCost":
    case "PlayCost":
    case "ExhaustToReduce":
      return state;
    default:
      return null;
  }
}

export const manifest: RulesFamily = { name: "costs", verbs: ["ReduceNextCost", "ChooseX", "SetX", "DiscardResources", "SpendResources", "HeroesGainResources", "Reattach", "PlayFromHand", "PayToPlay", "PaysAsIcons", "PaidByIcons", "CannotPayFor", "ThreatCost", "PlayCost", "ExhaustToReduce"], run };
