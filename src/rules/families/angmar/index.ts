// Rules: mec108.time-x, mec108.side-quests, mec108.side-quests-in-play, mec108.objective-allies, mec108.campaign-setup-intruders-in-chetwood, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 09024:A:1, 09024:A:2, 09024:A:3, 09049:A:2, 09051:A:1, 10156:A:2, 10158:A:1.
// The vocabulary Angmar Awakened adds (src/catalog/families/angmar.ts): Time X, the card held under a side quest, the current quest among the quest cards in play and the campaign card's Setup of Intruders in Chetwood. Its side quests read the shared reads of
// families/wilderland/night-quest.ts (the current quest, the progress placed on it, a defeated side quest).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { chooseBoon } from "./boons.ts";
import { attackerFacing, defenderFacing } from "./combat.ts";
import { releaseGuards, revealCard, revealSetAsideForTokens, stageRandomGuardedPair } from "./ettenmoors.ts";
import { safeActiveHolds, safePickMatches, setAsideHasHolds } from "./safe.ts";
import { attachRandomBurden, attachSelfToNamed, moveToHero } from "./burdens.ts";
import { placeHandUnderSelf } from "./cards-under.ts";
import { determinedMatches } from "./determined.ts";
import { flipTimeObjective, timeOfDayHolds } from "./day-night.ts";
import { discardCopiesFromDeck, discardPileMaxCostAmount } from "./copies.ts";
import { discardedThreatAmount, removeProgressAmong } from "./dark-covenant.ts";
import { dealShadowInPlay, flipTwoSided, shadowCardsInPlayAmount } from "./shadows.ts";
import { destroyedWillpowerAmount } from "./last-known.ts";
import { placeLoggedDamageOn } from "./logged.ts";
import { endPhase } from "./phase.ts";
import { travelUnpayable } from "./travel.ts";
import { noteFirstTrait } from "./weather.ts";
import { discardHeld, holdUnder } from "./hold.ts";
import { chooseCurrentQuest, currentQuestHolds, hitPointsLeftHolds, questCardsAmount, questLeadsHolds } from "./quest.ts";
import { advanceWhenFlagged, removeSideQuestsFromGame } from "./stage.ts";
import { removeTimeCounters, timeOnReveal } from "./time.ts";
import { attachNewTo, tradeDamageForResources } from "./trade.ts";

// The verbs src/catalog/families/angmar.ts adds. Null when the verb is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "Time":
      return state;
    case "RemoveTimeCounters":
      return removeTimeCounters(state, ctx);
    case "HoldUnder":
      return holdUnder(state, instruction, focus);
    case "DiscardHeld":
      return discardHeld(state, focus, ctx, steps);
    case "PlaceHandUnderSelf":
      return placeHandUnderSelf(state, focus, ctx);
    case "ChooseCurrentQuest":
      return chooseCurrentQuest(state, instruction, focus, ctx, steps);
    case "AttachNewTo":
      return attachNewTo(state, instruction, ctx);
    case "TradeDamageForResources":
      return tradeDamageForResources(state, instruction, focus, steps);
    // A marker the reveal hook reads (weather.ts).
    case "FirstTraitSurge":
      return state;
    case "EndPhase":
      return endPhase(state, focus);
    case "PlaceLoggedDamageOn":
      return placeLoggedDamageOn(state, instruction);
    case "ChooseBoon":
      return chooseBoon(state, instruction, focus, ctx, steps);
    case "AttachRandomBurden":
      return attachRandomBurden(state, instruction, focus, ctx);
    case "MoveToHero":
      return moveToHero(state, instruction, focus, ctx, steps);
    case "AttachSelfToNamed":
      return attachSelfToNamed(state, instruction, focus, ctx);
    case "FlipTimeObjective":
      return flipTimeObjective(state, instruction);
    // The Safe keyword's marker (safe.ts) and the Resolution's count (setup/resolution.ts) do nothing when run here.
    case "Safe":
    case "EarnEncounterCopies":
      return state;
    case "RemoveProgressAmong":
      return removeProgressAmong(state, instruction, focus, ctx, steps);
    case "RemoveSideQuestsFromGame":
      return removeSideQuestsFromGame(state, instruction, ctx, steps);
    // The marker defeatSideQuest reads (stage.ts).
    case "FlipWhenDefeated":
      return state;
    case "StageRandomGuardedPair":
      return stageRandomGuardedPair(state, focus, ctx, steps);
    case "RevealCard":
      return revealCard(state, instruction, focus, ctx, steps);
    case "ReleaseGuards":
      return releaseGuards(state, instruction, focus);
    case "RevealSetAsideForTokens":
      return revealSetAsideForTokens(state, instruction, focus, ctx, steps);
    case "RecordStartingThreat":
      return { ...state, resolutionLog: { ...state.resolutionLog, startingThreat: (state.resolutionLog.startingThreat ?? 0) + instruction.amount } };
    case "FlipTwoSided":
      return flipTwoSided(state, instruction, ctx, steps);
    case "DealShadowInPlay":
      return dealShadowInPlay(state, instruction, focus, ctx, steps);
    case "DiscardCopiesFromDeck":
      return discardCopiesFromDeck(state, instruction, focus, ctx, steps);
    default:
      return null;
  }
}

export const manifest: RulesFamily = {
  name: "angmar",
  verbs: ["Time", "RemoveTimeCounters", "HoldUnder", "DiscardHeld", "PlaceHandUnderSelf", "ChooseCurrentQuest", "AttachNewTo", "TradeDamageForResources", "FirstTraitSurge", "EndPhase", "PlaceLoggedDamageOn", "ChooseBoon", "AttachRandomBurden", "MoveToHero", "AttachSelfToNamed", "FlipTimeObjective", "RecordStartingThreat", "Safe", "StageRandomGuardedPair", "RevealCard", "ReleaseGuards", "RevealSetAsideForTokens", "EarnEncounterCopies", "RemoveSideQuestsFromGame", "FlipWhenDefeated", "RemoveProgressAmong", "FlipTwoSided", "DealShadowInPlay", "DiscardCopiesFromDeck"],
  run,
  revealed: (state, id, ctx) => noteFirstTrait(timeOnReveal(state, id, ctx), id, ctx),
  travel: { unpayable: travelUnpayable },
  pick: (state, id, spec, _at, ctx) => determinedMatches(state, id, spec) && safePickMatches(state, id, spec, ctx),
  combat: { attack: (state, enemyId, _attacker, _target, attackerId) => attackerFacing(state, enemyId, attackerId), defense: (state, defender, _cards, defenderId) => defenderFacing(state, defender, defenderId) },
  condition: (state, condition, scope, ctx) => timeOfDayHolds(state, condition) ?? currentQuestHolds(state, condition, scope, ctx) ?? questLeadsHolds(state, condition, ctx) ?? hitPointsLeftHolds(state, condition, ctx) ?? safeActiveHolds(state, condition, ctx) ?? setAsideHasHolds(state, condition),
  settle: { sweep: advanceWhenFlagged },
  amount: (state, found, scope, ctx) => questCardsAmount(state, found, scope.actor, ctx) ?? discardedThreatAmount(state, found, ctx) ?? destroyedWillpowerAmount(state, found, scope) ?? shadowCardsInPlayAmount(state, found, ctx) ?? discardPileMaxCostAmount(state, found, scope.actor, ctx),
};
