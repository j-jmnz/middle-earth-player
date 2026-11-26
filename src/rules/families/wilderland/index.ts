// Rules: rr.player-elimination, rr.explored, emce.side-quests, emce.side-quests-in-play, emce.treasure, emce.boon-allies, emce.campaign-pool-encounter, emce.campaign-log, emce.caves-deck, emce.deep, emce.evil-creatures-deck, emce.discover, emce.loot, rr.guarded (data/rules/entries.json).
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Condition, Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { addFromNamed, formPile, pileTravelUnpayable, refillEvilCreatures, refillRaven, shuffleDiscardIntoPile, shuffleIntoNamed, shuffleNamed, shuffleNamedIntoEncounter } from "./decks.ts";
import { attachSelf } from "../../interpret/effect-targeted.ts";
import { attachToEventCharacter } from "./attach-event.ts";
import { replaceFromCaves, resolveDeep } from "./deep.ts";
import { addToStagingWithResources, arrangeCaves, attachSearched, attachSelfToPicked, cancelStrike, guardPickedAttachment, guardWithDeckTop, putOnPileBottom, returnHeld } from "./kings.ts";
import { attachLootFromDiscard, discover, discoverUnavailable, resolveDiscover } from "./discover.ts";
import { hideRandomLoot } from "./hide.ts";
import { arrangeLookedDeck, attachGuardedFromPile, discardOtherLooked, exhaustOrDamageEachReady, immediateAttackBy, removeSetAsideDamage, shuffleSetAsideIntoPile, victoryWhenFree } from "./heath.ts";
import { logCondition, logFacts } from "./log.ts";
import { NIGHT_COMBAT, attackStage, beldisBoxLeft, defeatFullSideQuests, excessToStage, makeCurrentQuest, markBeldisUse, revealSideQuest } from "./night.ts";
import { attachRandomTreasure, claimRandomTreasure } from "./treasure.ts";
import { wilderlandAmount } from "./amounts.ts";
import { controlFreedObjectives } from "./control.ts";
import { wilderlandPickMatches } from "./pick.ts";
import { optionalEngageBarred } from "./engage.ts";
import { setAsideDiscardForPool } from "./discard-pool.ts";
import { flipOver } from "./flip.ts";
import { bypassStage, flipCurrentQuest, flipInPlace, searchQuestDeck } from "./gundabad.ts";
import { addShadowToVictory, chooseStageToFlip, discardTopEliminating, flipAndReveal, revealNewStage, shuffleStageFromVictory } from "./moria.ts";
import { attackedThisPhase, namedFlagHeld, removeProgressFrom, searchStageCard, stageDiscarded } from "./assault.ts";
import { activateFromCaves, attachTreasuresToHost, stageRandomDiscarded } from "./gundabad-cards.ts";
import { handPlayRefusal, handPlaysBarred, noteTreacheryReveal, playLimitRefusal, playLimitBars } from "./rounds.ts";
import { advanceToRandomStage, claimFreed, flipToEnemySide, guardReturnedBy, putTrust } from "./rhovanion.ts";
import { addSourceToHandOfMost } from "./hand.ts";
import { advanceToLetterStage, grantSurge, freeTreasures, searchGuardForTreasure, takeControlOfSetAside } from "./mirkwood.ts";
import { carryAwayHero, discardGuardedHeroes, discardHeldHero, releaseGuardedHero, returnHeldHeroes } from "./carried.ts";
import { discardFacedownUnder, placeHandUnderLocation, returnFacedownToHands } from "./lost.ts";
import { clearNemesis, nemesisAttacks, searchNemesis } from "./nemesis.ts";
import { discardCopiesOfDiscarded, optionTaken, selectRandomStage, takeControlOfStaged, tallySiege } from "./dolguldur.ts";
import { topFrame } from "../../windows/windows.ts";
import { NAMED_PILES, pileOf } from "../../core/piles.ts";

// The verbs src/catalog/families/wilderland.ts adds. AttachRandomTreasure runs in the game. The others are not run by the engine: the Resolution
// ones (DiscoverTreasure, BoonAllyOrLogLine, AddEncounterToPool, RemoveFromPool) are run by rules/setup/resolution.ts, and RemoveFromEncounterDeckIfLogged is dealt by
// the campaign checklist (campaign/checklist.ts), so they change nothing here. The decks, Deep and Discover run in the game; Loot and IgnoreKeyword are constants other code reads (markers.ts), so run alone they do nothing.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "AttachRandomTreasure":
      return attachRandomTreasure(state, instruction, focus, ctx, steps);
    case "ClaimRandomTreasure":
      return claimRandomTreasure(state, instruction, focus, ctx, steps);
    case "SetAsideDiscardForPool":
      return setAsideDiscardForPool(state, instruction, focus, ctx, steps);
    case "FlipOver":
      return flipOver(state, instruction, focus, eventSubject(state));
    case "AddSourceToHandOfMost":
      return addSourceToHandOfMost(state, instruction, focus, ctx, steps);
    // A Shadow card's "attach this card to attacking enemy" (18018:A:2) needs no question, so it runs inline; every other AttachSelf is the effect frame's.
    case "AttachSelf": {
      if (instruction.to.kind === "subject" || instruction.to.kind === "defender") return attachToEventCharacter(state, instruction.to.kind, focus, ctx);
      if (instruction.to.kind !== "attackingEnemy") return null;
      const attacker = state.pendingAttack?.enemyId;
      return attacker && focus.sourceId && state.cards[attacker] ? attachSelf(state, focus.sourceId, attacker, ctx) : state;
    }
    case "ShufflePile":
      return shuffleNamed(state, instruction);
    case "FormPile":
      return formPile(state, instruction);
    case "ShuffleDiscardIntoPile":
      return shuffleDiscardIntoPile(state, instruction);
    case "ShuffleIntoPile":
      return shuffleIntoNamed(state, instruction);
    case "AddFromPile":
      return addFromNamed(state, instruction, focus, ctx, steps);
    case "ShufflePileIntoEncounterDeck":
      return shuffleNamedIntoEncounter(state, instruction);
    case "Deep":
      return resolveDeep(state, focus, ctx, steps);
    case "Discover":
      return discover(state, instruction, focus, ctx, steps);
    case "ResolveDiscover":
      return resolveDiscover(state, instruction, focus, ctx, steps);
    case "AttachLootFromDiscard":
      return attachLootFromDiscard(state, instruction, focus, ctx, steps);
    case "HideRandomLoot":
      return hideRandomLoot(state, instruction);
    case "AdvanceToLetterStage":
      return advanceToLetterStage(state, instruction, ctx, steps);
    case "TakeControlOfSetAside":
      return takeControlOfSetAside(state, instruction, focus);
    case "SearchGuardForTreasure":
      return searchGuardForTreasure(state, instruction, focus, steps);
    case "GrantSurgeToSubject":
      return grantSurge(state, eventSubject(state));
    case "CarryAwayHero":
      return carryAwayHero(state, ctx, steps, instruction.keepAttachments === true);
    case "ReleaseGuardedHero":
      return releaseGuardedHero(state, eventSubject(state));
    case "DiscardGuardedHeroes":
      return discardGuardedHeroes(state, steps);
    case "TallySiege":
      return tallySiege(state, eventSubject(state), ctx);
    case "TakeControlOfStaged":
      return takeControlOfStaged(state, instruction);
    case "DiscardCopiesOfDiscarded":
      return discardCopiesOfDiscarded(state, ctx, steps);
    case "SelectRandomStage":
      return selectRandomStage(state, instruction);
    case "DiscardHeldHero":
      return discardHeldHero(state, instruction.stage, steps);
    case "ReturnHeldHeroes":
      return returnHeldHeroes(state, instruction.stage);
    case "PlaceHandUnderLocation":
      return placeHandUnderLocation(state, focus, ctx, steps);
    case "ReturnFacedownToHands":
      return returnFacedownToHands(state, eventSubject(state));
    case "DiscardFacedownUnder":
      return discardFacedownUnder(state, ctx);
    case "SearchNemesis":
      return searchNemesis(state, focus, ctx, steps);
    case "NemesisAttacks":
      return nemesisAttacks(state, focus, ctx, steps);
    case "AddToStagingWithResources":
      return addToStagingWithResources(state, instruction, focus, ctx);
    case "ReplaceFromCaves":
      return replaceFromCaves(state, focus, ctx, steps);
    case "ArrangeCaves":
      return arrangeCaves(state, instruction, focus, steps);
    case "PutOnPileBottom":
      return putOnPileBottom(state, instruction);
    case "AttachSelfToPicked":
      return attachSelfToPicked(state, instruction, focus, ctx);
    case "AttachSearched":
      return attachSearched(state, instruction, focus, ctx, steps);
    case "GuardPickedAttachment":
      return guardPickedAttachment(state, instruction, focus, ctx, steps);
    case "GuardWithDeckTop":
      return guardWithDeckTop(state, focus, instruction.discards === true);
    case "ReturnGuardedToHand":
    case "DiscardGuarded":
      return state;
    case "CancelStrike":
      return cancelStrike(state);
    case "ShuffleSetAsideIntoPile":
      return shuffleSetAsideIntoPile(state, instruction);
    case "RemoveSetAsideDamage":
      return removeSetAsideDamage(state, instruction);
    case "AttachGuardedFromPile":
      return attachGuardedFromPile(state, instruction, focus, ctx, steps);
    case "DiscardOtherLooked":
      return discardOtherLooked(state);
    case "ArrangeLookedDeck":
      return arrangeLookedDeck(state, instruction, focus, steps);
    case "ExhaustOrDamageEachReady":
      return exhaustOrDamageEachReady(state, instruction, focus, ctx, steps);
    case "ImmediateAttackBy":
      return immediateAttackBy(state, instruction, focus, ctx, steps);
    case "AdvanceToRandomStage":
      return advanceToRandomStage(state, instruction, focus, ctx, steps);
    case "FlipToEnemySide":
      return flipToEnemySide(state, instruction);
    case "PutTrust":
      return putTrust(state, instruction, focus, ctx, steps);
    case "GuardReturnedBy":
      return guardReturnedBy(state, instruction);
    case "RevealSideQuest":
      return revealSideQuest(state, focus, ctx, steps);
    case "AttackStage":
      return attackStage(state, ctx, steps);
    case "ExcessToStage":
      return excessToStage(state);
    case "MakeCurrentQuest":
      return makeCurrentQuest(state, instruction, ctx);
    case "MarkBeldisUse":
      return markBeldisUse(state, focus);
    case "FlipCurrentQuest":
      return instruction.resolve ? flipAndReveal(state, ctx, steps) : flipCurrentQuest(state);
    case "RevealNewStage":
      return revealNewStage(state, instruction, ctx, steps);
    case "ChooseStageToFlip":
      return chooseStageToFlip(state, instruction, focus, ctx, steps);
    case "ShuffleStageFromVictory":
      return shuffleStageFromVictory(state, instruction);
    case "DiscardTopEliminating":
      return discardTopEliminating(state, instruction, ctx, steps);
    case "AddShadowToVictory":
      return addShadowToVictory(state, instruction, focus, ctx);
    case "BypassStage":
      return bypassStage(state, focus, ctx, steps);
    case "SearchQuestDeck":
      return searchQuestDeck(state, instruction, focus, ctx, steps);
    case "FlipInPlace":
      return flipInPlace(state, instruction, ctx, steps);
    case "ActivateFromCaves":
      return activateFromCaves(state, instruction, focus, ctx, steps);
    case "StageRandomDiscarded":
      return stageRandomDiscarded(state, instruction, focus, ctx);
    case "AttachTreasuresToHost":
      return attachTreasuresToHost(state, focus, ctx, steps);
    case "SearchStageCard":
      return searchStageCard(state, instruction, focus, ctx, steps);
    case "StageDiscarded":
      return stageDiscarded(state, instruction, focus, ctx, steps);
    case "RemoveProgressFrom":
      return removeProgressFrom(state, instruction, focus, ctx, steps);
    case "FlipAtQuestPhase":
    case "LimitPlaysPerPhase":
    case "LimitPlaysPerRound":
    case "LimitHandPlaysPerRound":
    case "Loot":
    case "Undiscardable":
    case "ClaimWhenFree":
    case "ChooseStagedLocationForPool":
    case "DiscardToPoolFromSets":
    case "PutObjectiveLocationAfterDiscard":
    case "GainControlWhenFree":
    case "IgnoreKeyword":
    case "VictoryWhenFree":
    case "UncancelableWhenRevealed":
      return state;
    case "DiscoverTreasure":
    case "BoonAllyOrLogLine":
    case "AddEncounterToPool":
    case "RemoveFromPool":
    case "RemoveFromEncounterDeckIfLogged":
    case "SearchBoonAllyToHand":
    case "SearchBoonOrTreasureToHand":
    case "RemoveFromCavesIfLogged":
    case "ChooseRandomTreasure":
    case "ChooseHazardForPool":
      return state;
    default:
      return null;
  }
}

// The card the answered event is about, for the effect running now.
function eventSubject(state: ScenarioState): string | null {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" ? (data.subject ?? null) : null;
}

// The conditions that read the Campaign Log's facts (log.ts). A game dealt without the facts holds neither.
function condition(state: ScenarioState, found: Condition, scope: { actor: number }, ctx: ReduceContext): boolean | null {
  if (found.kind === "discoverUnavailable") return discoverUnavailable(state, ctx);
  if (found.kind === "beldisBox") return beldisBoxLeft(state, scope.actor);
  if (found.kind === "cavesDeck") return pileOf(state, "cavesDeck").length >= (found.min ?? 1);
  if (found.kind === "pileHas") {
    const left = pileOf(state, NAMED_PILES[found.pile].deck).length;
    return left >= (found.min ?? 0) && left <= (found.max ?? Infinity);
  }
  if (found.kind === "questDeck") return state.questDeck.length >= (found.min ?? 1);
  if (found.kind === "attackedThisPhase") return attackedThisPhase(state, found.name, ctx);
  if (found.kind === "optionTaken") return optionTaken(state, found.id);
  if (found.kind === "namedFlag") return namedFlagHeld(state, found.name, found.stat, ctx);
  return logCondition(found, logFacts(state));
}

export const manifest: RulesFamily = {
  name: "wilderland",
  condition,
  amount: wilderlandAmount,
  pick: wilderlandPickMatches,
  optionalEngage: optionalEngageBarred,
  play: (state, id, ctx, how) => playLimitBars(state, id, ctx, how) || handPlaysBarred(state, id, ctx, how),
  playReason: (state, id, ctx) => playLimitRefusal(state, id, ctx) ?? handPlayRefusal(state, id, ctx),
  revealed: noteTreacheryReveal,
  combat: NIGHT_COMBAT,
  travel: { unpayable: pileTravelUnpayable },
  // The Evil Creatures deck runs out: its own discard pile is shuffled back into it at once (emce.evil-creatures-deck).
  settle: { after: (state, _ctx, steps) => refillRaven(refillEvilCreatures(state, steps), steps), sweep: (state, ctx, steps) => defeatFullSideQuests(claimFreed(victoryWhenFree(returnHeld(clearNemesis(freeTreasures(controlFreedObjectives(state, ctx), ctx, steps), ctx), ctx), ctx, steps), ctx, steps), ctx, steps) },
  verbs: ["AttachRandomTreasure", "ClaimRandomTreasure", "SetAsideDiscardForPool", "FlipOver", "AddSourceToHandOfMost", "DiscoverTreasure", "BoonAllyOrLogLine", "AddEncounterToPool", "RemoveFromPool", "RemoveFromEncounterDeckIfLogged", "ShufflePile", "FormPile", "ShuffleDiscardIntoPile", "ShuffleIntoPile", "AddFromPile", "ShufflePileIntoEncounterDeck", "Deep", "Discover", "Loot", "Undiscardable", "GainControlWhenFree", "IgnoreKeyword", "AdvanceToLetterStage", "TakeControlOfSetAside", "SearchGuardForTreasure", "GrantSurgeToSubject", "DiscardToPoolFromSets", "PutObjectiveLocationAfterDiscard", "CarryAwayHero", "ReleaseGuardedHero", "DiscardGuardedHeroes", "DiscardHeldHero", "ReturnHeldHeroes", "TallySiege", "SelectRandomStage", "TakeControlOfStaged", "DiscardCopiesOfDiscarded", "PlaceHandUnderLocation", "ReturnFacedownToHands", "DiscardFacedownUnder", "SearchNemesis", "NemesisAttacks", "AddToStagingWithResources", "ReplaceFromCaves", "ArrangeCaves", "PutOnPileBottom", "AttachSelfToPicked", "AttachSearched", "GuardPickedAttachment", "GuardWithDeckTop", "ReturnGuardedToHand", "DiscardGuarded", "CancelStrike", "ShuffleSetAsideIntoPile", "RemoveSetAsideDamage", "AttachGuardedFromPile", "VictoryWhenFree", "UncancelableWhenRevealed", "DiscardOtherLooked", "ArrangeLookedDeck", "ImmediateAttackBy", "ExhaustOrDamageEachReady", "SearchBoonAllyToHand", "RemoveFromCavesIfLogged", "ChooseRandomTreasure", "AdvanceToRandomStage", "FlipToEnemySide", "PutTrust", "ClaimWhenFree", "GuardReturnedBy", "ChooseStagedLocationForPool", "RevealSideQuest", "AttackStage", "ExcessToStage", "MakeCurrentQuest", "MarkBeldisUse", "ResolveDiscover", "AttachLootFromDiscard", "HideRandomLoot", "ChooseHazardForPool", "FlipAtQuestPhase", "FlipCurrentQuest", "RevealNewStage", "ChooseStageToFlip", "ShuffleStageFromVictory", "DiscardTopEliminating", "AddShadowToVictory", "BypassStage", "SearchQuestDeck", "FlipInPlace", "LimitPlaysPerPhase", "LimitPlaysPerRound", "LimitHandPlaysPerRound", "ActivateFromCaves", "StageRandomDiscarded", "AttachTreasuresToHost", "SearchBoonOrTreasureToHand", "SearchStageCard", "StageDiscarded", "RemoveProgressFrom"],
  run,
};
