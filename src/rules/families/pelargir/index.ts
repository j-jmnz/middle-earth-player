// Rules: ats.hidden-cards, ats.captain-enemies, ats.setup-the-morgul-vale-to-the-tower, ats.hidden-cards-turn-faceup, ats.villagers, ats.cair-andros-location-damage, ats.cair-andros-remove-stage, rr.attachment-cards, rr.objective-cards, rr.first-player, rr.damage, rr.reveal, rr.optional-engagement, rr.running-out-of-cards, rr.quest-advancement, ats.ally-objectives (data/rules/entries.json); the cards of Peril in Pelargir (05019 to 05024, 05037 to 05045, 05065 to 05067) and Into Ithilien (05025 to 05029, 05046 to 05055, 05068 to 05071; committed.ts, stage-skip.ts and control.ts), The Siege of Cair Andros (05030 to 05036, 05056 to 05064, 05072 to 05076; siege.ts, stage-remove.ts, staging.ts, spending.ts, stage-keyword.ts), The Morgul Vale (06144 to 06160; tower.ts, cannot-leave.ts, bodyguard.ts, switch.ts, reveal-engaged.ts).
import type { Instruction } from "../../../catalog/boundary.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { takeControlOfStagedObjectives } from "./control.ts";
import { alcaronLoss } from "./ending.ts";
import { actForDestroyedController, announceAddedToStaging, controlSweep, controlledTravelCost, controlledTravelReach, loseControlOfLocation, takeControlOfLocation, towerSecond } from "./location-control.ts";
import { discardHiddenCard, hiddenAmount, takeHiddenCard, takeHiddenUnpayable } from "./hidden.ts";
import { gainControlOfSelf, hiddenSweep, holdUnderStage } from "./hidden-sweep.ts";
import { discardResolved, turnHiddenCard, turnHiddenCards } from "./hidden-turn.ts";
import { inOwnSurgeChain } from "./surge-chain.ts";
import { undefendedAnnounced } from "./undefended.ts";
import { archeryOfAmount } from "./archery-of.ts";
import { discardEncounterTopMore, raiseThreatPerDiscarded } from "./discard.ts";
import { noteFirstEnemy, pelargirCondition } from "./first-enemy.ts";
import { damageCardThenSetX } from "./damage-noted.ts";
import { groupDiscardResources } from "./group-discard.ts";
import { eachPlayerSpends, eachPlayerSpendsUnpayable } from "./group-spend.ts";
import { attachToHighestThreatCost } from "./host.ts";
import { pickFewestHitPointsLeft } from "./fewest.ts";
import { noResourcesMatches } from "./no-resources.ts";
import { attachObjectiveTo, attackScrollHolder } from "./scroll.ts";
import { captainKept } from "./vale/cannot-leave.ts";
import { revealTopEngaging } from "./vale/reveal-engaged.ts";
import { placeProgressOnNamed, removeAllNamedFromGame } from "./vale/tower.ts";
import { pickRandom } from "./pick-random.ts";
import { removeQuestTokens } from "./quest-tokens.ts";
import { revealTopThenDiscard } from "./reveal-discard.ts";
import { sieges, undefendedBattlegrounds } from "./siege.ts";
import { progressesToVictory } from "./stage-progress.ts";
import { removeStage } from "./stage-remove.ts";
import { resolveTopmostTreachery, shuffleStagingIntoEncounterDeck } from "./staging.ts";
import { advanceWithoutVillagers, discardVillagerTokens, moveVillagerTokens, undefendedVillagers, villagersDamaged } from "./villagers.ts";
import { buildUnderworldDeck, hideOneAside, releaseUnderworldStacks, revealSetAside, revealUnderworld, shuffleUnderworldIntoEncounterDeck, takeUnderworld } from "./underworld.ts";

// The verbs src/catalog/families/pelargir.ts adds. Null when the verb is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "AttachObjectiveTo":
      return attachObjectiveTo(state, instruction, focus, ctx);
    case "AttachToHighestThreatCost":
      return attachToHighestThreatCost(state, instruction, focus, ctx, steps);
    case "AttackScrollHolder":
      return attackScrollHolder(state, instruction, focus, ctx, steps);
    case "DiscardEncounterTopMore":
      return discardEncounterTopMore(state, instruction, focus, ctx, steps);
    case "RaiseThreatPerDiscarded":
      return raiseThreatPerDiscarded(state, instruction, focus, ctx, steps);
    case "TakeControlOfStagedObjectives":
      return takeControlOfStagedObjectives(state, instruction, ctx);
    case "RemoveStage":
      return removeStage(state, instruction, ctx, steps);
    case "ResolveTopmostTreachery":
      return resolveTopmostTreachery(state, instruction, focus, ctx, steps);
    case "ShuffleStagingIntoEncounterDeck":
      return shuffleStagingIntoEncounterDeck(state, focus, ctx, steps);
    case "BuildUnderworldDeck":
      return buildUnderworldDeck(state, instruction);
    case "HideOneAside":
      return hideOneAside(state, instruction);
    case "TakeUnderworld":
      return takeUnderworld(state, instruction, focus, ctx);
    case "RevealSetAside":
      return revealSetAside(state, instruction, focus, ctx, steps);
    case "RevealUnderworld":
      return revealUnderworld(state, instruction, focus, ctx, steps);
    case "ShuffleUnderworldIntoEncounterDeck":
      return shuffleUnderworldIntoEncounterDeck(state);
    case "RevealTopThenDiscard":
      return revealTopThenDiscard(state, instruction, focus, ctx, steps);
    case "PickRandom":
      return pickRandom(state, instruction, focus, ctx);
    case "RemoveQuestTokens":
      return removeQuestTokens(state, instruction);
    case "EachPlayerSpends":
      return eachPlayerSpends(state, instruction);
    case "DamageCardThenSetX":
      return damageCardThenSetX(state, instruction, focus, ctx, steps);
    case "GroupDiscardResources":
      return groupDiscardResources(state, instruction, focus.seat, ctx);
    case "DiscardVillagerTokens":
      return discardVillagerTokens(state, instruction, focus, ctx, steps);
    case "MoveVillagerTokens":
      return moveVillagerTokens(state, instruction, focus, ctx);
    case "PickFewestHitPointsLeft":
      return pickFewestHitPointsLeft(state, focus, ctx, steps);
    case "TakeControlOfLocation":
      return takeControlOfLocation(state, instruction, focus, ctx);
    case "LoseControlOfLocation":
      return loseControlOfLocation(state, instruction, focus);
    case "ActForDestroyedController":
      return actForDestroyedController(state);
    case "AnnounceAddedToStaging":
      return announceAddedToStaging(state, instruction, focus);
    case "TakeHiddenCard":
      return takeHiddenCard(state, instruction, focus, steps);
    case "TurnHiddenCards":
      return turnHiddenCards(state, instruction, focus, ctx, steps);
    case "TurnHiddenCard":
      return turnHiddenCard(state, instruction, focus, ctx, steps);
    case "DiscardHiddenCard":
      return discardHiddenCard(state, instruction, focus);
    case "HoldUnderStage":
      return holdUnderStage(state, instruction, focus);
    case "GainControlOfSelf":
      return gainControlOfSelf(state, focus);
    case "DiscardResolved":
      return discardResolved(state, focus);
    case "PlaceProgressOnNamed":
      return placeProgressOnNamed(state, instruction, focus, ctx, steps);
    case "RemoveAllNamedFromGame":
      return removeAllNamedFromGame(state, instruction, ctx);
    case "RevealTopEngaging":
      return revealTopEngaging(state, instruction, focus, ctx, steps);
    default:
      return null;
  }
}

export const manifest: RulesFamily = {
  name: "pelargir",
  verbs: ["AttachObjectiveTo", "AttachToHighestThreatCost", "AttackScrollHolder", "DiscardEncounterTopMore", "RaiseThreatPerDiscarded", "TakeControlOfStagedObjectives", "RemoveStage", "ResolveTopmostTreachery", "ShuffleStagingIntoEncounterDeck", "BuildUnderworldDeck", "HideOneAside", "TakeUnderworld", "RevealSetAside", "RevealUnderworld", "ShuffleUnderworldIntoEncounterDeck", "RevealTopThenDiscard", "PickRandom", "RemoveQuestTokens", "EachPlayerSpends", "GroupDiscardResources", "DamageCardThenSetX", "DiscardVillagerTokens", "MoveVillagerTokens", "PickFewestHitPointsLeft", "TakeControlOfLocation", "LoseControlOfLocation", "AnnounceAddedToStaging", "ActForDestroyedController", "TakeHiddenCard", "TurnHiddenCards", "TurnHiddenCard", "DiscardHiddenCard", "HoldUnderStage", "GainControlOfSelf", "DiscardResolved", "PlaceProgressOnNamed", "RemoveAllNamedFromGame", "RevealTopEngaging"],
  run,
  condition: (state, condition, scope) => pelargirCondition(state, condition, scope),
  revealed: noteFirstEnemy,
  deckReset: { hold: inOwnSurgeChain },
  settle: { sweep: (state, ctx, steps) => captainKept(hiddenSweep(alcaronLoss(advanceWithoutVillagers(progressesToVictory(releaseUnderworldStacks(controlSweep(sieges(state, ctx, steps), ctx, steps), ctx, steps), ctx, steps), ctx, steps), ctx), ctx, steps), ctx, steps) },
  travel: { unpayable: (state, instruction, ctx, locationId) => eachPlayerSpendsUnpayable(state, instruction, ctx, locationId) || takeHiddenUnpayable(state, instruction), reach: controlledTravelReach, cost: controlledTravelCost, second: towerSecond },
  pick: (state, id, spec) => noResourcesMatches(state, id, spec),
  amount: (state, amount, scope, ctx) => archeryOfAmount(state, amount, scope, ctx) ?? hiddenAmount(state, amount, scope),
  combat: {
    undefended: (state, _candidates, cards) => {
      const battlegrounds = undefendedBattlegrounds(state, cards);
      return battlegrounds.length > 0 ? battlegrounds : undefendedVillagers(state);
    },
    damaged: (before, after, ctx, steps) => undefendedAnnounced(before, villagersDamaged(before, after, ctx, steps), ctx, steps),
  },
};
