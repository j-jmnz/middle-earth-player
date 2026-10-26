// The vocabulary the player's deck, hand and discard pile: look, arrange, search, return, play from the discard pile adds to effect records: simple verbs, triggers and stat flags.
// effect-schema-verbs.ts, effect-schema.ts and effect-schema-stats.ts compose them.
//
// Looking at the top of a deck is the encounter family's LookAtTop (deck `own` or `picked`); a Pick with `looked` chooses
// among the cards it showed (or the cards DiscardFromDeck discarded); ArrangeTop puts them back. Searching for several cards
// is an Each with `upTo` (effect-schema.ts).
import { z } from "zod";

import { amountSchema, cardRefSchema, positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { pickSchema } from "../effect-schema-pick.ts";

// Where a player card may be when MoveCard moves it.
const zone = z.enum(["hand", "play", "discard", "deck"]);

export const VERBS = [
  // Moves a player card (the picked card, or `card`) to its owner's hand, to the top or bottom of its owner's deck, shuffles it
  // into that deck, puts it in its owner's discard pile, or removes it from the game. With `from`, only a card that is in one
  // of those zones moves ("move that ally from the discard pile", "if the chosen card is in that player's hand or in play").
  // A card that leaves play this way loses its attachments and tokens, and an ally announces allyLeftPlay.
  z.strictObject({
    verb: z.literal("MoveCard"),
    card: cardRefSchema.optional(),
    to: z.enum(["hand", "deckTop", "deckBottom", "deckShuffle", "discard", "removed"]),
    from: z.array(zone).min(1).optional(),
    ...when,
  }),
  // Puts a player card that is out of play (the picked card, or `card`) into play without playing it: under the actor's
  // control, its owner's (`owner`), or the last picked player's (`picked`). A hero joins that player's heroes. An attachment
  // goes on a card it may be attached to that matches `host`, chosen by the actor (it stays where it is when none can take
  // it). `exhausted`, `committed` (to the quest, exhausted) and `damage` (tokens placed on it) set how it enters play. It is
  // announced as entering play. A unique card already in play stays where it is.
  z.strictObject({
    verb: z.literal("PutIntoPlay"),
    card: cardRefSchema.optional(),
    under: z.enum(["actor", "owner", "picked"]).optional(),
    exhausted: z.boolean().optional(),
    committed: z.boolean().optional(),
    damage: z.number().int().positive().optional(),
    host: pickSchema.optional(),
    ...when,
  }),
  // The last picked card (in a player's hand) goes to the hand of the player picked before it ("add it to another player's
  // hand"). Its owner does not change.
  z.strictObject({ verb: z.literal("GivePicked"), ...when }),
  // The card picked before the last (in a deck) and the last picked card (in a hand) change places: the hand's card takes the
  // deck card's position and counts as one of the cards the effect looked at ("Switch one of those cards with a card from
  // your hand").
  z.strictObject({ verb: z.literal("SwapPicked"), ...when }),
  // Every card in the discard pile of the actor (or of the last picked player) goes into that player's deck, which is then
  // shuffled.
  z.strictObject({ verb: z.literal("ShuffleDiscardIntoDeck"), who: z.enum(["actor", "picked"]).optional(), ...when }),
  // The actor's hand (but the source card) is shuffled into their deck. The effect's X becomes how many cards that was ("Count
  // the number of cards in your hand and shuffle your hand into your deck. Then, draw an equal number of cards").
  z.strictObject({ verb: z.literal("ShuffleHandIntoDeck"), ...when }),
  // The top `amount` cards of the actor's deck (shuffled first with `shuffle`) go to their discard pile, each announced as
  // discarded from the deck, and become the cards the effect looked at (a Pick with `looked` chooses among them). With
  // `count`, the effect's X becomes how many of them match it (read with the X the effect had, for `costIsX`) and whose printed
  // cost is at least `costAtLeast`, and the first such card is picked ("" when none is): "If at least one of those cards has
  // cost equal to the named number", "If the discarded card's printed cost is equal to or higher than ...".
  z.strictObject({
    verb: z.literal("DiscardFromDeck"),
    amount: positiveAmountSchema,
    shuffle: z.boolean().optional(),
    count: pickSchema.optional(),
    costAtLeast: amountSchema.optional(),
    ...when,
  }),
  // The effect's X grows by this amount, read now ("the total cost of the allies exhausted to pay for this effect").
  z.strictObject({ verb: z.literal("AddToX"), amount: amountSchema, ...when }),
  // The instructions after it in this effect resolve for the player picked last (`pickedPlayer`: their hand, deck and choices,
  // "That player searches the top 5 cards of his deck"), or again for the effect's own actor (`actor`).
  z.strictObject({ verb: z.literal("ActAs"), who: z.enum(["pickedPlayer", "actor"]), ...when }),
  // The actor plays a card that matches `pick` (from a discard pile, as if it were in their hand) when it could be played now:
  // an event resolves its Action and goes to its owner's discard pile, an attachment goes on a host the actor chooses. It is
  // paid for from the actor's heroes, or costs nothing with `free` (an attachment is played only for free). Copies of one card
  // are one choice. The played card is picked for the instructions after it ("Then, place that event on the bottom of your
  // deck").
  z.strictObject({ verb: z.literal("PlayFrom"), pick: pickSchema, free: z.boolean().optional(), ...when }),
  // The next event with the Doomed keyword the actor plays before `until` raises each player's threat by `amount` less
  // (not below 0): "Reduce the X value of the next Doomed X event you play this phase by 2".
  z.strictObject({ verb: z.literal("ReduceNextDoomed"), amount: z.number().int().positive(), until: z.enum(["endOfPhase", "endOfRound"]), ...when }),
  // Setup: the actor keeps their opening hand and takes no mulligan; the next player decides ("instead of taking a mulligan").
  z.strictObject({ verb: z.literal("KeepOpeningHand"), ...when }),
  // Read by the play of the card, never run: in a Response to `paying` on the card itself, its player may pay this much less of
  // its cost by paying that Response's cost ("discard the top 2 cards of your deck to reduce its cost by 2").
  z.strictObject({ verb: z.literal("ReducePlayCost"), amount: z.number().int().positive(), ...when }),
] as const;

export const TRIGGERS = [
  // About the seat: its opening hand was just drawn at setup. A Response here is offered in the mulligan window, in place of
  // the mulligan (Galdor of the Havens, 11002).
  "setupHandDrawn",
  // About a card its player is playing from the hand, while its cost is paid ("When you play ~ from your hand"). The play
  // reads a Response to it on the card itself (ReducePlayCost): it is used when the payment comes to less than the cost.
  "paying",
] as const;

export const FLAGS = [
  // Held by the table until the end of the phase: each ally that leaves play goes to its owner's hand instead of the discard
  // pile (Rallying Cry, 10003).
  "alliesToHand",
  // Held by a seat: the next Doomed event it plays raises threat by this much less (ReduceNextDoomed).
  "doomedReduction",
] as const;
