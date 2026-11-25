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
  EngageCaptiveHolder: (i) => ({ text: `(constant, does nothing when run) while this enemy is in the staging area it engages the player who controls a hero with ${str(i.captive)} attached, at once and whatever its engagement cost`, read: ["captive"] }),
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
  ReturnAttachedEnemy: [{ verb: "ReturnAttachedEnemy", name: "Mugash" }],
  EngageCaptiveHolder: [{ verb: "EngageCaptiveHolder", captive: "Mugash" }],
};
