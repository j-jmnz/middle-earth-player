// Rules: rr.player-elimination, rr.explored, emce.treasure, emce.boon-allies, emce.campaign-pool-encounter, emce.campaign-log, emce.caves-deck, emce.deep, emce.evil-creatures-deck, emce.discover, emce.loot, rr.guarded (data/rules/entries.json).
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Condition, Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import type { ScenarioState } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { addFromNamed, refillEvilCreatures, shuffleIntoNamed, shuffleNamed, shuffleNamedIntoEncounter } from "./decks.ts";
import { attachSelf } from "../../interpret/effect-targeted.ts";
import { replaceFromCaves, resolveDeep } from "./deep.ts";
import { addToStagingWithResources, arrangeCaves, attachSearched, attachSelfToPicked, cancelStrike, guardPickedAttachment, guardWithDeckTop, putOnPileBottom, returnHeld } from "./kings.ts";
import { discover } from "./discover.ts";
import { arrangeLookedDeck, attachGuardedFromPile, discardOtherLooked, exhaustOrDamageEachReady, immediateAttackBy, removeSetAsideDamage, setAsideKeepingDamage, shuffleSetAsideIntoPile, victoryWhenFree } from "./heath.ts";
import { logCondition } from "./log.ts";
import { attachRandomTreasure, claimRandomTreasure } from "./treasure.ts";
import { wilderlandAmount } from "./amounts.ts";
import { controlFreedObjectives } from "./control.ts";
import { wilderlandPickMatches } from "./pick.ts";
import { setAsideDiscardForPool } from "./discard-pool.ts";
import { flipOver } from "./flip.ts";
import { addSourceToHandOfMost } from "./hand.ts";
import { advanceToLetterStage, grantSurge, freeTreasures, searchGuardForTreasure, takeControlOfSetAside } from "./mirkwood.ts";
import { carryAwayHero, discardGuardedHeroes, releaseGuardedHero } from "./carried.ts";
import { discardFacedownUnder, placeHandUnderLocation, returnFacedownToHands } from "./lost.ts";
import { clearNemesis, nemesisAttacks, searchNemesis } from "./nemesis.ts";
import { topFrame } from "../../windows/windows.ts";
import { pileOf } from "../../core/piles.ts";

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
      return flipOver(state, instruction, focus);
    case "AddSourceToHandOfMost":
      return addSourceToHandOfMost(state, instruction, focus, ctx, steps);
    // A Shadow card's "attach this card to attacking enemy" (18018:A:2) needs no question, so it runs inline; every other AttachSelf is the effect frame's.
    case "AttachSelf": {
      if (instruction.to.kind !== "attackingEnemy") return null;
      const attacker = state.pendingAttack?.enemyId;
      return attacker && focus.sourceId && state.cards[attacker] ? attachSelf(state, focus.sourceId, attacker, ctx) : state;
    }
    case "ShufflePile":
      return shuffleNamed(state, instruction);
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
    case "AdvanceToLetterStage":
      return advanceToLetterStage(state, instruction, ctx, steps);
    case "TakeControlOfSetAside":
      return takeControlOfSetAside(state, instruction, focus);
    case "SearchGuardForTreasure":
      return searchGuardForTreasure(state, instruction, focus, steps);
    case "GrantSurgeToSubject":
      return grantSurge(state, eventSubject(state));
    case "CarryAwayHero":
      return carryAwayHero(state, ctx, steps);
    case "ReleaseGuardedHero":
      return releaseGuardedHero(state, eventSubject(state));
    case "DiscardGuardedHeroes":
      return discardGuardedHeroes(state, steps);
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
      return attachSelfToPicked(state, focus, ctx);
    case "AttachSearched":
      return attachSearched(state, instruction, focus, ctx, steps);
    case "GuardPickedAttachment":
      return guardPickedAttachment(state, instruction, focus, ctx, steps);
    case "GuardWithDeckTop":
      return guardWithDeckTop(state, focus);
    case "ReturnGuardedToHand":
      return state;
    case "CancelStrike":
      return cancelStrike(state);
    case "ShuffleSetAsideIntoPile":
      return shuffleSetAsideIntoPile(state, instruction);
    case "SetAsideKeepingDamage":
      return setAsideKeepingDamage(state, instruction, ctx, steps);
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
    case "Loot":
    case "Undiscardable":
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
    case "RemoveFromCavesIfLogged":
    case "ChooseRandomTreasure":
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
function condition(state: ScenarioState, found: Condition): boolean | null {
  if (found.kind === "cavesDeck") return pileOf(state, "cavesDeck").length >= (found.min ?? 1);
  return logCondition(found, state.campaignFacts);
}

export const manifest: RulesFamily = {
  name: "wilderland",
  condition,
  amount: wilderlandAmount,
  pick: wilderlandPickMatches,
  // The Evil Creatures deck runs out: its own discard pile is shuffled back into it at once (emce.evil-creatures-deck).
  settle: { after: (state) => refillEvilCreatures(state), sweep: (state, ctx, steps) => victoryWhenFree(returnHeld(clearNemesis(freeTreasures(controlFreedObjectives(state, ctx), ctx, steps), ctx), ctx), ctx, steps) },
  verbs: ["AttachRandomTreasure", "ClaimRandomTreasure", "SetAsideDiscardForPool", "FlipOver", "AddSourceToHandOfMost", "DiscoverTreasure", "BoonAllyOrLogLine", "AddEncounterToPool", "RemoveFromPool", "RemoveFromEncounterDeckIfLogged", "ShufflePile", "ShuffleIntoPile", "AddFromPile", "ShufflePileIntoEncounterDeck", "Deep", "Discover", "Loot", "Undiscardable", "GainControlWhenFree", "IgnoreKeyword", "AdvanceToLetterStage", "TakeControlOfSetAside", "SearchGuardForTreasure", "GrantSurgeToSubject", "DiscardToPoolFromSets", "PutObjectiveLocationAfterDiscard", "CarryAwayHero", "ReleaseGuardedHero", "DiscardGuardedHeroes", "PlaceHandUnderLocation", "ReturnFacedownToHands", "DiscardFacedownUnder", "SearchNemesis", "NemesisAttacks", "AddToStagingWithResources", "ReplaceFromCaves", "ArrangeCaves", "PutOnPileBottom", "AttachSelfToPicked", "AttachSearched", "GuardPickedAttachment", "GuardWithDeckTop", "ReturnGuardedToHand", "CancelStrike", "ShuffleSetAsideIntoPile", "SetAsideKeepingDamage", "RemoveSetAsideDamage", "AttachGuardedFromPile", "VictoryWhenFree", "UncancelableWhenRevealed", "DiscardOtherLooked", "ArrangeLookedDeck", "ImmediateAttackBy", "ExhaustOrDamageEachReady", "SearchBoonAllyToHand", "RemoveFromCavesIfLogged", "ChooseRandomTreasure"],
  run,
};
