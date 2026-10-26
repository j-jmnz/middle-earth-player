// The simple verbs of an effect record: every instruction that holds no instructions of its own.
import { z } from "zod";

import { cardRefSchema, positiveAmountSchema } from "./effect-schema-amount.ts";
import { conditionSchema, targetSchema, when } from "./effect-schema-conditions.ts";
import { pickSchema, whoSchema } from "./effect-schema-pick.ts";
import { modifyStatSchema } from "./effect-schema-stats.ts";

function verb<const Verb extends string>(name: Verb) {
  return z.strictObject({ verb: z.literal(name), ...when });
}

function codeVerb<const Verb extends string>(name: Verb) {
  return z.strictObject({ verb: z.literal(name), code: z.string().min(1), ...when });
}


// A card in the encounter deck or discard pile: by code, by trait, and by printed type ("each Nazgûl enemy", 141027:A:1).
const searchSelector = {
  code: z.string().min(1).optional(),
  trait: z.string().min(1).optional(),
  type: z.enum(["enemy", "location", "treachery"]).optional(),
};

export const simpleVerbs = [
  // Draws `amount` cards (one by default), or that many for each Hobbit hero. `who`: the actor, the picked player, or the
  // seat the event is about.
  z.strictObject({
    verb: z.literal("Draw"),
    perHero: z.string().min(1).optional(),
    amount: positiveAmountSchema.optional(),
    who: z.enum(["actor", "picked", "eventSeat", "firstPlayer"]).optional(),
    ...when,
  }),
  verb("GainResources"),
  verb("PayCost"),
  verb("PlayAlly"),
  verb("Attach"),
  // Exhausts the source, the picked card, or a named card. `who` names the player who must control the named card ("The
  // first player must exhaust The One Ring", 141046:A:3).
  z.strictObject({
    verb: z.literal("Exhaust"),
    target: z
      .discriminatedUnion("kind", [
        z.strictObject({ kind: z.literal("byCode"), code: z.string().min(1) }),
        z.strictObject({ kind: z.literal("picked") }),
        // Another card the effect knows: its host, the event's subject, the attacker or the defender.
        z.strictObject({ kind: z.literal("ref"), ref: cardRefSchema }),
      ])
      .optional(),
    who: z.enum(["firstPlayer"]).optional(),
    ...when,
  }),
  // Readies the source (the default), the card it is attached to, the picked card, or every character in play.
  // `subject` is the card the answered event was about, `defender` the defending character.
  z.strictObject({ verb: z.literal("Ready"), target: z.enum(["self", "host", "picked", "allCharacters", "subject", "defender"]).optional(), ...when }),
  // Chooses a card or a player for the instructions that follow (target "picked"). A choice of one is made without asking.
  z.strictObject({ verb: z.literal("Pick"), pick: pickSchema, ...when }),
  // Lowers a threat dial. It stops at 0.
  // `eventSeat` is the player the answered event happened to.
  z.strictObject({ verb: z.literal("LowerThreat"), amount: positiveAmountSchema, who: z.enum(["actor", "picked", "eachSeat", "eventSeat"]), ...when }),
  // Places damage on the picked card (or `target`) as a player card effect (toughness and immunity apply).
  z.strictObject({ verb: z.literal("DamageCard"), amount: positiveAmountSchema, target: cardRefSchema.optional(), ...when }),
  // Places progress tokens on the picked location, on every location in the staging area, on the source or the active
  // location. A full location is explored.
  z.strictObject({ verb: z.literal("PlaceProgressOn"), amount: positiveAmountSchema, target: z.enum(["picked", "eachStagingLocation", "self", "activeLocation", "subject"]), ...when }),
  // Heals damage from the picked card (or `target`): `amount`, or all of it.
  z.strictObject({ verb: z.literal("Heal"), amount: positiveAmountSchema.optional(), all: z.boolean().optional(), target: cardRefSchema.optional(), ...when }),
  // Puts the picked card (or `target`) on top or at the bottom of its owner's deck, or shuffles it in. A card leaving play this
  // way leaves play.
  z.strictObject({ verb: z.literal("PutOnDeck"), position: z.enum(["top", "bottom", "shuffle"]), target: cardRefSchema.optional(), ...when }),
  // Moves resources from the card picked before the last to the last picked card: `amount`, or all of them.
  z.strictObject({ verb: z.literal("MoveResources"), amount: positiveAmountSchema.optional(), all: z.boolean().optional(), ...when }),
  // The actor chooses and discards this many cards from their hand (fewer when the hand runs out).
  z.strictObject({ verb: z.literal("DiscardFromHand"), amount: positiveAmountSchema, ...when }),
  // The card is added to the victory display: the picked card, or `target`.
  z.strictObject({ verb: z.literal("AddToVictory"), target: cardRefSchema.optional(), ...when }),
  // The actor's threat is set to this value.
  z.strictObject({ verb: z.literal("SetThreat"), value: z.number().int().min(0), ...when }),
  // Puts the source ally under another player's control.
  z.strictObject({ verb: z.literal("GiveControl"), ...when }),
  // Cancels what the Response it is played in answers: the "when revealed" effects about to resolve, or the shadow effect.
  verb("CancelEffect"),
  // Shows the actor the top card of the encounter deck. The window closes with a pass.
  verb("LookAtEncounterTop"),
  // Shuffles the actor's deck.
  verb("ShuffleDeck"),
  // Moves the last picked card to the actor's hand, or puts it into play under the actor's control.
  // A card goes to its own controller's hand (a card out of a discard pile or a deck is its player's), or into play under `who`.
  z.strictObject({ verb: z.literal("MovePicked"), to: z.enum(["hand", "play"]), who: z.enum(["actor", "firstPlayer"]).optional(), ...when }),
  // The picked card (or `target`) goes back to its owner's hand if it is still in play.
  z.strictObject({ verb: z.literal("ReturnToHand"), target: cardRefSchema.optional(), ...when }),
  // The source goes back into its controller's deck, which is shuffled.
  verb("ShuffleSelfIntoDeck"),
  // Attaches the card picked before the last pick (an attachment) to the last picked card.
  verb("AttachPicked"),
  // The actor puts the cards a Pick looked at, those still in the deck, back on top in an order they choose.
  verb("ArrangeTop"),
  // The last picked character (the one before it) attacks the last picked enemy. The attacker is already exhausted.
  z.strictObject({ verb: z.literal("AttackEnemy"), ...when }),
  verb("Commit"),
  verb("RevealStaging"),
  verb("PlaceProgress"),
  // Raises a threat dial by `amount` (1 by default). `eachSeat` raises every living seat's. With `perCommitted` the amount
  // counts once for each such card the seat has committed to the quest ("1 for each non-Fellowship hero he committed to the
  // quest", 141051:A:2).
  z.strictObject({
    verb: z.literal("RaiseThreat"),
    amount: positiveAmountSchema.optional(),
    who: z.enum(["actor", "firstPlayer", "otherPlayer", "eachSeat", "picked", "eventSeat"]).optional(),
    perCommitted: z
      .strictObject({
        type: z.literal("hero"),
        exceptSphere: z.enum(["leadership", "tactics", "spirit", "lore", "neutral", "fellowship", "baggins"]).optional(),
      })
      .optional(),
    ...when,
  }),
  z.strictObject({ verb: z.literal("Travel"), to: z.literal("self").optional(), ...when }),
  // Engages the first enemy in the staging area, or the picked enemy (`target`), with the actor.
  z.strictObject({ verb: z.literal("Engage"), target: cardRefSchema.optional(), ...when }),
  // Deals the source enemy a shadow card. `additional`: one more, beside the one it has ("deal it an additional shadow card",
  // 141069:A:2); every shadow card dealt to an attacking enemy resolves (rr.step-6-4-2).
  z.strictObject({ verb: z.literal("DealShadow"), additional: z.boolean().optional(), ...when }),
  verb("DeclareDefender"),
  verb("DealDamage"),
  verb("Attack"),
  verb("AdvanceStep"),
  verb("ResolveEffect"),
  modifyStatSchema,
  codeVerb("AddToStaging"),
  codeVerb("MakeActiveLocation"),
  codeVerb("SetAside"),
  codeVerb("AttachToRingBearer"),
  // Moves a card that was set aside, out of play, into the staging area. It is not a reveal.
  codeVerb("AddSetAsideToStaging"),
  // During play: one out-of-play copy of the card (the `outOfPlay` condition's zones) joins the encounter deck, which is
  // shuffled ("shuffle 1 out of play Ringwraith into the encounter deck", 141026:B:2, 141051:A:2, 141053:A:1, 141054:A:2).
  // When copies are out of play in more than one zone, the first player chooses which (rr.first-player). Nothing happens
  // with no copy left.
  codeVerb("ShuffleOutOfPlayIntoEncounterDeck"),
  // Removes progress from the current quest card, `perPlayer` for each player in the game. It stops at 0 (141026:B:2).
  z.strictObject({ verb: z.literal("RemoveQuestProgress"), perPlayer: z.number().int().positive(), ...when }),
  // Places progress on the current quest, `perPlayer` for each player in the game. The active location takes it first
  // (rr.active-location), and a full quest card advances (rr.quest-advancement) unless something forbids it (141026:B:1).
  z.strictObject({ verb: z.literal("PlaceQuestProgress"), perPlayer: z.number().int().positive(), ...when }),
  // The last picked character is removed from the quest: it stays exhausted and its willpower no longer counts (141054:A:2).
  verb("RemoveFromQuest"),
  verb("ShuffleEncounterDeck"),
  // Setup: each player draws this many fewer cards in the starting hand (and in a mulligan redraw).
  z.strictObject({ verb: z.literal("ReduceOpeningHand"), amount: z.number().int().positive(), ...when }),
  // Moves one matching card from the encounter discard pile into the encounter deck, then shuffles.
  z.strictObject({ verb: z.literal("ShuffleIntoDeck"), ...searchSelector, ...when }),
  // Finds a card in the encounter deck or discard pile and reveals it.
  z.strictObject({ verb: z.literal("SearchReveal"), ...searchSelector, who: whoSchema, ...when }),
  // Finds a card in the encounter deck or discard pile and puts it out without revealing it. With `each`, every card that
  // matches goes ("add each Nazgûl enemy found to the staging area", 141027:A:1) and nobody chooses.
  z.strictObject({
    verb: z.literal("SearchMove"),
    ...searchSelector,
    to: z.enum(["staging", "engagedFirstPlayer"]),
    each: z.boolean().optional(),
    ...when,
  }),
  z.strictObject({ verb: z.literal("ReturnToStaging"), target: targetSchema, ...when }),
  z.strictObject({
    verb: z.literal("EngageAll"),
    trait: z.string().min(1).optional(),
    who: whoSchema,
    ...when,
  }),
  z.strictObject({ verb: z.literal("Discard"), target: targetSchema, ...when }),
  z.strictObject({
    verb: z.literal("AttachSelf"),
    to: z.discriminatedUnion("kind", [
      // A hero the revealing player controls, or (`control: "any"`, "Attach to a hero.") any player's hero, chosen by the
      // first player (rr.first-player).
      z.strictObject({ kind: z.literal("hero"), control: z.enum(["you", "any"]).optional() }),
      z.strictObject({ kind: z.literal("enemy"), trait: z.string().min(1) }),
    ]),
    ...when,
  }),
  z.strictObject({ verb: z.literal("UncommitAll"), who: whoSchema, ...when }),
  z.strictObject({ verb: z.literal("TakeControl"), who: whoSchema, ...when }),
  verb("GainSurge"),
  z.strictObject({ verb: z.literal("HideTest"), x: z.number().int().positive(), ...when }),
  verb("ImmediateAttack"),
  // The attack in progress counts as undefended, even if a defender was declared.
  verb("ConsiderUndefended"),
  // The actor readies one hero they control.
  verb("ReadyHero"),
  // Places progress on a non-unique location in play: `perPlayer` for each player in the game.
  z.strictObject({ verb: z.literal("PlaceProgressOnLocation"), perPlayer: z.number().int().positive(), ...when }),
  // The actor picks an enemy engaged with them. It cannot attack them until the end of the round. With `any` the enemy may be
  // engaged with any player and cannot attack that player until `until` (the end of the phase by default).
  z.strictObject({ verb: z.literal("BarAttack"), scope: z.enum(["own", "any"]).optional(), until: z.enum(["endOfPhase", "endOfRound"]).optional(), ...when }),
  // Constants: a rule the engine checks while the source is in play. `defend`: characters with willpower at most
  // `maxWillpower` cannot defend the source's attacks (141068:A:3).
  z.strictObject({
    verb: z.literal("Restrict"),
    what: z.enum(["advance", "travel", "attach", "heroLimit", "defend"]),
    exceptTrait: z.string().min(1).optional(),
    maxWillpower: z.number().int().min(0).optional(),
    ...when,
  }),
  // Constant: the holder's stat is set to `value`, overriding every other modifier (rr.modifiers; "Reduce attached hero's
  // Willpower, Attack, and Defense to 0", 141055:A:2).
  z.strictObject({
    verb: z.literal("SetStat"),
    stat: z.enum(["willpower", "attack", "defense", "threat"]),
    value: z.number().int().min(0),
    target: z.enum(["self", "host"]).optional(),
    ...when,
  }),
  // Deals damage to each ally in play, only those with willpower at most `maxWillpower` when it is named (a value below 0
  // counts as 0, rr.modifiers) ("Deal 2 damage to each ally with 0 Willpower", 141071:A:1).
  z.strictObject({
    verb: z.literal("DamageAll"),
    amount: z.number().int().positive(),
    type: z.literal("ally"),
    maxWillpower: z.number().int().min(0).optional(),
    ...when,
  }),
  // Constants on an attachment. Where it may be attached: `host` names the card, and `limitPerHost` allows one copy
  // of the attachment on each (Limit 1 per hero). A card with no such record may go on any character.
  z.strictObject({
    verb: z.literal("AttachesTo"),
    host: z.strictObject({
      kind: z.enum(["hero", "character", "activeLocation", "ringBearer"]),
      trait: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
      // The host's printed sphere ("Attach to a Lore character").
      sphere: z.enum(["leadership", "tactics", "spirit", "lore", "neutral", "fellowship", "baggins"]).optional(),
    }),
    limitPerHost: z.boolean().optional(),
    ...when,
  }),
  // Constant on a card in hand: it costs this much less to play while `when` holds ("by 1 for each Hobbit hero you control").
  z.strictObject({ verb: z.literal("ReduceCost"), amount: positiveAmountSchema, ...when }),
  // Constants on a card in hand, read when it would be played: it can only be played while the condition holds; it can be
  // played from its owner's discard pile (`only`: and from nowhere else); an ally or attachment enters play exhausted.
  z.strictObject({ verb: z.literal("PlayOnlyIf"), condition: conditionSchema, ...when }),
  z.strictObject({ verb: z.literal("PlayFromDiscard"), only: z.boolean().optional(), ...when }),
  verb("EntersPlayExhausted"),
  // A deckbuilding limit: at most this many copies of the card in a deck ("Limit 1 per deck").
  z.strictObject({ verb: z.literal("DeckLimit"), copies: z.number().int().positive(), ...when }),
  // Constants on an attachment: the attached card gains this trait, or this resource icon.
  z.strictObject({ verb: z.literal("GrantTrait"), trait: z.string().min(1), ...when }),
  z.strictObject({ verb: z.literal("GrantIcon"), sphere: z.enum(["leadership", "tactics", "spirit", "lore"]), ...when }),
  // Engine use (Restricted): the source card's controller moves one of its restricted attachments to its owner's discard pile.
  verb("DiscardRestricted"),
  // Adds resources to the pool of the hero the source card is attached to.
  // To the host by default, or to the picked card, the source itself, or the card the answered event was about.
  z.strictObject({ verb: z.literal("AddResources"), amount: positiveAmountSchema, to: z.enum(["host", "picked", "self", "subject"]).optional(), ...when }),
  // The picked card goes to its owner's discard pile.
  verb("DiscardPicked"),
  // The top card of the actor's deck is discarded. Its printed cost is the effect's X.
  verb("DiscardTopOfDeck"),
  // The source card (an event being played) is added to the victory display instead of the discard pile.
  verb("AddSourceToVictory"),
  // The picked card of the hand and the top card of the deck change places.
  verb("ExchangeWithDeckTop"),
  // The shadow card dealt to the picked enemy is discarded.
  verb("DiscardShadow"),
  // Constant on a hero: once per phase the actor may play the top card of their deck as if it were in their hand, and the
  // hero counts as having these resource icons while it pays for that card. The top card of the deck is faceup.
  z.strictObject({ verb: z.literal("PlayFromDeckTop"), icons: z.array(z.enum(["leadership", "tactics", "spirit", "lore"])).min(1), ...when }),
  // The source enemy leaves the player it is engaged with and engages the next player.
  verb("EngageNextPlayer"),
  // The host of the source card, its resource pool, and every card attached to it pass to a seat.
  z.strictObject({ verb: z.literal("TransferHost"), who: whoSchema, ...when }),
  // The players win the scenario. The resolution choices follow.
  verb("WinGame"),
  // Discards cards from the top of the encounter deck until `perPlayer` enemies for each player in the game have been
  // discarded, or the deck is empty, and puts each of those enemies into play engaged with the first player (141045:A:2).
  z.strictObject({ verb: z.literal("DiscardUntilEnemies"), perPlayer: z.number().int().positive(), ...when }),
  // The last picked card is placed facedown under the source location. While it is there it is out of play (141049:A:1).
  verb("PlaceUnderSelf"),
  // Each card under the source location returns to the staging area face up (141049:A:2).
  verb("ReturnUnderToStaging"),
  // The source card (a shadow card) is shuffled into the encounter deck instead of being discarded (141069:A:3).
  verb("ShuffleSelfIntoEncounterDeck"),
  // The actor discards cards at random from their hand, `amount` (1 by default). The seed picks them (141047:A:2).
  z.strictObject({ verb: z.literal("DiscardRandomFromHand"), amount: z.number().int().positive().optional(), ...when }),
  // Setup: a card from the box joins the encounter deck. The deck is shuffled by the Setup step that says so.
  codeVerb("ShuffleIntoEncounterDeck"),
  // Campaign setup: the voluntary hero change costs no threat penalty on this scenario's card.
  verb("WaiveThreatPenalty"),
  // Campaign setup and resolution: players pick from a list of boons or burdens. `to` says where the pick goes:
  // `pool` earns it, `hand` earns it and puts it in the chooser's hand, `hero` earns it and attaches it to a hero
  // the chooser controls. `optional` lets a player pick nothing. `leftover` says where unchosen cards go.
  z.strictObject({
    verb: z.literal("ChooseCards"),
    codes: z.array(z.string().min(1)).min(1),
    who: z.enum(["firstPlayer", "eachSeat"]),
    to: z.enum(["pool", "hand", "hero"]),
    optional: z.boolean().optional(),
    leftover: z.enum(["firstPlayerDeck"]).optional(),
    ...when,
  }),
  // Resolution: these cards are earned, with no choice.
  z.strictObject({ verb: z.literal("Earn"), codes: z.array(z.string().min(1)).min(1), ...when }),
  // Resolution: every burden in play, in the encounter deck and in the encounter discard pile is earned.
  verb("EarnAllBurdens"),
  // Resolution: the hero this card is attached to joins the fallen heroes.
  z.strictObject({ verb: z.literal("MarkFallen"), attached: z.string().min(1), ...when }),
  // Resolution: each player names a hero they control as a captive, other than these traits or codes.
  z.strictObject({ verb: z.literal("NameCaptives"), except: z.array(z.string().min(1)), ...when }),
] as const;

export const simpleInstructionSchema = z.discriminatedUnion("verb", simpleVerbs);
