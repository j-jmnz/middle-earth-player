// The pelargir family's pieces (src/catalog/families/pelargir.ts): Alcaron's Scroll, the treachery that attaches to the hero with the highest threat cost, the discards Collateral Damage counts in two steps, Into Ithilien's ally objectives committed from the staging area and the first player's taking of them, The Siege of Cair Andros's stage removal, copied treachery and staging shuffle, and the flags those cards read: templates, samples and stat notes.
import { cardRef } from "../amounts.ts";
import { amt, pck, type Samples, type Templates } from "../family-kit.ts";
import { str } from "../kit.ts";

const holder = (value: unknown): string => (typeof value === "string" ? cardRef(value) : `the card in play with code ${str((value as { code?: unknown }).code)}`);
const codeList = (value: unknown): string => (Array.isArray(value) ? value.map(String).join(", ") : str(value));

export const PELARGIR_TEMPLATES: Templates = {
  AttachObjectiveTo: (i) => ({
    text: `${typeof i.code === "string" ? `the objective in play with code ${i.code}` : "this objective"} leaves the hero, the enemy or the staging area it is on and attaches to ${cardRef(str(i.card ?? "picked"))}, an enemy in play that may have attachments; it stays a claimed objective that no player controls, so it returns to the staging area when it is detached${i.orStaging === true ? "; with no enemy to attach to it is added to the staging area instead" : "; with no such enemy nothing happens"}`,
    read: ["card", "code", "orStaging"],
  }),
  AttachToHighestThreatCost: () => ({ text: "this card attaches to the hero with the highest printed threat cost among the heroes (any player's) that carry no copy of it and may have it, the first player choosing among heroes tied; with no such hero it is not attached", read: [] }),
  AttackScrollHolder: (i) => ({
    text: `${i.card ? `the ${i.card} enemy` : "the enemy the event is about"}, in the staging area, makes an immediate attack against the player whose hero has the card with code ${str(i.code)} attached, from the staging area: it is dealt a shadow card and the defender may be declared; with no such hero (the card is in the staging area or on an enemy) there is no attack`,
    read: ["code", "card"],
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
  EachPlayerSpends: (i, ctx) => ({
    text: `each player, the first player first, spends ${amt(i.amount, ctx)} resource(s) from his own heroes' pools (he chooses the hero for each resource); the players cannot travel here while any player holds fewer than that in all`,
    read: ["amount"],
  }),
  DamageCardThenSetX: (i, ctx) => ({
    text: `the picked card takes ${amt(i.amount, ctx)} damage, and the effect's X is set to ${i.value} only if the card holds more damage once the responses to it were heard (canceled or prevented damage sets nothing)`,
    read: ["amount", "value", "before"],
  }),
  DiscardVillagerTokens: (i, ctx) => ({
    text: `discard up to ${amt(i.amount, ctx)} villager token(s) from ${holder(i.from)} (fewer when it holds fewer; each goes back to the token bank and is announced, one by one); the effect's X is the number discarded`,
    read: ["from", "amount"],
  }),
  MoveVillagerTokens: (i, ctx) => ({
    text: `move ${i.all === true ? "all the" : `up to ${amt(i.amount ?? 1, ctx)}`} villager token(s) from ${holder(i.from)} to ${holder(i.to)}, a card in play (a move is no discard: nothing hears it); the number moved is added to the effect's X`,
    read: ["from", "to", "amount", "all"],
  }),
  PickFewestHitPointsLeft: () => ({
    text: "the hero or ally in play (any player's, an objective ally too) with the fewest hit points left, as modified, becomes the picked card (the first player chooses among those tied); the player who controls it acts for the instructions after this one; with no character in play nothing is picked",
    read: [],
  }),
  TakeControlOfLocation: (i) => ({
    text: `the first player takes control of ${cardRef(str(i.card ?? "subject"))}, a location in the discard pile, the victory display, the staging area or the active slot: it comes into his play area faceup and ready with no progress, its text working there, and the table notes that he controls it; a location already in a play area, or a card that is no location, stays as it is`,
    read: ["card"],
  }),
  LoseControlOfLocation: (i) => ({
    text: `the player who controls ${cardRef(str(i.card ?? "picked"))}, a location in his play area, loses control of it: it goes to the staging area with all its progress removed and nobody controls it, and the table announces the loss of control for that player; a location no player controls stays as it is`,
    read: ["card"],
  }),
  AnnounceAddedToStaging: (i) => ({
    text: `${cardRef(str(i.card ?? "picked"))}, if it lies in the staging area, is announced as added to the staging area, so its own Forced effect that hears it resolves (a search puts a card there without that announcement unless the record opts in with this instruction)`,
    read: ["card"],
  }),
  ActForDestroyedController: () => ({
    text: "the player who controlled the character the attack destroyed acts for the instructions that follow in this effect (he may not be the defending player: a Sentinel defender belongs to another player); with no character destroyed the acting player stays",
    read: [],
  }),
  TakeHiddenCard: (i) => ({
    text: `${i.who === "firstPlayer" ? "the first player" : "the acting player"} takes ${String(i.amount ?? 1)} hidden card(s): the top card(s) of the encounter deck are set aside facedown in his play area, unseen and not revealed (no When Revealed effect, no surge, no shadow effect); an empty deck is refilled from the discard pile first, and with both empty no card is taken (as a Travel cost it then cannot be paid); the 5-card limit of Captured! is checked once the whole instruction is done`,
    read: ["who", "amount"],
  }),
  TurnHiddenCards: (i) => ({
    text: `${i.who === "eachPlayer" ? "each player, in player order, the first player first," : i.who === "firstPlayer" ? "the first player" : i.who === "actor" ? "the actor (the acting player)" : "nobody (no player named)"} turns each hidden card he holds faceup, one at a time, the cards held when the turn begins only (a card taken meanwhile stays facedown): an enemy engages him at once whatever its engagement cost, a treachery is discarded${i.resolve === true ? ", and a location is added to the staging area when it is turned; once every card is turned the When Revealed effects of the cards turned (an enemy after it has engaged, a treachery, a location) resolve, the first card turned first, and no surge fires" : " and a location is discarded, with no When Revealed effect"}${i.shadow === true ? "; each enemy turned this way is dealt a shadow card" : ""}`,
    read: ["who", "resolve", "shadow"],
  }),
  TurnHiddenCard: (i) => ({
    text: `the acting player chooses a player who holds a hidden card (no choice with one) and one of that player's hidden cards, picked blind with the game's seed, is turned faceup for him: an enemy${i.damageEnemy != null ? ` takes ${String(i.damageEnemy)} damage first, and one destroyed never engages; otherwise it` : ""} engages him at once whatever its engagement cost, a treachery or a location is discarded unresolved`,
    read: ["damageEnemy", "seat"],
  }),
  DiscardHiddenCard: (i) => ({ text: `${i.who === "firstPlayer" ? "the first player" : "the acting player"} discards 1 hidden card chosen at random, unseen, to the encounter discard pile: it is not turned faceup, so nothing engages and no When Revealed effect resolves; with none nothing happens`, read: ["who"] }),
  HoldUnderStage: (i) => ({ text: `each card in play with code ${codeList(i.codes)} is placed under this stage: still in play, controlled by no player, committed to nothing; its text cannot be used and its leaving play is not announced`, read: ["codes"] }),
  DiscardResolved: () => ({ text: "this card, a treachery turned faceup, goes to the encounter discard pile once its When Revealed effect is done (the engine's own last step of that frame)", read: [] }),
  GainControlOfSelf: () => ({ text: "this card passes to the first player's play area (each time the first player token passes); a card under a stage is not moved", read: [] }),
  PlaceProgressOnNamed: (i, ctx) => ({
    text: `${amt(i.amount, ctx)} progress token(s) are placed on the card in play with the title ${str(i.name)} (the staging area counts as play), in one placement: the cards that hear progress placed hear it once; with no such card in play nothing happens`,
    read: ["name", "amount"],
  }),
  RemoveAllNamedFromGame: (i) => ({
    text: `every player card with the title ${str(i.name)}, in a deck, a hand, a discard pile or play (a hero or an ally, the cards attached to it with it), goes out of the game; nothing is announced as leaving play`,
    read: ["name"],
  }),
  RevealTopEngaging: () => ({
    text: "the top card of the encounter deck (an empty deck is refilled from the discard pile in the quest phase only; otherwise nothing is revealed) is revealed in full for the acting player: its Doomed, When Revealed effects and Surge resolve; an enemy is put into play engaged with him, never staged, and is dealt no shadow card; a location or an objective goes to the staging area and a treachery to the discard pile",
    read: [],
  }),
  AttackPerBlankShadow: (i) => ({
    text: `${i.left != null ? `the engine's own, run again at the end of an attack: ${String(i.left)} more` : "for each shadow card with no shadow effect dealt to this enemy for the attack that has ended, one additional attack"}; the enemy makes one immediate attack now against the player it is engaged with, dealt a shadow card of its own (the old shadow cards are discarded), and the others follow one after another, each at the end of the one before; none when it is not engaged`,
    read: ["left"],
  }),
  GroupDiscardResources: (i, ctx) => ({
    text: `the players as a group discard ${amt(i.amount, ctx)} resource(s) from their heroes' pools, or as many as they can: each player in turn decides for his own heroes, one resource at a time, and may stop unless the players after him cannot discard the rest (a discard, not a spend)`,
    read: ["amount", "rest", "turns"],
  }),
};

export const PELARGIR_SAMPLES: Samples = {
  AttachObjectiveTo: [{ verb: "AttachObjectiveTo", card: "other" }, { verb: "AttachObjectiveTo", code: "05019", card: "subject", orStaging: true }],
  AttachToHighestThreatCost: [{ verb: "AttachToHighestThreatCost" }],
  AttackScrollHolder: [{ verb: "AttackScrollHolder", code: "05019" }, { verb: "AttackScrollHolder", code: "08127", card: "picked" }],
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
  EachPlayerSpends: [{ verb: "EachPlayerSpends", amount: 1 }],
  DamageCardThenSetX: [{ verb: "DamageCardThenSetX", amount: 1, value: 1 }],
  TakeHiddenCard: [{ verb: "TakeHiddenCard" }, { verb: "TakeHiddenCard", who: "firstPlayer", amount: 2 }],
  TurnHiddenCards: [{ verb: "TurnHiddenCards", who: "actor" }, { verb: "TurnHiddenCards", who: "firstPlayer", resolve: true }, { verb: "TurnHiddenCards", who: "eachPlayer", shadow: true }],
  TurnHiddenCard: [{ verb: "TurnHiddenCard", damageEnemy: 3 }],
  DiscardHiddenCard: [{ verb: "DiscardHiddenCard", who: "firstPlayer" }],
  HoldUnderStage: [{ verb: "HoldUnderStage", codes: ["06132", "06133"] }],
  GainControlOfSelf: [{ verb: "GainControlOfSelf" }],
  DiscardResolved: [{ verb: "DiscardResolved" }],
  GroupDiscardResources: [{ verb: "GroupDiscardResources", amount: 2 }],
  DiscardVillagerTokens: [{ verb: "DiscardVillagerTokens", from: "activeLocation", amount: 1 }, { verb: "DiscardVillagerTokens", from: { code: "06068" }, amount: { players: true } }],
  MoveVillagerTokens: [{ verb: "MoveVillagerTokens", from: { code: "06068" }, to: "picked", amount: 2 }, { verb: "MoveVillagerTokens", from: "subject", to: { code: "06068" }, all: true }],
  PickFewestHitPointsLeft: [{ verb: "PickFewestHitPointsLeft" }],
  TakeControlOfLocation: [{ verb: "TakeControlOfLocation" }, { verb: "TakeControlOfLocation", card: "previous" }],
  LoseControlOfLocation: [{ verb: "LoseControlOfLocation", card: "self" }, { verb: "LoseControlOfLocation" }],
  ActForDestroyedController: [{ verb: "ActForDestroyedController" }],
  AnnounceAddedToStaging: [{ verb: "AnnounceAddedToStaging" }, { verb: "AnnounceAddedToStaging", card: "previous" }],
  PlaceProgressOnNamed: [{ verb: "PlaceProgressOnNamed", name: "To the Tower", amount: 1 }, { verb: "PlaceProgressOnNamed", name: "To the Tower", amount: 3 }],
  RemoveAllNamedFromGame: [{ verb: "RemoveAllNamedFromGame", name: "Faramir" }],
  RevealTopEngaging: [{ verb: "RevealTopEngaging" }],
  AttackPerBlankShadow: [{ verb: "AttackPerBlankShadow" }, { verb: "AttackPerBlankShadow", left: 2 }],
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
  attackWithWillpower: " (held by the table while the stage is in play: a character's attack strength is its current Willpower instead of its Attack, attack bonuses not added; the enemy's Defense is still subtracted)",
  attackDamageAsProgress: " (held by the table: the damage a character's attack deals to an enemy is placed as progress tokens on it instead; damage from an effect, a shadow card or archery stays damage)",
  progressToVictory: " (held by the table: an enemy in play with progress equal to its printed hit points goes to the victory display and all its progress goes on the current quest; checked at every settle)",
  progressToVillagers: " (held by the current quest stage: the progress that would be placed on it is not placed; its record hears the amount and moves that many villager tokens from the quest card to Rescued Villagers, the rest of the progress is lost)",
  advancesWithoutVillagers: " (held by the current quest stage: when its card holds no villager token the quest advances at once to the next stage)",
  undefendedToVillagers: " (held by the current quest stage: an undefended attack is aimed at Rescued Villagers, no hero takes it, and the damage it would deal becomes that many villager tokens discarded from Rescued Villagers, all of them when fewer)",
  gameEnding: " (held by the table until the end of the game: the game is ending; Rescued Villagers and Dead Villagers compare their tokens once Ghulat is not in play)",
  endingLost: " (held by the table until the end of the game: Lord Alcaron left play; the players lose once Ghulat is not in play, checked at every settle)",
  noProgressInStagingByPlayer: " (held by the table while the stage is in play: progress a player card's effect would place on a location in the staging area is not placed; an active location, a location in a play area and any encounter card's or location's own effect are not barred)",
  losesBattle: " (held by the current quest stage: it does not have the Battle keyword it prints)",
  turnsAtFiveHidden: " (held by the current quest stage: a player who holds 5 hidden cards turns them faceup, one at a time, once the instruction that gave him the fifth is done; checked at every settle)",
  controlSeat: " (held by a location a player controls, the amount is the seat plus 1: written by TakeControlOfLocation and read by a settle sweep that sees the control lost; not set by a record)",
  cannotLeavePlay: " (held by a Captain enemy while its stage is current: it cannot leave play unless destroyed; a pick that feeds a discard, a shuffle, a return to a hand or deck, the victory display or a removal from the game does not offer it, the staging area shuffled into the encounter deck leaves it where it is, and a settle sweep puts it back in the staging area if an effect with no pick moved it out of play)",
  shieldedByBodyguard: " (held by each Captain enemy while a Morgul Bodyguard is in play: damage assigned to it, however it comes, is placed on the Bodyguard in play with the most damage, the first in play on a tie, before the Captain's own limits apply)",
  attackSwitched: " (held by the attacking enemy until the end of the attack: the attack deals no damage and no shadow card still facedown resolves; the attack's end engages the next player and starts an immediate attack)",
  firstEnemyNoted: " (held by the table until the end of the round: an enemy was already marked firstEnemy this round)",
};
