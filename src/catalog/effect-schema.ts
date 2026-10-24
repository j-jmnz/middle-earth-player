import { z } from "zod";

// Effect records are data. The vocabulary here (verbs, conditions, triggers, timings) is owned by the
// catalog, and the reducer reads it. Amounts in authored records are fine; a player intent never supplies one.

// `whileSourceInVictory`: a constant that works from the victory display ("While Weathertop is in the victory display",
// 141046:A:2). The engine writes it; a record names `whileSourceInPlay`.
export const modifierUntilSchema = z.enum(["endOfPhase", "endOfRound", "endOfAttack", "whileSourceInPlay", "whileSourceInVictory"]);

// Stats on a card, plus Hide numbers held by a seat or the table, and a flag that bars an enemy's attack.
export const modifierStatSchema = z.enum([
  "willpower",
  "attack",
  "defense",
  "threat",
  "questPoints",
  "engagementCost",
  "hideValue",
  "hideThreat",
  "hideWillpower",
  "cannotAttack",
  // Hit points: the printed health plus modifiers. A character with damage at or above it is destroyed.
  "hitPoints",
  // Flags, like cannotAttack: the holder takes no damage at all (141048:A:1), no damage but combat damage (141070:A:2),
  // cannot be engaged by any means (141048:A:1), or cannot be optionally engaged (141051:A:1, 141052:A:1).
  "cannotTakeDamage",
  "cannotTakeNonCombatDamage",
  "cannotBeEngaged",
  "cannotBeOptionallyEngaged",
]);

export const phaseNameSchema = z.enum([
  "Setup",
  "Mulligan",
  "Beginning of round",
  "Resource",
  "Planning",
  "Quest",
  "Travel",
  "Encounter",
  "Combat",
  "Refresh",
  "End of round",
]);

// Events the engine announces. Forced and triggered effects name one of these.
export const triggerSchema = z.enum([
  "revealed",
  "hideFailed",
  "endOfPhase",
  "endOfRound",
  "firstPlayerTokenPassed",
  "hideSucceeded",
  "traveled",
  "leftPlay",
  // A hero or ally was destroyed by damage (not discarded, not returned to hand).
  "characterDestroyed",
  // Heard by the card itself: it was played from the hand, it entered play (played or put into play), it was committed to
  // the quest, it took damage. `allyLeftPlay` is heard by every card: an ally card left play.
  "played",
  "enteredPlay",
  "committed",
  "damaged",
  "allyLeftPlay",
  // A Response here can cancel what is about to happen: the "when revealed" effects of the card just revealed, the
  // shadow effect of the card just turned up in an attack (rr.cancel).
  "whenRevealedPending",
  "shadowPending",
  // Heard by every card that was attached to a location that left play (the event's subject).
  "hostLeftPlay",
  // An enemy was engaged with a player (subject), and a player's attack destroyed an enemy (heard by each attacker).
  "engaged",
  "attackDestroyed",
  // The staging step of the quest phase begins, before the first card is revealed (141051:A:2, rr.step-3-3).
  "stagingStepBegins",
  // Heard by the location itself: it became the active location (141048:A:2, rr.active-location).
  "becameActive",
  // Heard by the enemy itself: it attacks, before the defender is declared (141069:A:2, rr.step-6-4b).
  "attacks",
]);

const whoSchema = z.enum(["actor", "firstPlayer"]);


// The cards or players a Pick offers. `control` is whose cards: yours, or any player's. `from` is the zone group: in play (the
// default), the hand, or the discard pile. `state` keeps only ready or only exhausted cards. `different` leaves out cards this
// effect has already picked. `attackableByPicked` keeps the enemies the last picked character could attack. `type: player` picks a
// seat that is still in the game.
export const pickSchema = z.strictObject({
  // `attachment`: a card of the attachment type in play that the chooser controls (141071:A:2).
  type: z.enum(["hero", "ally", "character", "enemy", "location", "player", "card", "attachment"]),
  control: z.enum(["you", "any"]),
  // An enemy in the staging area counts too (an enemy "in play"), not only one engaged with a player.
  staging: z.boolean().optional(),
  // A card of this sphere of influence, for a card picked from the hand or a discard pile.
  sphere: z.enum(["leadership", "tactics", "spirit", "lore", "neutral"]).optional(),
  from: z.enum(["play", "hand", "discard", "deck"]).optional(),
  // From the deck: only its top cards are looked at. The cards still in the deck are the ones ArrangeTop puts back in order.
  top: z.number().int().positive().optional(),
  // The printed card type, and a printed cost at most this, for a card picked from a hand, a discard pile or a deck.
  cardType: z.enum(["ally", "attachment", "event"]).optional(),
  maxCost: z.number().int().min(0).optional(),
  // The candidates are the cards the last picked attachment may be attached to.
  hostForPicked: z.boolean().optional(),
  // The card is going to be put into play: a unique card already in play cannot be chosen.
  intoPlay: z.boolean().optional(),
  // The printed cost must be the X the event was played for (Stand and Fight).
  costIsX: z.boolean().optional(),
  // Only the topmost card of each discard pile that matches (Erebor Hammersmith).
  topmost: z.boolean().optional(),
  // Who chooses. The actor, unless the card says the first player does.
  who: z.enum(["actor", "firstPlayer"]).optional(),
  // Not the source card itself: "another character". The source is never offered from a hand, a discard pile or a deck.
  other: z.boolean().optional(),
  // A character committed to the quest.
  committed: z.boolean().optional(),
  // A character that took part in the attack the Response answers (not the card itself).
  participating: z.boolean().optional(),
  // A non-unique card; an enemy with a shadow card dealt to it.
  nonUnique: z.boolean().optional(),
  hasShadow: z.boolean().optional(),
  trait: z.string().min(1).optional(),
  state: z.enum(["ready", "exhausted"]).optional(),
  different: z.boolean().optional(),
  attackableByPicked: z.boolean().optional(),
  // A card of any sphere but this one ("non-Fellowship hero", 141051:A:2).
  exceptSphere: z.enum(["leadership", "tactics", "spirit", "lore", "neutral", "fellowship", "baggins"]).optional(),
  // A character that could attack some enemy engaged with a player, whether or not it is exhausted yet.
  canAttack: z.boolean().optional(),
  // An ally in a discard pile or the hand whose printed cost is X (Stand and Fight): the amount the effect names.
  cost: z.number().int().min(0).optional(),
});

export const conditionSchema = z.discriminatedUnion("kind", [
  // The actor failed a Hide test in the current phase or round.
  z.strictObject({ kind: z.literal("hideFailed"), scope: z.enum(["phase", "round"]) }),
  // The actor has an enemy engaged with them, with this trait if one is named.
  z.strictObject({ kind: z.literal("hasEngaged"), trait: z.string().min(1).optional() }),
  // A card with this code is in play and its exhausted state is `is`.
  z.strictObject({ kind: z.literal("exhausted"), code: z.string().min(1), is: z.boolean() }),
  // The source is an enemy engaged with the actor.
  z.strictObject({ kind: z.literal("engagedWithActor") }),
  // The running effect has returned no enemy to staging.
  z.strictObject({ kind: z.literal("noneReturned") }),
  z.strictObject({ kind: z.literal("phase"), is: phaseNameSchema }),
  // The encounter deck or discard pile holds a card with this code or trait.
  // Where the source card is now. `play` means any zone the source's controller plays from.
  // `victory`: the source is in the victory display, and its constant effects work from there (141046:A:2).
  z.strictObject({ kind: z.literal("sourceIn"), zone: z.enum(["activeLocation", "staging", "engaged", "questStage", "play", "victory"]) }),
  // A card with this code is in the victory display (`is`) or is not.
  z.strictObject({ kind: z.literal("inVictory"), code: z.string().min(1), is: z.boolean() }),
  // Some location other than the source is in the staging area or is the active location.
  z.strictObject({ kind: z.literal("otherLocationInPlay") }),
  // The actor controls a hero that is exhausted.
  z.strictObject({ kind: z.literal("heroExhausted") }),
  // The attack in progress has no defender (declared or considered).
  z.strictObject({ kind: z.literal("undefended") }),
  z.strictObject({ kind: z.literal("searchable"), trait: z.string().min(1).optional(), code: z.string().min(1).optional() }),
  // Some card matches this pick (for the actor now): a choice that could be made.
  z.strictObject({ kind: z.literal("canPick"), pick: pickSchema }),
  // The actor has a card in hand.
  z.strictObject({ kind: z.literal("handHasCard") }),
  // The event is about the actor engaging an enemy whose engagement cost is higher than the actor's threat.
  z.strictObject({ kind: z.literal("engagedAboveThreat") }),
  // The card the event is about (a location that left play) had enough progress to be explored.
  z.strictObject({ kind: z.literal("subjectExplored") }),
  // Another player is still in the game.
  z.strictObject({ kind: z.literal("otherPlayer") }),
  // A card with this code is in play (`is`) or is not. Read at the end of a scenario, for a resolution.
  z.strictObject({ kind: z.literal("inPlay"), code: z.string().min(1), is: z.boolean() }),
  // A card with this code is attached to a hero (`is`) or is not.
  z.strictObject({ kind: z.literal("attachedToHero"), code: z.string().min(1), is: z.boolean() }),
  // Read while a stat is read, not when a constant effect is synced. `defending`: the holder is the declared defender
  // and the attacking enemy's engagement cost is higher than its controller's threat. `attacking`: the holder is
  // attacking an enemy whose engagement cost is higher than the holder's controller's threat.
  z.strictObject({ kind: z.literal("versusHighEngagement"), role: z.enum(["defending", "attacking"]) }),
  // The source card is attached to a card with this name.
  z.strictObject({ kind: z.literal("hostNamed"), name: z.string().min(1) }),
  // The actor controls a hero or ally in play with this code.
  z.strictObject({ kind: z.literal("controls"), code: z.string().min(1) }),
  // A copy of this card is set aside, out of play (a quest card's Setup put it there: 141025:A:1, "shuffle 1 out of play
  // Ringwraith into the encounter deck" on 141026:B:2, 141051:A:2, 141053:A:1, 141054:A:2).
  z.strictObject({ kind: z.literal("setAside"), code: z.string().min(1) }),
  // The current quest card has progress on it (141026:B:2: removing progress is an effect that changes the game, rr.effects).
  z.strictObject({ kind: z.literal("questProgress") }),
  // An enemy (with this trait, if one is named) is in play (`is`) or none is (141027:B:1).
  z.strictObject({ kind: z.literal("enemyInPlay"), trait: z.string().min(1).optional(), is: z.boolean() }),
]);

// The conditions a stat modifier carries and checks each time the stat is read.
export function isStatCondition(condition: Condition | undefined): condition is Extract<Condition, { kind: "versusHighEngagement" }> {
  return condition?.kind === "versusHighEngagement";
}

export const targetSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("self") }),
  z.strictObject({ kind: z.literal("host") }),
  z.strictObject({ kind: z.literal("activeLocation") }),
  z.strictObject({
    kind: z.literal("engagedEnemies"),
    trait: z.string().min(1).optional(),
    who: z.enum(["actor", "each"]),
    pick: z.enum(["all", "choose"]),
  }),
]);

const when = { when: conditionSchema.optional() };

function verb<const Verb extends string>(name: Verb) {
  return z.strictObject({ verb: z.literal(name), ...when });
}

function codeVerb<const Verb extends string>(name: Verb) {
  return z.strictObject({ verb: z.literal(name), code: z.string().min(1), ...when });
}

// What a player pays to use an Action or Response. Resources come from the payments on the Trigger intent.
export const costSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("exhaustSelf") }),
  z.strictObject({ kind: z.literal("addSelfToVictory") }),
  z.strictObject({ kind: z.literal("discardSelf") }),
  z.strictObject({
    kind: z.literal("resources"),
    amount: z.number().int().positive(),
    sphere: z.enum(["leadership", "tactics", "spirit", "lore", "neutral", "fellowship", "baggins"]).optional(),
  }),
  // An event used from the hand: its printed cost is paid, and the card is discarded when the effect is done.
  z.strictObject({ kind: z.literal("playEvent") }),
]);

const modifyStatSchema = z.strictObject({
  verb: z.literal("ModifyStat"),
  stat: modifierStatSchema,
  amount: z.number().int(),
  until: modifierUntilSchema,
  // Whose stat changes. The default is the source card. `attacker` is the enemy in the attack in progress.
  // `host` is the card the source is attached to. `table` is every seat. `engagedSeat` is the seat the
  // source is engaged with. `eachSeat` is one holder per living seat.
  // `heroes`, `hobbitCharacters` and `enemies` are every such card in play, for a constant effect. A Hide number
  // held by the table or a seat is read through `per`.
  // `picked` is the card the last Pick chose, `pickedPlayerCharacters` every character the picked player controls, `ownHeroes`
  // every hero the actor controls: all fixed when the effect resolves.
  // `defender` is the character defending the attack in progress (141052:A:2). `allies` is every ally in play: from an
  // encounter card's lasting effect it also holds for allies that enter play later (rr.lasting-effects, 141071:A:1).
  // `engagedSeatCharacters` is every character of the player the source is engaged with (141050:A:2).
  target: z
    .enum(["self", "attacker", "host", "table", "engagedSeat", "eachSeat", "heroes", "hobbitCharacters", "enemies", "picked", "pickedPlayerCharacters", "ownHeroes", "defender", "allies", "engagedSeatCharacters"])
    .optional(),
  // Only holders with this trait ("Spy enemies get +1 Threat", 141047:A:1).
  trait: z.string().min(1).optional(),
  // Multiplies the amount by this count when the stat is read. `hobbitHero` is the Hobbit heroes the source's controller has.
  per: z.enum(["committed", "ally", "hobbitHero", "x"]).optional(),
  ...when,
});

// A card in the encounter deck or discard pile: by code, by trait, and by printed type ("each Nazgûl enemy", 141027:A:1).
const searchSelector = {
  code: z.string().min(1).optional(),
  trait: z.string().min(1).optional(),
  type: z.enum(["enemy", "location", "treachery"]).optional(),
};

const simpleVerbs = [
  // Draws `amount` cards (one by default), or that many for each Hobbit hero. `who`: the actor, the picked player, or the
  // seat the event is about.
  z.strictObject({
    verb: z.literal("Draw"),
    perHero: z.string().min(1).optional(),
    amount: z.number().int().positive().optional(),
    who: z.enum(["actor", "picked", "eventSeat"]).optional(),
    ...when,
  }),
  verb("GainResources"),
  verb("PayCost"),
  verb("PlayAlly"),
  verb("Attach"),
  z.strictObject({
    verb: z.literal("Exhaust"),
    target: z
      .discriminatedUnion("kind", [z.strictObject({ kind: z.literal("byCode"), code: z.string().min(1) }), z.strictObject({ kind: z.literal("picked") })])
      .optional(),
    ...when,
  }),
  // Readies the source (the default), the card it is attached to, the picked card, or every character in play.
  z.strictObject({ verb: z.literal("Ready"), target: z.enum(["self", "host", "picked", "allCharacters"]).optional(), ...when }),
  // Chooses a card or a player for the instructions that follow (target "picked"). A choice of one is made without asking.
  z.strictObject({ verb: z.literal("Pick"), pick: pickSchema, ...when }),
  // Lowers a threat dial. It stops at 0.
  z.strictObject({ verb: z.literal("LowerThreat"), amount: z.number().int().positive(), who: z.enum(["actor", "picked", "eachSeat"]), ...when }),
  // Places damage on the picked card as a player card effect (toughness and immunity apply).
  z.strictObject({ verb: z.literal("DamageCard"), amount: z.number().int().positive(), ...when }),
  // Places progress tokens on the picked location, or on every location in the staging area. A full location is explored.
  z.strictObject({ verb: z.literal("PlaceProgressOn"), amount: z.number().int().positive(), target: z.enum(["picked", "eachStagingLocation"]), ...when }),
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
  // The picked card goes back to its controller's hand if it is still in play.
  verb("ReturnToHand"),
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
    amount: z.number().int().positive().optional(),
    who: z.enum(["actor", "firstPlayer", "otherPlayer", "eachSeat"]).optional(),
    perCommitted: z
      .strictObject({
        type: z.literal("hero"),
        exceptSphere: z.enum(["leadership", "tactics", "spirit", "lore", "neutral", "fellowship", "baggins"]).optional(),
      })
      .optional(),
    ...when,
  }),
  z.strictObject({ verb: z.literal("Travel"), to: z.literal("self").optional(), ...when }),
  verb("Engage"),
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
  // During play: one set-aside copy of the card joins the encounter deck, which is shuffled ("shuffle 1 out of play
  // Ringwraith into the encounter deck", 141026:B:2, 141051:A:2, 141053:A:1, 141054:A:2). Nothing happens with no copy left.
  codeVerb("ShuffleSetAsideIntoEncounterDeck"),
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
      z.strictObject({ kind: z.literal("hero") }),
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
    }),
    limitPerHost: z.boolean().optional(),
    ...when,
  }),
  // Constant on a card in hand: it costs this much less to play while `when` holds.
  z.strictObject({ verb: z.literal("ReduceCost"), amount: z.number().int().positive(), ...when }),
  // Constants on an attachment: the attached card gains this trait, or this resource icon.
  z.strictObject({ verb: z.literal("GrantTrait"), trait: z.string().min(1), ...when }),
  z.strictObject({ verb: z.literal("GrantIcon"), sphere: z.enum(["leadership", "tactics", "spirit", "lore"]), ...when }),
  // Engine use (Restricted): the source card's controller moves one of its restricted attachments to its owner's discard pile.
  verb("DiscardRestricted"),
  // Adds resources to the pool of the hero the source card is attached to.
  z.strictObject({ verb: z.literal("AddResources"), amount: z.number().int().positive(), to: z.enum(["host", "picked"]).optional(), ...when }),
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

const simpleInstructionSchema = z.discriminatedUnion("verb", simpleVerbs);

const choiceSchema = z.strictObject({
  verb: z.literal("Choose"),
  who: whoSchema,
  options: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        requires: conditionSchema.optional(),
        instructions: z.array(simpleInstructionSchema),
      }),
    )
    .min(1),
});

const delaySchema = z.strictObject({
  verb: z.literal("Delay"),
  until: z.enum(["endOfPhase", "endOfRound"]),
  uncancelable: conditionSchema.optional(),
  // The delayed instructions act on the card the last Pick chose (Sneak Attack's ally).
  subject: z.literal("picked").optional(),
  instructions: z.array(simpleInstructionSchema),
});

// Instructions that run, with the attacking enemy as the source, once the attack in progress ends.
const afterAttackSchema = z.strictObject({
  verb: z.literal("AfterAttack"),
  instructions: z.array(simpleInstructionSchema),
});

const forEachPlayerSchema = z.strictObject({
  verb: z.literal("ForEachPlayer"),
  order: z.enum(["lastFirst", "firstFirst"]),
  instructions: z.array(z.discriminatedUnion("verb", [...simpleVerbs, choiceSchema])),
});

export const instructionSchema = z.discriminatedUnion("verb", [...simpleVerbs, choiceSchema, delaySchema, afterAttackSchema, forEachPlayerSchema]);

export const timingSchema = z.enum([
  "setup",
  "forced",
  // A mandatory reaction that is not printed as Forced. It resolves before Forced effects on the same event.
  "triggered",
  "whenRevealed",
  "response",
  "action",
  "shadow",
  "constant",
  "questResolution",
  // The Setup and the Resolution printed on a campaign card (front and back).
  "campaignSetup",
  "resolution",
  "travel",
  "engagement",
  "beginningOfPhase",
  "endOfPhase",
  "endOfRound",
]);

// An optional paid cancel offered to the first player before the effect resolves.
export const cancelSchema = z.strictObject({
  cost: z.number().int().positive(),
  sphere: z.enum(["leadership", "tactics", "spirit", "lore", "neutral", "fellowship", "baggins"]).optional(),
  // The effect cannot be canceled while this holds.
  unless: conditionSchema.optional(),
});

export const effectSchema = z.strictObject({
  // "<code>:<timing>:<n>"
  id: z.string().min(1),
  cardCode: z.string(),
  // The printed lines this record implements, as "<code>:<side>:<n>" ledger line ids (data/printed). Every record names
  // at least one; scripts/effect-coverage.test.ts checks that they exist, belong to cardCode and match the timing.
  lines: z.array(z.string().min(1)).min(1),
  timing: timingSchema,
  trigger: triggerSchema.optional(),
  // `oncePerRoundEachPlayer`: each player may use it once a round, and any player may.
  limit: z.enum(["oncePerPhase", "oncePerRound", "oncePerRoundEachPlayer"]).optional(),
  cost: costSchema.optional(),
  cancel: cancelSchema.optional(),
  condition: conditionSchema.optional(),
  instructions: z.array(instructionSchema),
});

export type Instruction = z.infer<typeof instructionSchema>;
export type SimpleInstruction = z.infer<typeof simpleInstructionSchema>;
export type Condition = z.infer<typeof conditionSchema>;
export type PickSpec = z.infer<typeof pickSchema>;
export type Target = z.infer<typeof targetSchema>;
export type Trigger = z.infer<typeof triggerSchema>;
export type Timing = z.infer<typeof timingSchema>;
export type Cost = z.infer<typeof costSchema>;
export type Effect = z.infer<typeof effectSchema>;
export type ModifierUntil = z.infer<typeof modifierUntilSchema>;
export type ModifierStat = z.infer<typeof modifierStatSchema>;
