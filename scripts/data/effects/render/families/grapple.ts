// The grapple and campaign families' pieces (src/catalog/families/grapple.ts and campaign.ts): encounter sets, Stormcaller Elite flips, Grapple, and the campaign card's Setup and Resolution lines: templates and samples.
import { amt, type Samples, type Templates } from "../family-kit.ts";
import { joinAnd, str } from "../kit.ts";

const codes = (value: unknown): string => joinAnd((Array.isArray(value) ? value : []).map(str));

export const GRAPPLE_TEMPLATES: Templates = {
  ShuffleSetAsideSet: (i) => ({ text: `every set-aside card of the encounter set "${str(i.set)}" joins the encounter deck (the deck is shuffled by the step after)`, read: ["set"] }),
  FlipSetAside: (i) => ({ text: `Campaign Setup: the card titled "${str(i.name)}", the set-aside one or the one the scenario dealt to the staging area, shows its 'Campaign Mode only' side B, with the stats and text printed there`, read: ["name"] }),
  FlipElite: (i) => ({ text: `the card in play titled "${str(i.name)}" (the enemy side of a Stormcaller Elite card) turns into its objective ally side, loses its tokens and joins the play area of ${i.to === "lastPlayer" ? "the last" : "the first"} player; it hears that it flipped over (a card out of play stays so)`, read: ["name", "to"] }),
  FlipEliteAndAttack: (i) => ({ text: `the Stormcaller Elite card in play titled "${str(i.name)}" (its objective ally side) turns to its enemy side in the staging area, faceup and without tokens, and attacks the first player now, dealt a shadow card as an attack outside the combat phase is; the effect goes on once the attack is over`, read: ["name"] }),
  AttackFirstPlayer: () => ({ text: "this enemy, in the staging area or engaged with any player, attacks the first player now, dealt a shadow card for the attack", read: [] }),
  AddSetAsideToHand: (i) => ({ text: `the first player chooses a player; the set-aside card with code ${str(i.code)} joins that player's hand and is recorded as a card the campaign card gave this game`, read: ["code"] }),
  AddResourcesSetAside: (i, ctx) => ({ text: `the set-aside cards with codes ${codes(i.codes)} get ${amt(i.amount, ctx)} resource(s) each, and hold the tokens until they enter play`, read: ["codes", "amount"] }),
  RemoveEncounterSet: (i) => ({
    text: i.setAsideOnly === true ? `every card of the encounter set "${str(i.set)}" that is still set aside leaves the game (a card of the set already in the deck, the discard pile or play stays)` : `every card of the encounter set "${str(i.set)}" in the encounter deck, the encounter discard pile, the staging area, a player's engaged enemies, the active location, and the cards attached to them leaves the game`,
    read: ["set", "setAsideOnly"],
  }),
  DiscardUntilGrapple: (i, ctx) => ({ text: `cards are discarded from the top of the encounter deck until ${amt(i.count, ctx)} enemies with the trait ${str(i.trait)} are discarded, or the deck is empty; then each of them resolves its Grapple keyword`, read: ["trait", "count"] }),
  ResolveGrapple: (i) => ({ text: `${i.target === "picked" ? "the last picked card" : "this enemy"} with the Grapple keyword attaches facedown to the staging-area location the keyword names, the first player choosing among those tied; with no location in the staging area it is added to the staging area`, read: ["target", "card"] }),
  EngageOrGrapple: () => ({ text: "(a shadow effect) the acting player chooses as it resolves, and once the attack is over this shadow card either comes into play engaged with them and is dealt a shadow card of its own, or resolves its Grapple keyword (both are always possible)", read: ["card", "choice"] }),
  DiscardTopGrapple: (i, ctx) => ({ text: `discard the top ${amt(i.count, ctx)} cards of the encounter deck; each enemy among them resolves its Grapple keyword, in the order discarded`, read: ["count"] }),
  PutObjectiveAllyIntoPlay: (i) => ({ text: `Campaign Setup: the objective ally with code ${str(i.code)} enters play under the first player (put there, not played: nothing is revealed and no cost is paid; a pool card with this record for itself is put into play at the start of each scenario instead of being shuffled into the encounter deck)`, read: ["code"] }),
  CarryOver: (i) => ({ text: `Resolution: the cards with codes ${codes(i.codes)} go to the NEXT campaign, not this one${i.eachPlayer === true ? " (one copy for each player)" : ""}; a new save takes them in from a finished one`, read: ["codes", "eachPlayer"] }),
  SetAsideEachPlayer: (i) => ({ text: `Campaign Setup: a copy of the card with code ${str(i.code)} for each player is set aside, out of play (a later attach step takes one copy from the set-aside cards each time)`, read: ["code"] }),
  RemoveFromPoolByCode: (i) => ({ text: `Resolution: each card with code ${codes(i.codes)} leaves the Campaign Pool, once${i.perCopyInVictory === true ? "; one entry leaves for each copy of the code in the victory display and none when there is none" : ""} (nothing for a code the pool does not hold)`, read: ["codes", "perCopyInVictory"] }),
  AttachChosen: (i) => ({ text: `Campaign Setup: the first player chooses a hero and the card with code ${str(i.code)} is attached to it (the card is not added to the Campaign Pool)`, read: ["code"] }),
  NamePrisoner: () => ({ text: "Resolution: the hero in play with the most damage is the prisoner, chosen at random with the seed among those tied; the name is written to the Campaign Log's prisoner fact", read: [] }),
  ReturnSetAsideHero: (i) => ({ text: `the first player takes control of the set-aside hero with code ${str(i.code)}, with the cards attached to him: he enters play ready under the first player (nothing with no such hero set aside)`, read: ["code"] }),
  SetAsideLogged: (i) => ({ text: `Campaign Setup: each enemy recorded in the Campaign Log under The Black Gate with the trait ${str(i.trait)} is set aside, out of play, one copy for each recorded (nothing is set aside with no log)`, read: ["trait"] }),
  SetAsideHeroWithAttachments: (i) => ({ text: `Campaign Setup: the first player attaches the cards with codes ${codes(i.attach)}, from the supply, to the hero with code ${str(i.hero)} and sets him aside, out of play, with an empty resource pool (he returns with an empty one)`, read: ["hero", "attach"] }),
  RemoveBurdenSets: (i) => ({ text: `Campaign Setup: the pool's burdens of the burden sets ${(Array.isArray(i.sets) ? i.sets : []).map((one) => `"${str(one)}"`).join(", ")} are not dealt this scenario; they stay in the pool, only left out of the decks the setup builds${i.playerDecks === true ? " (the encounter deck and each player's deck: a burden a player shuffles into their deck misses that deck too)" : " (the encounter deck)"}`, read: ["sets", "playerDecks"] }),
  AddToHandAfterMulligan: (i) => ({ text: `Campaign Setup: each player adds a copy of the card with code ${str(i.code)} to their hand after drawing their starting hand, a mulligan included (it joins the hand once every player has chosen)`, read: ["code"] }),
};

export const GRAPPLE_SAMPLES: Samples = {
  ShuffleSetAsideSet: [{ verb: "ShuffleSetAsideSet", set: "Angmar Orcs" }],
  FlipSetAside: [{ verb: "FlipSetAside", name: "Temple Guardian" }],
  FlipElite: [{ verb: "FlipElite", name: "Captain Sahír", to: "lastPlayer" }],
  FlipEliteAndAttack: [{ verb: "FlipEliteAndAttack", name: "Captain Sahír" }],
  AttackFirstPlayer: [{ verb: "AttackFirstPlayer" }],
  AddSetAsideToHand: [{ verb: "AddSetAsideToHand", code: "11195" }],
  AddResourcesSetAside: [{ verb: "AddResourcesSetAside", codes: ["11076", "11078"], amount: 1 }],
  RemoveEncounterSet: [{ verb: "RemoveEncounterSet", set: "Corsair Raiders" }, { verb: "RemoveEncounterSet", set: "Mountains of Shadow", setAsideOnly: true }],
  DiscardUntilGrapple: [{ verb: "DiscardUntilGrapple", trait: "Tentacle", count: { players: true, plus: 1 } }],
  ResolveGrapple: [{ verb: "ResolveGrapple", target: "picked" }],
  EngageOrGrapple: [{ verb: "EngageOrGrapple" }],
  DiscardTopGrapple: [{ verb: "DiscardTopGrapple", count: 3 }],
  PutObjectiveAllyIntoPlay: [{ verb: "PutObjectiveAllyIntoPlay", code: "01135" }],
  CarryOver: [{ verb: "CarryOver", codes: ["01132"], eachPlayer: true }],
  SetAsideEachPlayer: [{ verb: "SetAsideEachPlayer", code: "01133" }],
  RemoveFromPoolByCode: [{ verb: "RemoveFromPoolByCode", codes: ["10158"], perCopyInVictory: true }],
  AttachChosen: [{ verb: "AttachChosen", code: "01134" }],
  NamePrisoner: [{ verb: "NamePrisoner" }],
  ReturnSetAsideHero: [{ verb: "ReturnSetAsideHero", code: "145001" }],
  SetAsideLogged: [{ verb: "SetAsideLogged", trait: "Harad" }],
  SetAsideHeroWithAttachments: [{ verb: "SetAsideHeroWithAttachments", hero: "145001", attach: ["142014", "145013"] }],
  RemoveBurdenSets: [{ verb: "RemoveBurdenSets", sets: ["The Ring Goes South"], playerDecks: true }],
  AddToHandAfterMulligan: [{ verb: "AddToHandAfterMulligan", code: "41048" }],
};
