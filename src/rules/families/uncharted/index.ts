// Rules: dcce.uncharted, dcce.uncharted-deck, dcce.grotto-deck, dcce.encounter-cards, dcce.scalable-upgradable (data/rules/entries.json). The verbs src/catalog/families/uncharted.ts adds. The Uncharted deck and
// its locations are in uncharted/deck.ts, the cards beyond them in uncharted/cards.ts; the deck as a zone (the route of a discarded double-sided location) is uncharted/zone.ts.
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { addCampaignResource, attachSetAsideTo, discardBottom, discardCostlier, discardEncounterTop, eachExhaustsOne, lookAtBottom, mayDiscardShadow, putSetAsideInPlay, removeWillpowerFromQuest, stageLooked, tradeDamageForThreat } from "./cards.ts";
import { addFromGrottoDeck, flipDoubleSided, prepareGrottoDeck, resolveActiveForced } from "./grotto.ts";
import { addLostIslands, addSetAside, addStageProgress, flip, lookAtFacedown, prepareDeck, scramble } from "./deck.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "PrepareUnchartedDeck":
      return prepareDeck(state);
    case "PrepareGrottoDeck":
      return prepareGrottoDeck(state);
    case "AddFromGrottoDeck":
      return addFromGrottoDeck(state, instruction, focus, ctx, steps);
    case "FlipDoubleSided":
      return flipDoubleSided(state, instruction, focus, steps);
    case "ResolveActiveForced":
      return resolveActiveForced(state, instruction);
    case "AddLostIslands":
      return addLostIslands(state, instruction, focus, ctx);
    case "AddSetAsideLostIsland":
      return addSetAside(state, instruction, focus, ctx);
    case "ScrambleUncharted":
      return scramble(state, steps, ctx);
    case "FlipUncharted":
      return flip(state, instruction, focus, ctx, steps);
    case "LookAtFacedown":
      return lookAtFacedown(state, instruction, focus, ctx, steps);
    case "AddStageProgress":
      return addStageProgress(state, instruction, focus, ctx, steps);
    case "PutSetAsideInPlay":
      return putSetAsideInPlay(state, instruction, focus, ctx);
    case "AttachSetAsideTo":
      return attachSetAsideTo(state, instruction, ctx);
    case "TradeDamageForThreat":
      return tradeDamageForThreat(state, instruction, focus, ctx, steps);
    // The campaign card stays in the game: burden/campaign.ts reads it.
    case "KeepCampaignCard":
      return state;
    case "AddCampaignResource":
      return addCampaignResource(state, instruction, focus, ctx);
    case "LookAtBottom":
      return lookAtBottom(state, instruction, focus, ctx);
    case "DiscardBottom":
      return discardBottom(state, instruction, focus);
    case "DiscardCostlier":
      return discardCostlier(state, instruction, focus, ctx);
    case "DiscardEncounterTop":
      return discardEncounterTop(state, instruction, focus, ctx);
    case "StageLooked":
      return stageLooked(state, instruction, focus, ctx, steps);
    case "RemoveWillpowerFromQuest":
      return removeWillpowerFromQuest(state, instruction, focus, ctx, steps);
    case "EachExhaustsOne":
      return eachExhaustsOne(state, instruction, focus, ctx, steps);
    case "MayDiscardShadow":
      return mayDiscardShadow(state, instruction, focus);
    default:
      return null;
  }
}

export const manifest: RulesFamily = { name: "uncharted", verbs: ["PrepareUnchartedDeck", "PrepareGrottoDeck", "AddFromGrottoDeck", "FlipDoubleSided", "ResolveActiveForced", "AddLostIslands", "AddSetAsideLostIsland", "ScrambleUncharted", "FlipUncharted", "LookAtFacedown", "AddStageProgress", "PutSetAsideInPlay", "AttachSetAsideTo", "TradeDamageForThreat", "KeepCampaignCard", "AddCampaignResource", "LookAtBottom", "DiscardBottom", "DiscardCostlier", "DiscardEncounterTop", "StageLooked", "RemoveWillpowerFromQuest", "EachExhaustsOne", "MayDiscardShadow"], run };
