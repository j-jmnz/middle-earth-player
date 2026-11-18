// The vocabulary the encounter deck: look, move, discard, search, cancel and replace revealed cards, reveal triggers adds to effect records: simple verbs, triggers and stat flags.
// effect-schema-verbs.ts, effect-schema.ts and effect-schema-stats.ts compose them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { amountSchema, cardRefSchema, positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

// The printed types of the cards in an encounter deck (rr.encounter-deck).
const encounterType = z.enum(["enemy", "location", "treachery", "objective"]);
// Discard until: a side quest too (10064:B:1).
const discardType = z.enum(["enemy", "location", "treachery", "objective", "encounter-side-quest"]);

const sphere = z.enum(["leadership", "tactics", "spirit", "lore", "neutral", "fellowship", "baggins"]);

const VERBS = [
  // The topmost enemy of the encounter discard pile (the last put there) that has this trait is revealed by the actor in full, as any reveal is: it leaves the pile and enters the staging area, its When Revealed and keywords resolve ("Reveal the topmost Tentacle enemy in the
  // encounter discard pile to travel here", 901506:A:2). As a Travel cost it cannot be paid with no such enemy in the pile (rr.travel).
  z.strictObject({ verb: z.literal("RevealFromDiscard"), type: z.literal("enemy"), trait: z.string().min(1), ...when }),
  // Deals `amount` damage to each character, any player's, that has an attachment with this trait ("Deal 3 damage to each character with a Tentacle attachment", 901507:A:1). The effect's X becomes the number of characters that were damaged: damage a shield or a cap
  // prevented all of, or that was canceled, leaves the character undamaged ("If no characters were damaged by this effect", a `not x` condition).
  z.strictObject({ verb: z.literal("DamageEachWithAttachment"), amount: z.number().int().positive(), trait: z.string().min(1), ...when }),
  // Shows the actor the top `count` cards (1 by default) of the encounter deck, or of their own deck (`deck: "own"`), in a
  // look window they close with a pass. Nothing moves. The top card becomes the picked card ("that card", "the looked at
  // card"), and the effect remembers every card shown (for ArrangeEncounter and PickEncounter `from: "looked"`). An empty
  // deck shows nothing and picks nothing. `count` may be read (X: "Look at the top X cards"); `deck: "picked"` is the deck of
  // the last picked player, still shown to the actor ("Look at the top X cards of any player's deck", families/deck.ts).
  z.strictObject({ verb: z.literal("LookAtTop"), count: positiveAmountSchema.optional(), deck: z.enum(["encounter", "own", "picked"]).optional(), ...when }),
  // Chooses one encounter card for the instructions after it (the picked card; "" when none matches): among the top `top`
  // cards of the encounter deck (all of it without `top`), the deck and the encounter discard pile, the cards LookAtTop
  // showed that are still on top (`looked`), or the enemies and locations in play (`play`). It must be of `type`, non-unique
  // with `nonUnique`, and have a Threat at most `maxThreat` (read when the choice is offered). The actor chooses; copies of
  // one card in a deck or a pile are one choice (rr.search).
  z.strictObject({
    verb: z.literal("PickEncounter"),
    from: z.enum(["deck", "deckAndDiscard", "looked", "play"]),
    top: z.number().int().positive().optional(),
    type: encounterType.optional(),
    nonUnique: z.boolean().optional(),
    maxThreat: amountSchema.optional(),
    // Not of this printed type ("a non-objective card"), and worth no victory points (the sidequests family's: 04036:A:2).
    notType: encounterType.optional(),
    noVictory: z.boolean().optional(),
    // A card with this Trait ("a Sorcery treachery", 10185:A:3).
    trait: z.string().min(1).optional(),
    ...when,
  }),
  // The actor puts the cards LookAtTop showed that are still on top of the encounter deck back in the order they choose.
  z.strictObject({ verb: z.literal("ArrangeEncounter"), ...when }),
  // Moves an encounter card: the picked card, or `card` (another reference, `previous`: the card picked before the last,
  // `deckTop` / `discardTop`: the top card of the encounter deck or of its discard pile, which then becomes the picked card).
  // It goes to the top or the bottom of the encounter deck (face down), is shuffled into it, goes to the encounter discard
  // pile, to the staging area, into play engaged with the actor, becomes the active location (an active location already
  // there returns to the staging area), or goes to the victory display. A card that leaves play takes its attachments,
  // tokens and shadow cards with it; a card that enters play is announced (encounterEnteredPlay). A player card's effect
  // does not move a card in play that is immune to player card effects.
  z.strictObject({
    verb: z.literal("MoveEncounterCard"),
    card: z.union([cardRefSchema, z.enum(["previous", "deckTop", "discardTop"])]).optional(),
    to: z.enum(["deckTop", "deckBottom", "shuffle", "discard", "staging", "engaged", "activeLocation", "victory", "removed"]),
    ...when,
  }),
  // Sets the effect's X to how many of the top `top` cards of the encounter deck are of `type` (`not`: are not).
  z.strictObject({ verb: z.literal("CountEncounterTop"), top: z.number().int().positive(), type: encounterType, not: z.boolean().optional(), ...when }),
  // Reveals the top card of the encounter deck for the actor, or for the player the answered event happened to
  // (`eventSeat`), in a staging of its own (rr.reveal, rr.staging): the effect goes on once that card is resolved.
  // `times`: that many cards, one after the other, each in a staging of its own ("reveals 1 encounter card for each resource here", 143078:B:2; read once, when the first is revealed).
  verbFlags(z.strictObject({ verb: z.literal("RevealEncounter"), who: z.enum(["actor", "eventSeat", "firstPlayer"]).optional(), times: positiveAmountSchema.optional(), ...when }), { runsInFrame: true, setupRuns: "inForEachPlayer" }),
  // Searches the encounter deck, then its discard pile, then the player's collection (in that order, "search the encounter deck, discard pile, and
  // your collection for a Goblin Sniper", 41041:A:1) for a card with the printed title of `code`, and adds it to the staging area. The app tracks
  // no collection (docs/brief.md): the collection holds every card the game knows, so a copy of `code` is made when neither the deck nor the pile
  // has one. The deck is shuffled by a ShuffleEncounterDeck after it (the line says so).
  z.strictObject({ verb: z.literal("SearchCollection"), code: z.string().min(1), to: z.literal("staging"), ...when }),
  // The topmost `count` cards of the encounter discard pile that are enemies with this Trait are returned to the staging area, not revealed: no When Revealed, no engagement check ("Return the top X Undead enemies in the encounter discard pile to the staging area", 900810:A:1). Fewer when the pile holds
  // fewer. The number returned is the effect's `returned` count, read by `noneReturned` ("If no enemies were returned ... gains surge").
  // Widened for The Redhorn Gate ("Return the top 2 Snow cards in the encounter discard pile to the top of the encounter deck", 04020:A:1; "Return all Snow cards ... in random order", 901308:A:1): `anyType` takes cards of every type, not only enemies; no `count` takes every match;
  // `to: "deckTop"` puts them on top of the encounter deck, facedown, not revealed (the most recent one on top, or shuffled among themselves with `order: "random"`), and they are the cards ArrangeEncounter may put in another order; `treacheries` counts only the treachery
  // cards among them as returned (the effect's `returned`, read by `noneReturned` and `returnedBelow`: "If this effect returned less than 2 Snow treachery cards").
  z.strictObject({ verb: z.literal("ReturnFromDiscard"), trait: z.string().min(1), count: positiveAmountSchema.optional(), anyType: z.literal(true).optional(), to: z.enum(["staging", "deckTop"]).optional(), order: z.literal("random").optional(), treacheries: z.literal(true).optional(), ...when }),

  // Reveals the top `count` cards of the encounter deck one at a time: an enemy is revealed in full in a staging of its own (rr.reveal: its When Revealed, Surge, Doomed and the Forced effects that hear a reveal) and joins the staging area, and every other
  // card is discarded unresolved, with no When Revealed, no Surge and no Doomed ("Reveal the top X cards of the encounter deck, adding all enemies to the staging area. Discard the other revealed cards without resolving them", 03068:B:2, 901110:A:1). When the
  // deck runs out partway the encounter discard pile, the cards just discarded included, is shuffled back and the revealing goes on (rr.running-out-of-cards).
  verbFlags(z.strictObject({ verb: z.literal("RevealTopEnemies"), count: positiveAmountSchema, ...when }), { runsInFrame: true }),

  // The encounter discard pile is shuffled into the encounter deck; with `trait`, only the cards of that printed or gained Trait go back and the deck is shuffled ("Shuffle all Hazard cards in the encounter discard pile back into the encounter deck", 900708:A:2).
  // With `type`, only the cards of that printed type go back ("Shuffle all locations in the encounter discard pile back into the encounter deck", 03039:A:2). With `name`, only the cards with that title go back ("shuffle all copies of Balin's Doom in the encounter discard pile back into the encounter deck", 901101:A:3). With `alsoVictory` the matching cards in the victory display go back too ("Reshuffle all locations in the discard pile and victory display back into the encounter deck", 04018:A:1); the cards that went, from both places, are the effect's `returned` count (`returnedBelow`).
  z.strictObject({ verb: z.literal("ShuffleEncounterDiscard"), trait: z.string().min(1).optional(), type: z.enum(["location", "enemy", "treachery"]).optional(), name: z.string().min(1).optional(), alsoVictory: z.literal(true).optional(), ...when }),

  // Every location in the victory display goes back into the encounter deck, which is then shuffled ("Shuffle all locations in the victory display into the encounter deck", 144066:A:1). They lose nothing they had: a card in the display has no tokens.
  z.strictObject({ verb: z.literal("ShuffleVictoryIntoEncounterDeck"), ...when }),
  // Discards cards from the top of the encounter deck until one of `type` is discarded, or the deck is empty (rr.effects).
  // That card becomes the picked card. With `trait`, the card must have that trait too ("a Warg enemy", 142025:A:2).
  // `types` instead of `type`: a card of any of them ("until he discards an enemy or location", 18078:A:1).
  z.strictObject({ verb: z.literal("DiscardUntil"), type: discardType.optional(), types: z.array(encounterType).min(2).optional(), trait: z.string().min(1).optional(), ...when }),
  // The "when revealed" effects of the picked card (or `card`) resolve for the actor, as if it had just been revealed. It
  // was not revealed from the encounter deck, so they are not offered to cancels of a card just revealed.
  verbFlags(z.strictObject({ verb: z.literal("ResolveWhenRevealed"), card: cardRefSchema.optional(), ...when }), { runsInFrame: true }),
  // The staging step of this phase reveals `amount` fewer cards (rr.step-3-3), to a minimum of `min` (0 or 1). With `who: picked`, the player picked last reveals that many fewer
  // ("That player reveals 1 fewer encounter card this phase (to a minimum of 0)", 143020:A:2): the reveals the players make in turn skip that player's, and nothing else is shortened. A player's own reveal is one card, so `min: 1` leaves it as it is.
  z.strictObject({ verb: z.literal("RevealFewer"), amount: z.number().int().positive(), min: z.union([z.literal(0), z.literal(1)]), who: z.literal("picked").optional(), ...when }),
  // The staging step of this phase reveals `amount` more cards (rr.step-3-3): "reveal an additional encounter card this phase"
  // (141080:A:2). The extra cards are revealed by the players in turn, from the first player on.
  z.strictObject({ verb: z.literal("RevealMore"), amount: z.number().int().positive(), ...when }),
  // A lasting effect on the encounter cards revealed from now until `until`, for those of `type` (any type without it):
  // `threatZero`, the next such card added to the staging area has Threat 0 until the end of the phase; `damage`, the first
  // such card revealed takes `amount` damage from the source; `discard`, the next card revealed is discarded without
  // resolving its effects if it is of `type` (the effect ends with that reveal either way); `readyHost`, when such a card
  // is revealed while the source is ready and its host exhausted, the source exhausts and its host readies.
  z.strictObject({
    verb: z.literal("WatchReveals"),
    effect: z.enum(["threatZero", "damage", "discard", "readyHost"]),
    type: encounterType.optional(),
    amount: z.number().int().positive().optional(),
    until: z.enum(["endOfPhase", "endOfRound"]),
    ...when,
  }),
  // The players travel to the location (the picked card, or `target`) without resolving its Travel effect (rr.travel); an
  // active location already there returns to the staging area first. Nothing happens if the players cannot travel there.
  // With `unlessActive` the players travel only when no location is active ("The players cannot travel if another location card is active", rr.active-location; "travel to Mordor Road", 146076:A:1): an active location stays, and the location stays in the staging area.
  z.strictObject({ verb: z.literal("TravelTo"), target: cardRefSchema.optional(), unlessActive: z.literal(true).optional(), ...when }),
  // Places `amount` progress on the current quest; the active location takes it first (rr.active-location).
  z.strictObject({ verb: z.literal("ProgressQuest"), amount: positiveAmountSchema, ...when }),
  // The actor's threat becomes `amount` if it is lower ("set your threat equal to the engagement cost of that enemy").
  z.strictObject({ verb: z.literal("RaiseThreatTo"), amount: amountSchema, ...when }),
  // Lowers the actor's threat by the amount the answered encounterThreatRaised event raised it.
  z.strictObject({ verb: z.literal("LowerThreatByRaise"), ...when }),
  // The actor pays `amount` resources of `sphere` from the pools of heroes they control, choosing the hero when several
  // could pay. Nothing is paid when they cannot pay it all. The last hero that paid becomes the picked card ("" when
  // nothing was paid), so what follows can depend on the payment.
  z.strictObject({ verb: z.literal("PayResources"), amount: z.number().int().positive(), sphere, ...when }),
  // The event being played goes back to its owner's hand instead of the discard pile once its effect is done.
  z.strictObject({ verb: z.literal("ReturnEventToHand"), ...when }),
  // The picked card (the top card of the actor's deck) is played for no cost if it can be: an ally enters play, an
  // attachment is attached to a host the actor chooses, an event's Action resolves. Otherwise it goes to the bottom of
  // the deck. `embassy`: the player card of the Embassy from the Dark Tower's current pair (EmbassyNext), lying faceup in front of its owner, is played by its owner instead; when it cannot be played it goes to its owner's discard pile (146072:B:1).
  z.strictObject({ verb: z.literal("PlayRevealedFree"), embassy: z.literal(true).optional(), ...when }),
  // Ambush (dwd.ambush; engine use, a frame the engine pushes when an enemy with the keyword was added to the staging area): each player in turn, the first player first, makes an engagement check against the source enemy alone (rr.engagement-check); the first player whose threat
  // reaches its engagement cost engages it and the checks end, and an enemy nobody engages stays in the staging area. No effect while the table holds `ignoreAmbush` (Barren Hills, 04045:A:1).
  z.strictObject({ verb: z.literal("AmbushChecks"), ...when }),
  // "Each player discards the top card of the encounter deck, starting with the first player. Each player who discards an enemy with the ambush keyword must make an engagement check against that enemy" (901405:A:2; rr.running-out-of-cards): the actor discards the top card of
  // the encounter deck (the discard pile is shuffled back when it is empty), and with `ambushCheck` makes one engagement check against it when it is an enemy with ambush: it leaves the discard pile and enters the actor's play area engaged when the actor's threat reaches its
  // engagement cost, else it stays in the discard pile. Run for each player by ForEachPlayer.
  z.strictObject({ verb: z.literal("DiscardTopEncounter"), ambushCheck: z.literal(true).optional(), ...when }),
  // A constant marker on a location ("While Goblin Gate is the active location, the first enemy revealed from the encounter deck each round gains ambush", 04043:A:1; "While Concealed Woods is the active location, the first enemy with the ambush keyword revealed from the encounter deck each round
  // gains surge", 901408:A:1): the first enemy (with `withKeyword`, the first one that has it, printed or gained) revealed from the encounter deck in a round of a game that deals a holder is noted for the round, whether or not the holder is in play then (Reading 11 of The Weather Hills, as
  // FirstTraitSurge), and it gains `keyword` for the rest of the round when the marker's own condition holds. A gained ambush is a card flag (`gainsAmbush`); a gained surge is the reveal's own.
  z.strictObject({ verb: z.literal("FirstEnemyGains"), keyword: z.enum(["ambush", "surge"]), withKeyword: z.literal("ambush").optional() }),
  // Reveals the enemies in the encounter discard pile one after another, each in full (rr.reveal: keywords, When Revealed and the Responses to a reveal), ending in the staging area ("Reveal all enemies discarded by this effect", 901402:A:1). `ids` is engine use: the enemies still to reveal, kept while the
  // one before is resolving.
  verbFlags(z.strictObject({ verb: z.literal("RevealEnemies"), ids: z.array(z.string()).optional(), ...when }), { runsInFrame: true }),
] as const;

const TRIGGERS = [
  // About an encounter card (the event's subject) just placed in the encounter discard pile, from the deck, from play or from anywhere else ("After an Athelas card is placed in the discard pile", 900601:A:4). Announced only in a game whose table holds the flag
  // `noteEncounterDiscards`, which the Setup of the card that hears it sets.
  "encounterDiscarded",
  // About an encounter card: it entered play, placed in the staging area once its staging resolved (rr.staging), or put
  // into play by a player card effect (MoveEncounterCard).
  "encounterEnteredPlay",
  // The staging step of the quest phase ends, after its last card is resolved (rr.step-3-3).
  "stagingStepEnds",
  // About a location: it is the first location revealed by the encounter deck this round.
  "firstLocationRevealed",
  // About the seat: an encounter card effect raised its threat (the event's amount is how much).
  "encounterThreatRaised",
  // About an encounter card in the encounter deck: a card effect made a player look at the cards of the encounter deck and this card is among them (`seat` is the player looking). A Forced effect of the card with `subject: "self"` hears it from the deck ("Forced: When a card
  // effect instructs a player to "look" at cards in the encounter deck and Ravenous Hawk is among those cards, that player must put Ravenous Hawk into play engaged with him", 900402:A:1). The card leaves the cards the effect looked at, so it does not count
  // for what the effect picks or discards among them.
  "lookedAt",
  // About the seat: a card effect made a player look at cards of the encounter deck (a look at its top cards, a search of it), announced once the cards are shown; any card in play hears it ("After a player looks at one or more cards in the encounter deck",
  // 901506:A:1). Announced only in a game with a card that hears it (families/encounter/looked.ts).
  "lookedAtEncounterDeck",
] as const;

const FLAGS = [
  // On an enemy until the end of the phase, set by its Forced effect before an immediate attack it makes: its attack-resolved Forced effect attaches it to the character that defended ("makes an immediate attack, then attaches to the defending character", Writhing Tentacle 901503:A:1).
  // The attack-resolved effect clears it; an undefended attack leaves nothing to attach to.
  "attachesAfterAttack",
  // Held by the table: a card placed in the encounter discard pile is announced (`encounterDiscarded`).
  "noteEncounterDiscards",
  // Held by the table until the end of the phase: the staging step reveals this many fewer cards, to a minimum of 0
  // (`revealFewer`) or of 1 (`revealFewerMinOne`).
  "revealFewer",
  "revealFewerMinOne",
  // Held by the table until the end of the phase: the staging step reveals this many more cards (`RevealMore`).
  "revealMore",
  // Held by the table while its source is in play: the first player's reveal of the staging step is replaced by `firstPlayerRevealCount` reveals, all his, before the next player's own ("the first player does not reveal an encounter card as normal. Instead, he
  // reveals 1 encounter card for each resource on The Black Gate", 146073:B:1; mec113.saga-staging-rules). `firstPlayerReveals` is the marker (a count of 0 is no modifier at all, so it cannot say "none"); the count is a live amount and is absent at 0.
  "firstPlayerReveals",
  "firstPlayerRevealCount",
  // Held by the table: the lasting effects WatchReveals sets (its `when` names the type of card it watches for).
  "watchThreatZero",
  "watchDamage",
  "watchDiscard",
  "watchReadyHost",
  // Held by the table until the end of the round: a location has been revealed by the encounter deck this round.
  "locationRevealed",
  // Held by the table while the source is the active location: "encounter card effects cannot be canceled" (41010:A:1). No Response cancels a
  // When Revealed or Shadow effect, and no paid cancel is offered against one (src/rules/families/encounter/cancel.ts).
  "encounterUncancelable",
  // On a card in the staging area: nothing moves it out of the staging area ("Uglúk cannot leave the staging area", 143069:B:2): moveCard refuses a move to another zone, as cannotEnterStaging refuses one into it.
  "cannotLeaveStaging",
  // On a card in play until the end of the round: it entered play this round ("if Hunting Warg entered play this round", 900403:A:1), set by a Forced effect that hears `encounterEnteredPlay` and read by the condition `flag` with holder `self`.
  "enteredThisRound",
  // On an enemy until the end of the round: a card gave it the ambush keyword (`FirstEnemyGains`, Goblin Gate 04043:A:1), read as the keyword by hasKeyword.
  "gainsAmbush",
  // Held by the table while its source is the active location: the ambush keyword has no effect, printed or gained ("ignore ambush", Barren Hills 04045:A:1).
  "ignoreAmbush",
  // On a seat, while its source is in play: the seat counts this much more Threat in every engagement check, and only there ("considered to have +20 threat for the purposes of engagement checks only", Vicious Trackers 901406:A:2; rr.engagement-check). Optional engagement does not read it.
  "engagementThreat",
  // Held by the table until the end of the round: a first enemy was noted for a FirstEnemyGains marker, with any keyword (`enemyRevealed`) or with the ambush keyword (`ambushEnemyRevealed`).
  "enemyRevealed",
  "ambushEnemyRevealed",
  // On a location in play, while its source is in play: it is explored as soon as its progress equals its quest points as they stand now, whatever changed them ("Goblin Gate gets +1 quest point for each enemy engaged with a player", 901402:B:2; rr.explored; src/rules/families/encounter/explore.ts).
  "exploredWhenFull",
] as const;

export const manifest = { name: "encounter", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
