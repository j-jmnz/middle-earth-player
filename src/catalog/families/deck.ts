// The vocabulary the player's deck, hand and discard pile: look, arrange, search, return, play from the discard pile adds to effect records: simple verbs, triggers and stat flags.
// effect-schema-verbs.ts, effect-schema.ts and effect-schema-stats.ts compose them.
//
// Looking at the top of a deck is the encounter family's LookAtTop (deck `own` or `picked`); a Pick with `looked` chooses
// among the cards it showed (or the cards DiscardFromDeck discarded); ArrangeTop puts them back. Searching for several cards
// is an Each with `upTo` (effect-schema.ts).
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { amountSchema, cardRefSchema, positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { pickSchema } from "../effect-schema-pick.ts";
import { verbFlags } from "../verb-flags.ts";

// Where a player card may be when MoveCard moves it.
const zone = z.enum(["hand", "play", "discard", "deck"]);

const VERBS = [
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
  // The card picked before the last (in a player's hand) goes to the hand of the player picked last ("add it to another
  // player's hand"), and is the picked card again ("the chosen card"). Its owner does not change.
  z.strictObject({ verb: z.literal("GivePicked"), ...when }),
  // The card picked before the last (in a deck) and the last picked card (in a hand) change places: the hand's card takes the
  // deck card's position and counts as one of the cards the effect looked at ("Switch one of those cards with a card from
  // your hand").
  z.strictObject({ verb: z.literal("SwapPicked"), ...when }),
  // Every card in the discard pile of the actor (or of the last picked player) goes into that player's deck, which is then
  // shuffled.
  z.strictObject({ verb: z.literal("ShuffleDiscardIntoDeck"), who: z.enum(["actor", "picked"]).optional(), ...when }),
  // "Each player may shuffle 1 copy of ~ into his deck" (132067:A:1): the set-aside card with the printed code goes into the acting player's deck, and the deck is shuffled. Nothing happens when none is set aside.
  z.strictObject({ verb: z.literal("ShuffleSetAsideIntoDeck"), code: z.string().min(1), ...when }),
  // The actor's hand (but the source card) is shuffled into their deck. The effect's X becomes how many cards that was ("Count
  // the number of cards in your hand and shuffle your hand into your deck. Then, draw an equal number of cards").
  // `keepPicked`: the picked card stays in the hand and the rest is shuffled in ("Each player chooses 1 card in his hand and shuffles the rest into his deck", 51304:B:1); with no picked card in the hand, all of it goes.
  z.strictObject({ verb: z.literal("ShuffleHandIntoDeck"), keepPicked: z.literal(true).optional(), ...when }),
  // "Shuffles the card in his hand with the highest printed cost back into his deck" (901703:A:1): the actor's hand card with the highest printed cost (a card with no printed cost or an X cost counting 0) goes into the deck, which is shuffled; the actor chooses among cards tied for
  // the highest. An empty hand does nothing.
  z.strictObject({ verb: z.literal("ShuffleHighestCostIntoDeck"), ...when }),
  // "Each player chooses and shuffles a hero he controls into his deck. When he draws that hero, he puts it into play" (04124:A:1): the last picked hero leaves play (it is not destroyed; its attachments are discarded) and is shuffled into its owner's deck, where it is marked; when the owner
  // draws it, it is put into play at once among his heroes, ready, with no damage or resources (families/deck/hero.ts). A seat with no hero in play and one in its deck is not eliminated (rr.player-elimination).
  z.strictObject({ verb: z.literal("ShuffleHeroIntoDeck"), ...when }),
  // Every card in the actor's discard pile leaves the game ("remove all cards in that player's discard pile from the game", 900908:A:1; sotm.removed-from-game): a hero among them goes with the rest, and the cards are announced to nothing.
  z.strictObject({ verb: z.literal("RemoveDiscardFromGame"), ...when }),
  // The top `amount` cards of the actor's deck (shuffled first with `shuffle`) go to their discard pile, each announced as
  // discarded from the deck, and become the cards the effect looked at (a Pick with `looked` chooses among them). With
  // `count`, the effect's X becomes how many of them match it (read with the X the effect had, for `costIsX`) and whose printed
  // cost is at least `costAtLeast`, and the first such card is picked ("" when none is): "If at least one of those cards has
  // cost equal to the named number", "If the discarded card's printed cost is equal to or higher than ...".
  // A Shadow effect with it runs in a frame, which holds the cards discarded for the amount `discarded` (09039:A:2, 09064:A:2).
  verbFlags(z.strictObject({
    verb: z.literal("DiscardFromDeck"),
    amount: positiveAmountSchema,
    shuffle: z.boolean().optional(),
    count: pickSchema.optional(),
    costAtLeast: amountSchema.optional(),
    ...when,
  }), { runsInFrame: true }),
  // The effect's X grows by this amount, read now ("the total cost of the allies exhausted to pay for this effect").
  z.strictObject({ verb: z.literal("AddToX"), amount: amountSchema, ...when }),
  // The instructions after it in this effect resolve for the player picked last (`pickedPlayer`: their hand, deck and choices,
  // "That player searches the top 5 cards of his deck"), for the first player (`firstPlayer`: an encounter effect that targets a single player or card names it through the first player, rr.first-player),
  // or again for the effect's own actor (`actor`).
  z.strictObject({ verb: z.literal("ActAs"), who: z.enum(["pickedPlayer", "actor", "firstPlayer"]), ...when }),
  // The actor plays a card that matches `pick` (from a discard pile, as if it were in their hand) when it could be played now:
  // an event resolves its Action and goes to its owner's discard pile, an attachment goes on a host the actor chooses. It is
  // paid for from the actor's heroes, or costs nothing with `free` (an attachment or an ally is played only for free). Copies of one card
  // are one choice. The played card is picked for the instructions after it ("Then, place that event on the bottom of your
  // deck"). `card` is engine use: the attachment chosen, waiting for its host.
  z.strictObject({ verb: z.literal("PlayFrom"), pick: pickSchema, free: z.boolean().optional(), card: z.string().optional(), ...when }),
  // The next event with the Doomed keyword the actor plays before `until` raises each player's threat by `amount` less
  // (not below 0): "Reduce the X value of the next Doomed X event you play this phase by 2".
  z.strictObject({ verb: z.literal("ReduceNextDoomed"), amount: z.number().int().positive(), until: z.enum(["endOfPhase", "endOfRound"]), ...when }),
  // A constant: each card that matches the pick gains Doomed `amount`, on top of any Doomed X it prints ("Each event card gains doomed 1", 10173:A:1; rr.keywords, rr.doomed-x): a player who plays it raises each player's threat by the sum.
  // Read when the card is played (rules/player/planning.ts); it does nothing when a record runs it.
  z.strictObject({ verb: z.literal("GainsDoomed"), amount: z.union([z.number().int().positive(), amountSchema]), pick: pickSchema, byEncounterDeck: z.boolean().optional() }),
  // Setup: the actor keeps their opening hand and takes no mulligan; the next player decides ("instead of taking a mulligan").
  z.strictObject({ verb: z.literal("KeepOpeningHand"), ...when }),
  // Read by the play of the card, never run: in a Response to `paying` on the card itself, its player may pay this much less of
  // its cost by paying that Response's cost ("discard the top 2 cards of your deck to reduce its cost by 2").
  z.strictObject({ verb: z.literal("ReducePlayCost"), amount: z.number().int().positive(), ...when }),
] as const;

const TRIGGERS = [
  // About a card: one of its own abilities was triggered, an Action or a Response its controller initiated or a Forced effect that triggered (rr.triggered-ability: "triggers its ability", 143068:A:2). Heard only in a game that has a record on it.
  "abilityTriggered",
  // About the seat and the card: a player triggered an Action or a Response effect: the Action or Response of a card in play, or an event played for its Action or Response, once each; not a Forced effect, a Travel or an encounter card's effect ("After a player triggers an 'Action' or 'Response' effect", 09040:A:1; rr.triggered-ability). Heard only in a game that has a record on it.
  "playerAbilityTriggered",
  // About the seat: it discarded cards from the top of its deck, once for the whole discard effect or cost, whatever the number of cards (at least 1 moved), not for a discard from the bottom ("After the first player discards any number of cards from the top of his deck", 09038:A:2). Heard only in a game that has a record on it.
  "deckTopDiscarded",
  // About the seat: its opening hand was just drawn at setup. A Response here is offered in the mulligan window, in place of
  // the mulligan (Galdor of the Havens, 11002).
  "setupHandDrawn",
  // About a card its player is playing from the hand, while its cost is paid ("When you play ~ from your hand"). The play
  // reads a Response to it on the card itself (ReducePlayCost): it is used when the payment comes to less than the cost.
  "paying",
] as const;

const FLAGS = [
  // Held by the table while a card in play says so: no player gains resources, the resource phase's collection and every effect that adds resources to a pool included, not the heroes' starting resources (rr.resources: "Players cannot draw cards or gain
  // resources", 143078:B:1). Read by gainSeatResources (rules/interpret/interpret.ts) and by mayGainResources (rules/families/misc/guards.ts), which every effect that adds resources to a pool asks.
  "cannotGainResources",
  // Held by the table while a card in play says so: a player with 0 cards in hand is eliminated from the game, checked at each settle once what emptied the hand has finished (rr.constant-ability, "If a player has 0 cards in his hand", 143080:B:3; settle hook of the deck family).
  "eliminatedAtEmptyHand",
  // Held by the table while a card in play says so: a player with no cards in his deck is eliminated from the game, checked as `eliminatedAtEmptyHand` is (rr.constant-ability, "If a player has no cards in his deck, he is eliminated from the game", 09073:B:3, 09074:B:2).
  "eliminatedAtEmptyDeck",
  // Held by the table until the end of the phase: each ally that leaves play goes to its owner's hand instead of the discard
  // pile (Rallying Cry, 10003).
  "alliesToHand",
  // Held by a seat: the next Doomed event it plays raises threat by this much less (ReduceNextDoomed).
  "doomedReduction",
  // Held by the table while a card in play says so: no player draws a card ("While Enchanted Stream is the active location, players
  // cannot draw cards", 01095:A:1). drawOne (rules/interpret/interpret.ts) reads it, so every draw is stopped, a resource phase draw included.
  "cannotDraw",
  // Held by a seat: it cannot draw cards from card effects ("While Cold-wight is engaged with a player, that player cannot draw cards from card effects", 148012:A:1). The framework's draws (the opening hand, the resource phase's) are not card effects, so they still happen;
  // drawMany (rules/interpret/interpret.ts) reads it.
  "noCardDraw",
] as const;

export const manifest = { name: "deck", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
