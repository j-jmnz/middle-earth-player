// Rules: dcce.grapple, dcce.stormcaller-and-the-thing, dcce.stormcaller-elite, dcce.campaign-mode (data/rules/entries.json). The verbs src/catalog/families/grapple.ts adds. Attaching an enemy to a location
// is in grapple/attach.ts, the cards the verbs move in grapple/cards.ts, what a record reads in grapple/values.ts.
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import { resolveGrapple } from "./attach.ts";
import { addResourcesSetAside, addSetAsideToHand, attackFirstPlayer, discardAndGrapple, engageOrGrapple, flipElite, flipSetAside, gainChosenTrait, removeCodeFromGame, removeEncounterSet, shuffleSetAsideSet } from "./cards.ts";
import type { Focus } from "../index.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "ResolveGrapple":
      return resolveGrapple(state, instruction, focus, ctx, steps);
    case "DiscardTopGrapple":
    case "DiscardUntilGrapple":
      return discardAndGrapple(state, instruction, focus, ctx, steps);
    case "FlipSetAside":
      return flipSetAside(state, instruction, ctx);
    case "FlipElite":
      return flipElite(state, instruction, ctx, steps);
    case "RemoveEncounterSet":
      return removeEncounterSet(state, instruction, ctx, steps);
    case "ShuffleSetAsideSet":
      return shuffleSetAsideSet(state, instruction, ctx, steps);
    case "AddResourcesSetAside":
      return addResourcesSetAside(state, instruction, focus, ctx);
    case "AddSetAsideToHand":
      return addSetAsideToHand(state, instruction, focus);
    case "GainChosenTrait":
      return gainChosenTrait(state, instruction, focus, ctx, steps);
    case "EngageOrGrapple":
      return engageOrGrapple(state, instruction, focus, ctx, steps);
    case "AttackFirstPlayer":
      return attackFirstPlayer(state, focus, ctx, steps);
    case "RemoveCodeFromGame":
      return removeCodeFromGame(state, instruction, ctx, steps);
    default:
      return null;
  }
}

export const manifest: RulesFamily = { name: "grapple", verbs: ["ResolveGrapple", "DiscardTopGrapple", "DiscardUntilGrapple", "FlipSetAside", "FlipElite", "RemoveEncounterSet", "ShuffleSetAsideSet", "AddResourcesSetAside", "AddSetAsideToHand", "GainChosenTrait", "EngageOrGrapple", "AttackFirstPlayer", "RemoveCodeFromGame"], run };
