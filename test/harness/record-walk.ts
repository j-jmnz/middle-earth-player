// One walker over a record's instructions for the words tests: every instruction, nested ones too (`instructions` of Each,
// If, ...) and every branch of a Choose, each with the instruction that follows it in its list and the ones after that.
// The walker is src/play/words/record-path.ts, the one the asks files read their paths by.
import type { Instruction } from "../../src/catalog/boundary.ts";

export { walk } from "../../src/play/words/record-path.ts";

// The instructions that ask a player for a card: the sheet words them with pickWords (src/play/choice/sheets.ts).
export const ASKING_VERBS: ReadonlySet<string> = new Set(["Pick", "SearchMove", "AttachSelf", "ReturnToStaging", "DiscardFromHand", "DiscardAlliesForWillpower"]);

// The instructions that ask for something besides a Pick of a card: the sheet words them with pickWords too.
const ASKING = new Set<string>([...ASKING_VERBS, "PickEncounter", "ChooseX", "Reattach", "PlayFromHand", "PayToPlay", "SpendResources", "ChooseAmount", "DiscardRestricted", "AssignDamage", "CapRefresh"]);

// The verbs whose engine path opens a choice window (`askTarget`, or `openBranch` for a Choose the engine builds) when more than one card or option is left, found from the call graph of
// the verb's handler under src/rules. A verb the engine asks about is a pick the sheet words, so each needs an asks entry or words of its own (words-judge.ts), though no Pick or Choose of the record names it.
// scripts/checks/engine-asks.test.ts fails on a family verb whose handler reaches a window and is not here; the type keeps a name that is no verb out.
const ENGINE_ASKING = [
  "ActivateFromCaves", "AddEventsToHand", "AddSourceToHandOfMost", "ArrangeCaves", "ArrangeEncounter", "ArrangeLookedDeck", "ArrangeTop", "AssignFaceup",
  "AttachCollectionHero", "AttachLootFromDiscard", "AttachRandomTreasure", "AttachSacked", "AttachSearched", "AttachToActiveLocation", "AttachToHighestThreatCost",
  "AttackHighestWillpower", "ChooseAttackers", "ChooseBoon", "ChooseBoonToHand", "ChooseCurrentQuest", "ChooseQuestStage", "ChooseStageToFlip", "ClaimRandomTreasure",
  "DestroyHighestCostAlly", "DiscardAlliesToCost", "DiscardFromAnyDeck", "Discover", "EachExhaustsOne", "EngageFromVictory", "EngageLowestThreat", "EngageOrGrapple",
  "EngageSeatWith", "EngageSeatWithMost", "FitShips", "GainChosenTrait", "GuardStagedHeroes", "HealAmong", "HealLakeTownByProgress", "HealLocations", "LocateTest",
  "LookAtStages", "MakeEngagementChecks", "MayDiscardShadow", "MoveProgress", "MoveToHero", "NameCard", "NameEncounterType", "NameInvestigation", "PayResources",
  "PickFewestHitPoints", "PickFewestHitPointsLeft", "PickHighestEngagement", "PickHighestThreat", "PickLowestEngagement", "PickMostHitPoints", "PlaceHandUnderLocation",
  "PlaceProgressInStaging", "PlayFrom", "PlayRevealedFree", "PrepareFleet", "PutCapturedIntoPlay", "PutIntoPlay", "PutIntoPlayFromHand", "PutSetAsideInPlay",
  "RaiseThreatToAttach", "ReleaseStagedHero", "RemoveProgressAmong", "RemoveWillpowerFromQuest", "ResolveBurn", "ResolveDiscover", "ResolveGrapple",
  "RevealChosenFromDiscard", "RiddleStep", "SearchAflame", "SearchNemesis", "SearchQuestDeck", "SearchShips", "ShuffleHighestCostIntoDeck", "ShuffleIntoPlayerDeck",
  "ShuffleOutOfPlayIntoEncounterDeck", "SplitProgress", "StageLooked", "SwapHero", "TakeCardFromCollection", "TakeObjectiveAlly", "TakeObjectiveHero", "TradeDamageForResources",
  "TradeDamageForThreat", "TradeShipDamage", "TriggerLost"
] as const satisfies readonly Instruction["verb"][];
for (const verb of ENGINE_ASKING) ASKING.add(verb);

/**
 * A verb that asks only with one of its options: RevealCorsair when the first player names who reveals it (12154:A:1; its other readings name nobody), RemoveTimeCounters with `distribute` (the chooser picks each
 * location in turn), RevealOutOfPlay with `chooseForHand` (the searcher picks the card for his hand: Searches X), Each with `upTo` (the player chooses which of the cards to act on), TriggerScour over the cards in play (the first player orders them).
 */
function asksWithOption(instruction: Instruction): boolean {
  switch (instruction.verb) {
    case "RevealCorsair":
      return instruction.who === "anyPlayer";
    case "RemoveTimeCounters":
      return instruction.distribute != null;
    case "RevealOutOfPlay":
      return instruction.chooseForHand === true;
    case "Each":
      return instruction.upTo != null;
    // The first player orders the Scour effects in play; the topmost card of the discard pile is one card.
    case "TriggerScour":
      return instruction.scope === "inPlay";
    // Of several sets the one with the most cards left is drawn from, and the first player chooses among tied sets (hrd.multiple-encounter-sets).
    case "RandomSetAside":
      return instruction.sets.length > 1;
    default:
      return false;
  }
}

/** Every verb the words check counts as asking, with or without an option (scripts/checks/engine-asks.test.ts reads it). */
export const ASKING_VERB_NAMES: ReadonlySet<string> = new Set([...ASKING, "RevealCorsair", "RemoveTimeCounters", "RevealOutOfPlay", "Each", "TriggerScour", "RandomSetAside"]);

/**
 * Does the instruction ask a player something the sheet has to word: a verb of ASKING, or RevealCorsair when the first player names who reveals it (12154:A:1; its other readings name nobody). The one predicate the words
 * tests (scenario-words.test.ts, asks.test.ts) share, so no test misses a verb the other reads.
 */
export const asksPlayer = (instruction: Instruction): boolean => ASKING.has(instruction.verb) || asksWithOption(instruction);

/** Only a ReturnToStaging that lets the player choose an engaged enemy asks; the others send a known card back without a question. */
export const sendsWithoutAsking = (instruction: Instruction): boolean => instruction.verb === "ReturnToStaging" && !(instruction.target.kind === "engagedEnemies" && instruction.target.pick === "choose");
