// The pieces The Ring-maker adds (src/catalog/families/ring-maker.ts): time counters taken off the current quest, a treachery that goes into a hand and stays, the enemy a discard puts into play engaged, the out-of-play decks of To Catch an Orc, Mugash's return to the staging area, and the samples read-fields.test.ts checks them with.
import { amt, type Samples, type Templates } from "../family-kit.ts";
import { str } from "../kit.ts";

export const RING_MAKER_TEMPLATES: Templates = {
  RemoveTimeFromQuest: (i, ctx) => ({ text: `up to ${amt(i.amount, ctx)} time counter(s) come off the current quest stage, one at a time; when the last one goes the stage's Forced effect for it resolves (a stage with none loses none)`, read: ["amount"] }),
  DrawSelfIntoHand: () => ({ text: "this card goes into the acting player's hand, which is no draw from a deck (no card hears a draw), and cannot leave that hand; the reveal does not discard it", read: [] }),
  EngageTopDiscarded: (i) => ({ text: `of the cards this effect discarded from the encounter deck, the ${str(i.trait)} enemy discarded last is put into play engaged with the acting player (as if it had engaged him; nothing when none was discarded)`, read: ["trait"] }),
  CreateOutOfPlayDecks: (i) => ({ text: `each player moves the top ${i.count} cards of his deck (all of it when fewer) into his out-of-play deck, a facedown stack of his own: out of play, owned by him, no draw and no discard`, read: ["count"] }),
  ShuffleIntoOutOfPlayDecks: (i) => ({ text: `the set-aside ${str(i.once)} and one set-aside ${str(i.perOtherPlayer)} for each other player are dealt one to each player at random and shuffled facedown into that player's out-of-play deck (the copies left stay set aside)`, read: ["once", "perOtherPlayer"] }),
  RevealOutOfPlay: (i, ctx) => ({
    text: `the acting player reveals the top ${amt(i.amount, ctx)} card(s) of his out-of-play deck (all it holds; none reveals nothing): each enemy is added to the staging area, not revealed${i.chooseForHand ? "; he chooses 1 of the other cards for his hand" : ""}; every other card is discarded to its owner's discard pile; the deck is not shuffled`,
    read: ["amount", "chooseForHand", "revealed"],
  }),
  ShuffleHandCardIntoOutOfPlay: (i) => ({ text: `the acting player puts 1 ${i.random ? "random " : ""}card of his hand, not one that cannot leave it, facedown into his out-of-play deck and shuffles the deck (nothing with an empty hand)`, read: ["random"] }),
  EngageCaptiveHolder: (i) => ({ text: `(constant, does nothing when run) while this enemy is in the staging area or engaged with another player it engages the player who controls a hero with ${str(i.captive)} attached, at once and whatever its engagement cost`, read: ["captive"] }),
  RevealChosenFromDiscard: (i) => ({ text: `the acting player chooses a card of type ${(i.types as string[]).join(" or ")} in the encounter discard pile (whichever card lies there; a pile with none does nothing) and reveals it in full: its When Revealed effects and keywords resolve (an objective with Guarded takes its guard) and it joins the staging area; the card has left the pile for the next player`, read: ["types"] }),
  CapRefresh: (i) => ({ text: `the acting player chooses, one at a time, the exhausted characters he controls beyond ${i.amount} that would ready in the refresh phase: they stay exhausted this phase (nothing with ${i.amount} or fewer)`, read: ["amount"] }),
  AttackNalir: () => ({ text: "the picked enemy, in the staging area or engaged with any player, makes an immediate attack against the player who controls Nalir (it is dealt a shadow card; that player declares defenders as for any attack, and undefended damage must be assigned to Nalir); nothing happens when no player controls Nalir", read: [] }),
  EliminateAtLevel: () => ({ text: "each player whose threat is at or above his threat elimination level now (50, less what the effects before this one took off) is eliminated at once", read: [] }),
  TriggerScour: (i) => ({
    text: `${i.scope === "topmostDiscard"
      ? "the card nearest the top of the encounter discard pile that has a Scour effect resolves that effect as its source and stays in the discard pile (nothing when none has)"
      : "each card in play (staging area, engaged, active location) that has a Scour effect resolves it as its source, one after the other, in the order the first player chooses (asked when two cards with different titles are left); the set is fixed as the trigger starts"}${i.remaining ? ` (${(i.remaining as string[]).length} left to resolve)` : ""}`,
    read: ["scope", "remaining"],
  }),
  BuryDamagedLocations: () => ({ text: "(constant, does nothing when run) at each settle a location in play, in the staging area or active, whose damage is at least its printed quest points goes facedown underneath this card, out of play, its tokens and attachments discarded", read: [] }),
  PlaceRandomHandUnder: (i) => ({ text: `each player, the first player first, places 1 random card of his hand facedown underneath the card in play with code ${str(i.code)}, out of play and still his own (nothing with an empty hand)`, read: ["code"] }),
  PlaceDestroyedUnder: (i) => ({ text: `the ${i.card ?? "other"} card, a character the attack destroyed that lies in its owner's discard pile, goes facedown underneath the card in play with code ${str(i.code)}, out of play and still its owner's`, read: ["code", "card"] }),
  ExcessToActiveLocation: () => ({ text: "the damage of the attack in progress beyond its defender's remaining hit points is placed on the active location (none placed when there is no active location)", read: [] }),
  ReturnAttachedEnemy: (i) => ({ text: `each enemy named ${str(i.name)} lying attached to a card goes back to the staging area as an enemy (one anywhere else stays)`, read: ["name"] }),
};

export const RING_MAKER_SAMPLES: Samples = {
  RemoveTimeFromQuest: [{ verb: "RemoveTimeFromQuest", amount: 1 }],
  DrawSelfIntoHand: [{ verb: "DrawSelfIntoHand" }],
  EngageTopDiscarded: [{ verb: "EngageTopDiscarded", trait: "Dunland" }],
  CreateOutOfPlayDecks: [{ verb: "CreateOutOfPlayDecks", count: 20 }],
  ShuffleIntoOutOfPlayDecks: [{ verb: "ShuffleIntoOutOfPlayDecks", once: "07024", perOtherPlayer: "07025" }],
  RevealOutOfPlay: [{ verb: "RevealOutOfPlay", amount: 3, chooseForHand: true }],
  ShuffleHandCardIntoOutOfPlay: [{ verb: "ShuffleHandCardIntoOutOfPlay", random: true }],
  RevealChosenFromDiscard: [{ verb: "RevealChosenFromDiscard", types: ["enemy", "objective"] }],
  CapRefresh: [{ verb: "CapRefresh", amount: 5 }],
  ReturnAttachedEnemy: [{ verb: "ReturnAttachedEnemy", name: "Mugash" }],
  EngageCaptiveHolder: [{ verb: "EngageCaptiveHolder", captive: "Mugash" }],
  AttackNalir: [{ verb: "AttackNalir" }],
  EliminateAtLevel: [{ verb: "EliminateAtLevel" }],
  TriggerScour: [{ verb: "TriggerScour", scope: "topmostDiscard", remaining: ["a"] }],
  BuryDamagedLocations: [{ verb: "BuryDamagedLocations" }],
  PlaceRandomHandUnder: [{ verb: "PlaceRandomHandUnder", code: "08125" }],
  PlaceDestroyedUnder: [{ verb: "PlaceDestroyedUnder", code: "08125", card: "picked" }],
  ExcessToActiveLocation: [{ verb: "ExcessToActiveLocation" }],
};
