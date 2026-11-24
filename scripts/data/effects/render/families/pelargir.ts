// The pelargir family's pieces (src/catalog/families/pelargir.ts): Alcaron's Scroll, the treachery that attaches to the hero with the highest threat cost, the discards Collateral Damage counts in two steps, Into Ithilien's ally objectives committed from the staging area and the first player's taking of them, The Siege of Cair Andros's stage removal, copied treachery and staging shuffle, and the flags those cards read: templates, samples and stat notes.
import { cardRef } from "../amounts.ts";
import { amt, pck, type Samples, type Templates } from "../family-kit.ts";
import { str } from "../kit.ts";

const codeList = (value: unknown): string => (Array.isArray(value) ? value.map(String).join(", ") : str(value));

export const PELARGIR_TEMPLATES: Templates = {
  AttachObjectiveTo: (i) => ({
    text: `${typeof i.code === "string" ? `the objective in play with code ${i.code}` : "this objective"} leaves the hero, the enemy or the staging area it is on and attaches to ${cardRef(str(i.card ?? "picked"))}, an enemy in play that may have attachments; it stays a claimed objective that no player controls, so it returns to the staging area when it is detached${i.orStaging === true ? "; with no enemy to attach to it is added to the staging area instead" : "; with no such enemy nothing happens"}`,
    read: ["card", "code", "orStaging"],
  }),
  AttachToHighestThreatCost: () => ({ text: "this card attaches to the hero with the highest printed threat cost among the heroes (any player's) that carry no copy of it and may have it, the first player choosing among heroes tied; with no such hero it is not attached", read: [] }),
  AttackScrollHolder: (i) => ({
    text: `the enemy the event is about, in the staging area, makes an immediate attack against the player whose hero has the card with code ${str(i.code)} attached, from the staging area: it is dealt a shadow card and the defender may be declared; with no such hero (the card is in the staging area or on an enemy) there is no attack`,
    read: ["code"],
  }),
  DiscardEncounterTopMore: (i, ctx) => ({
    text: `discard ${amt(i.count, ctx)} card(s) from the top of the encounter deck${i.reset === true ? " (a deck that runs out in the quest phase is reset from the discard pile and the discard goes on)" : ""}; they join the cards this effect discarded before, so a later amount "discarded by this effect" counts them all`,
    read: ["count", "reset"],
  }),
  RaiseThreatPerDiscarded: (i) => ({
    text: `raise each player's threat by ${String(i.amount)} for each ${str(i.type)} card this effect discarded from the top of the encounter deck, in any of its discard steps, even one a reset of the deck put back in it`,
    read: ["type", "amount"],
  }),
  TakeControlOfStagedObjectives: (i) => ({
    text: `the first player takes control of each ${str(i.trait)} objective in the staging area: it comes into his play area, faceup and ready, and is no longer committed by its own text; with none there nothing happens`,
    read: ["trait"],
  }),
  RemoveStage: (i) => ({
    text: `the stage with code ${str(i.code)} is set aside and no longer part of the quest deck: the stage that is defeated before it goes to the next stage still in the quest deck; if it is the current stage, the quest advances at once to the next stage still in the quest deck and that stage is revealed; a stage already gone is not an error`,
    read: ["code"],
  }),
  ResolveTopmostTreachery: (i) => ({
    text: `resolve the When Revealed effects (not Doomed, not Surge) of the last treachery card placed in the encounter discard pile; the card stays in the discard pile; with no treachery there nothing happens${i.uncancelable === true ? "; these effects cannot be canceled" : ""}`,
    read: ["uncancelable"],
  }),
  ShuffleStagingIntoEncounterDeck: () => ({ text: "every card in the staging area (enemies, locations, objectives) leaves play and is shuffled into the encounter deck; X is how many cards there were (0 when there were none)", read: [] }),
  BuildUnderworldDeck: (i) => ({
    text: `the set-aside cards with code ${codeList(i.codes)} are shuffled with the game's seed and form the underworld deck, facedown, apart from the encounter deck; no card of it is dealt a shadow card, searched or shuffled before it is shuffled into the encounter deck`,
    read: ["codes"],
  }),
  HideOneAside: (i) => ({
    text: `one of the set-aside cards with code ${codeList(i.codes)} is chosen with the game's seed and stays set aside facedown, unseen; the others leave the game unseen`,
    read: ["codes"],
  }),
  TakeUnderworld: (i, ctx) => ({
    text: `the top ${amt(i.amount, ctx)} card(s) of the underworld deck (fewer when fewer remain, none when it is empty) are stacked facedown under ${i.host === "self" ? "this location (self)" : i.host === "activeLocation" ? "the active location (activeLocation: nothing with no active location)" : "no location"}, out of play; when that location leaves play (any location, explored or not, set by the family's settle sweep), the cards under it are revealed one at a time by the first player (the staging steps: keywords, When Revealed, effects that hear a reveal) and added to the staging area`,
    read: ["amount", "host"],
  }),
  RevealSetAside: (i) => ({ text: `the set-aside card with the Trait ${str(i.trait)} is revealed by the actor as an encounter card (its Doomed, When Revealed effects, Surge and the effects that hear a reveal resolve) and so added to the staging area; with none set aside nothing happens`, read: ["trait"] }),
  RevealUnderworld: (i) => ({
    text: `the top card of the underworld deck is revealed in full (its When Revealed effects, Surge and Doomed resolve) and added to the staging area${i.discardTrait != null ? `; a card with the Trait ${str(i.discardTrait)} is placed in the encounter discard pile instead` : ""}; with the deck empty nothing happens`,
    read: ["discardTrait"],
  }),
  ShuffleUnderworldIntoEncounterDeck: () => ({ text: "every card of the underworld deck is shuffled into the encounter deck; the cards stacked under locations stay there, and a later Underworld takes nothing", read: [] }),
  RevealTopThenDiscard: () => ({
    text: "the top card of the encounter deck (the discard pile is shuffled back first when the deck is empty) goes faceup to the encounter discard pile and never enters play; its Doomed, When Revealed effects and Surge resolve, and a card that hears \"revealed from the encounter deck\" hears it",
    read: [],
  }),
  PickRandom: (i, ctx) => ({ text: `one card among ${pck(i.pick, ctx)} is chosen with the game's seed and becomes the picked card; with none nothing is picked and nobody is asked`, read: ["pick"] }),
  RemoveQuestTokens: (i) => ({
    text: `${i.amount == null || i.amount === "all" ? "all" : String(i.amount)} ${i.kind === "any" ? "any (progress first, then resource)" : str(i.kind)} token(s) leave the current quest card (progress first when both kinds are named; at most the card holds)`,
    read: ["kind", "amount"],
  }),
};

export const PELARGIR_SAMPLES: Samples = {
  AttachObjectiveTo: [{ verb: "AttachObjectiveTo", card: "other" }, { verb: "AttachObjectiveTo", code: "05019", card: "subject", orStaging: true }],
  AttachToHighestThreatCost: [{ verb: "AttachToHighestThreatCost" }],
  AttackScrollHolder: [{ verb: "AttackScrollHolder", code: "05019" }],
  DiscardEncounterTopMore: [{ verb: "DiscardEncounterTopMore", count: 2, reset: true }],
  RaiseThreatPerDiscarded: [{ verb: "RaiseThreatPerDiscarded", type: "location", amount: 2 }],
  TakeControlOfStagedObjectives: [{ verb: "TakeControlOfStagedObjectives", trait: "Ranger" }],
  RemoveStage: [{ verb: "RemoveStage", code: "05075" }],
  ResolveTopmostTreachery: [{ verb: "ResolveTopmostTreachery", uncancelable: true }],
  ShuffleStagingIntoEncounterDeck: [{ verb: "ShuffleStagingIntoEncounterDeck" }],
  BuildUnderworldDeck: [{ verb: "BuildUnderworldDeck", codes: ["05037", "06026"] }],
  HideOneAside: [{ verb: "HideOneAside", codes: ["06015", "06016", "06017"] }],
  TakeUnderworld: [{ verb: "TakeUnderworld", amount: 2, host: "self" }, { verb: "TakeUnderworld", amount: 1, host: "activeLocation" }],
  RevealSetAside: [{ verb: "RevealSetAside", trait: "Plot" }],
  RevealUnderworld: [{ verb: "RevealUnderworld", discardTrait: "Clue" }],
  ShuffleUnderworldIntoEncounterDeck: [{ verb: "ShuffleUnderworldIntoEncounterDeck" }],
  RevealTopThenDiscard: [{ verb: "RevealTopThenDiscard" }],
  PickRandom: [{ verb: "PickRandom", pick: { type: "ally", control: "any", controlledBy: "firstPlayer" } }],
  RemoveQuestTokens: [{ verb: "RemoveQuestTokens", kind: "any", amount: 1 }, { verb: "RemoveQuestTokens", kind: "progress" }],
};

export const PELARGIR_STAT_NOTES: Readonly<Record<string, string>> = {
  damageToScroll: " (the damage its attack deals to the defending player's characters goes to the hero the card holding takesAttackDamage is attached to instead, if a hero holds it; with none the damage stays where it was assigned)",
  takesAttackDamage: " (the hero it is attached to takes the damage of an attack whose enemy holds damageToScroll)",
  engagedOptionally: " (marker: the player chose this enemy in the optional engagement step; set before the engagement is announced, in a game with a card that reads it)",
  noteDeckDiscards: " (held by the table: a card that goes from the top of the encounter deck to its discard pile is announced, so a card that hears \"discarded from the encounter deck\" answers it)",
  firstEnemy: " (marker: the first enemy the encounter deck revealed this round, read by the condition firstEnemy; set only in a game with a card that reads it)",
  committedInStaging: " (an ally objective in the staging area: it counts in the quest total with the stat the quest uses, is a character committed to the quest for every effect that picks or counts one, and takes archery damage)",
  skipsNextStage: " (held by a quest stage: once it is completed the quest goes to the stage after the next one, which is bypassed)",
  attackForUncommitted: " (marker: the constant that gives the Attack for each character not committed to a quest holds while this flag does)",
  removedAtDamage: " (held by a Battleground location in play, the amount is the damage at which it is removed from the game: not explored, to no pile, no Response, its damage and progress gone; checked at every settle)",
  undefendedToBattleground: " (held by the current quest stage: the damage of an undefended attack goes to the Battleground location in play with the lowest Threat, none to a hero; on a tie the defending player names it)",
  advancesWithoutBattleground: " (held by the current quest stage: when no Battleground location is in play the quest advances at once to the next stage still in the quest deck)",
  cannotSpendResources: " (held by a hero: no resource can be spent from its pool, for a card, an ability or an effect; resources can still be gained and moved)",
  losesSiege: " (held by the current quest stage: it does not have the Siege keyword it prints)",
  firstEnemyNoted: " (held by the table until the end of the round: an enemy was already marked firstEnemy this round)",
};
