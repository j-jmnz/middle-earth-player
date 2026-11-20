// The simple verbs of an effect record: every instruction that holds no instructions of its own.
import { z } from "zod";

import { cardRefSchema, positiveAmountSchema } from "./effect-schema-amount.ts";
import { conditionSchema, targetSchema, when } from "./effect-schema-conditions.ts";
import { pickSchema, whoSchema } from "./effect-schema-pick.ts";
import { modifyStatSchema } from "./effect-schema-stats.ts";
import { FAMILY_VERBS } from "./families/index.ts";
import { verbFlags } from "./verb-flags.ts";

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
  // A card with any one of these traits ("an Orc, Troll, or Nazgûl enemy", 146073:A:1).
  traits: z.array(z.string().min(1)).min(2).optional(),
  // A non-unique card ("searches the encounter deck and discard pile for a non-unique Undead enemy", 19111:A:1).
  nonUnique: z.boolean().optional(),
  // `encounter-side-quest`: "search the encounter deck and discard pile for an encounter side quest" (09049:A:2).
  type: z.enum(["enemy", "location", "treachery", "objective", "encounter-side-quest"]).optional(),
  // A card with the Safe keyword (Across the Ettenmoors, mec108.safe): "search the encounter deck and discard pile for a location with the safe keyword" (10077:A:2). With `type: "objective"` the pool's other objectives stay out.
  safe: z.literal(true).optional(),
  // The Wizard's Quest (51001:A:1, 51003:B:1): a printed cost at most `maxCost` (`maxCostMulti` with two or more players), any of the printed `types`, only the top `top` cards of the encounter deck. `byChallenge`: "the opposing team" finds it, so nobody is asked:
  // the card that gives the players the greatest challenge (docs/brief.md, The Wizard's Quest, reading 3): of enemies and locations the highest Threat (enemies: then the highest Attack), then the one nearest the top; of any other card the one nearest the top.
  maxCost: z.number().int().min(0).optional(), maxCostMulti: z.number().int().min(0).optional(), types: z.array(z.enum(["enemy", "location", "treachery"])).min(2).optional(), top: z.number().int().positive().optional(), byChallenge: z.literal(true).optional(),
};

export const simpleVerbs = [
  // Draws `amount` cards (one by default), or that many for each Hobbit hero. `who`: the actor, the picked player, or the
  // seat the event is about. `from: "bottom"`: the cards come off the bottom of the deck, still a draw ("draw the bottom card of his deck", 12099:A:2).
  z.strictObject({
    verb: z.literal("Draw"),
    perHero: z.string().min(1).optional(),
    amount: positiveAmountSchema.optional(),
    who: z.enum(["actor", "picked", "eventSeat", "firstPlayer"]).optional(),
    from: z.literal("bottom").optional(),
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
        // A ready card in play with this title that a player controls, whichever printing the game deals ("Exhaust the Gate Key to travel here", 12068:B:3: 12071, or 110078 in a campaign).
        z.strictObject({ kind: z.literal("byName"), name: z.string().min(1) }),
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
  // `other`: the second card the answered event names (the defender of an attack that resolved).
  z.strictObject({ verb: z.literal("Ready"), target: z.enum(["self", "host", "picked", "allCharacters", "subject", "defender", "other"]).optional(), ...when }),
  // Chooses a card or a player for the instructions that follow (target "picked"). A choice of one is made without asking.
  verbFlags(z.strictObject({ verb: z.literal("Pick"), pick: pickSchema, ...when }), { runsInFrame: true }),
  // Lowers a threat dial. It stops at 0.
  // `eventSeat` is the player the answered event happened to.
  z.strictObject({ verb: z.literal("LowerThreat"), amount: positiveAmountSchema, who: z.enum(["actor", "picked", "eachSeat", "eventSeat"]), ...when }),
  // Places damage on the picked card (or `target`) as a player card effect (toughness and immunity apply).
  // `uncancelable`: the damage cannot be canceled by an ability that cancels damage, though one that moves it to another card still can ("This effect cannot be canceled", 03028:A:1; docs/brief.md, Flight from Moria).
  z.strictObject({ verb: z.literal("DamageCard"), amount: positiveAmountSchema, target: cardRefSchema.optional(), uncancelable: z.literal(true).optional(), ...when }),
  // Places progress tokens on the picked location, on every location in the staging area, on the source or the active
  // location. A full location is explored. `host`: the location the source is attached to.
  z.strictObject({ verb: z.literal("PlaceProgressOn"), amount: positiveAmountSchema, target: z.enum(["picked", "eachStagingLocation", "self", "activeLocation", "subject", "host"]), ...when }),
  // Heals damage from the picked card (or `target`): `amount`, or all of it. The `healed` event names the card whose effect healed (its other card). `athelas`: the heal counts as an Athelas heal, which an attachment that
  // reduces heals "other than Athelas" leaves alone (02062:B:1, 900608:A:2).
  z.strictObject({ verb: z.literal("Heal"), amount: positiveAmountSchema.optional(), all: z.boolean().optional(), target: cardRefSchema.optional(), athelas: z.literal(true).optional(), ...when }),
  // Puts the picked card (or `target`) on top or at the bottom of its owner's deck, or shuffles it in. A card leaving play this
  // way leaves play.
  z.strictObject({ verb: z.literal("PutOnDeck"), position: z.enum(["top", "bottom", "shuffle"]), target: cardRefSchema.optional(), ...when }),
  // Moves resources from the card picked before the last to the last picked card: `amount`, or all of them.
  z.strictObject({ verb: z.literal("MoveResources"), amount: positiveAmountSchema.optional(), all: z.boolean().optional(), ...when }),
  // The actor chooses and discards this many cards from their hand (fewer when the hand runs out).
  z.strictObject({ verb: z.literal("DiscardFromHand"), amount: positiveAmountSchema, ...when }),
  // Cancels damage the answered `damageDealt` event just dealt to its card (or `target`): `amount` of it, or all of it. The card
  // is not destroyed by damage that was canceled (rr.cancel).
  z.strictObject({ verb: z.literal("CancelDamage"), amount: positiveAmountSchema.optional(), all: z.boolean().optional(), target: cardRefSchema.optional(), ...when }),
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
  // Commits the source to the quest and exhausts it. With `target`, commits that card (already exhausted or not, it stays as it
  // is) and announces `committed` ("commit that hero to the quest", 12086:A:2).
  z.strictObject({ verb: z.literal("Commit"), target: cardRefSchema.optional(), ...when }),
  verb("RevealStaging"),
  verb("PlaceProgress"),
  // Raises a threat dial by `amount` (1 by default). `eachSeat` raises every living seat's. With `perCommitted` the amount
  // counts once for each such card the seat has committed to the quest ("1 for each non-Fellowship hero he committed to the
  // quest", 141051:A:2).
  z.strictObject({
    verb: z.literal("RaiseThreat"),
    amount: positiveAmountSchema.optional(),
    // `hostController`: the controller of the card the source is attached to ("raise attached hero's controller's threat by 2", 01109:A:3).
    // `defendingPlayer`: the player the source enemy is engaged with, the defending player of its attack ("the defending player must raise his threat by 3", 144017:A:2; rr.defending-player), the actor with none.
    who: z.enum(["actor", "firstPlayer", "otherPlayer", "eachSeat", "picked", "eventSeat", "hostController", "defendingPlayer"]).optional(),
    perCommitted: z
      .strictObject({
        type: z.literal("hero"),
        exceptSphere: z.enum(["leadership", "tactics", "spirit", "lore", "neutral", "fellowship", "baggins"]).optional(),
      })
      .optional(),
    // The raise is part of the starting threat ("Add ... to your starting threat", 22134:A:2): the recorded starting threat level rises with it.
    starting: z.literal(true).optional(),
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
  verbFlags(codeVerb("AddToStaging"), { setupRole: "dealt" }),
  codeVerb("MakeActiveLocation"),
  verbFlags(codeVerb("SetAside"), { setupRole: "dealt" }),
  verbFlags(codeVerb("AttachToRingBearer"), { setupRole: "dealt" }),
  // Moves a card that was set aside, out of play, into the staging area. It is not a reveal. `all`: every set aside copy of the code joins it ("each set aside Soldier of Isengard", 143073:A:1), not one.
  // Exactly one of `code` and `trait` (the effect schema refuses neither and both). `trait` instead of `code`: the set aside cards with that trait ("add each set aside Harad enemy to the staging area", 145078:B:1; with `all`). `announce`: the card entering play is announced as added to the staging area (`addedToStaging`), for the cards that hear it ("Forced: After Thaurdir enters play", 10166:A:3); without it nothing is announced.
  z.strictObject({ verb: z.literal("AddSetAsideToStaging"), code: z.string().min(1).optional(), trait: z.string().min(1).optional(), all: z.literal(true).optional(), ...when }),
  // A set-aside card with this code is added to the staging area and enters play, as an encounter card effect puts a card there (the cards that hear it enter play or be added to the staging area hear it: Thaurdir, 10166:A:3, 09074:A:1). AddSetAsideToStaging does not announce.
  z.strictObject({ verb: z.literal("EnterSetAsideStaging"), code: z.string().min(1), ...when }),
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
  // Moves one matching card from the encounter discard pile into the encounter deck, then shuffles. With `each`, every matching card goes and the deck is shuffled once ("shuffle all copies of the \"Sacked!\" card from the discard pile back into the encounter deck", 02041:A:1).
  // `who: firstPlayer`: the first player chooses the card ("The first player chooses X Tentacle enemies", rr.first-player; Rippling From Beneath 901508:A:2); the actor does otherwise.
  z.strictObject({ verb: z.literal("ShuffleIntoDeck"), ...searchSelector, each: z.literal(true).optional(), who: z.literal("firstPlayer").optional(), ...when }),
  // Finds a card in the encounter deck or discard pile and reveals it. `cost`: the search is a Travel cost the players must be able to pay, so it needs a card to find ("Travel: The first player searches ... for a Warg enemy", 10024:A:2; rr.travel); read by the angmar family. `to: "engaged"`: the enemy found is revealed and put into play engaged with the revealing player instead of staged ("reveal it, and put it into play engaged with you", 143065:A:2).
  // `deckOnly`: the encounter deck alone is searched, not its discard pile ("Search the encounter deck for 1 copy of Prison Cell", 10039:A:2).
  // A Shadow effect with it runs in a frame, as its reveal waits for the card's When Revealed ("Search the encounter deck for a treachery card ... and reveal it", 901807:A:2).
  verbFlags(z.strictObject({ verb: z.literal("SearchReveal"), ...searchSelector, who: whoSchema, to: z.enum(["staging", "engaged"]).optional(), cost: z.literal(true).optional(), deckOnly: z.literal(true).optional(), ...when }), { runsInFrame: true }),
  // Finds a card in the encounter deck or discard pile and puts it out without revealing it. With `each`, every card that
  // matches goes ("add each Nazgûl enemy found to the staging area", 141027:A:1) and nobody chooses.
  verbFlags(z.strictObject({
    verb: z.literal("SearchMove"),
    ...searchSelector,
    // `engaged`: into play engaged with the player who searches ("put it into play engaged with you", 41013:A:1, 41024:A:1).
    // `stormcallerArea`: into the Stormcaller's area ("add it to the Stormcaller's area", 12017:A:1; dcce.stormcallers-area).
    to: z.enum(["staging", "engagedFirstPlayer", "engaged", "stormcallerArea"]),
    each: z.boolean().optional(),
    // The encounter deck alone is searched, not its discard pile ("search the encounter deck for a Harad enemy", 144037:A:1; rr.search: the discard pile is searched only when the line says so).
    deckOnly: z.literal(true).optional(),
    // The encounter discard pile alone is searched ("Put each copy of Cursed Dead in the discard pile into play in the staging area", 09061:A:1; with `each`, `to: "staging"`: no search of the deck).
    discardOnly: z.literal(true).optional(),
    // The victory display is searched too ("search the encounter deck, discard pile, and victory display for a Nazgûl enemy", 146036:A:2).
    victory: z.literal(true).optional(),
    // While a card with this code is in the encounter deck or its discard pile, the search must take it, until an earlier search of the same effect has taken one ("one of those enemies must be
    // Great Warg Chief, if able", 142022:A:1; "one of those enemies must be Corsair Captain, if able", 145030:A:3: the first search takes it, the others are free).
    require: z.string().min(1).optional(),
    // With `require`: only the search of the player an earlier Pick of this effect chose must take it ("each player searches ... the first player names which player's choice is Patrol Leader", 03065:B:1;
    // rr.first-player); with no player picked (a game with one player) every search is held to it.
    requireFor: z.literal("picked").optional(),
    // The card found is the effect's picked card afterward, for the instructions that follow ("add it to the staging area. Then, attach Heavy Cruiser to that objective", 12127:A:3).
    remember: z.literal(true).optional(),
    // With `to: "engaged"`: the card found comes into play engaged with the seat an earlier pick chose (PickHighestThreat), not with the searching player ("puts it into play engaged with the player with the highest threat", 10083:A:2).
    engagedSeat: z.literal("picked").optional(),
    // The card found must have a title no card an earlier search of this effect found has: "each player searches for a different location" (41004:B:1,
    // 41005:A:1). The titles are the cards' printed names; cards that share one are the same choice.
    different: z.boolean().optional(),
    ...when,
  }), { runsInFrame: true, setupRuns: "inForEachPlayer" }),
  z.strictObject({ verb: z.literal("ReturnToStaging"), target: targetSchema, ...when }),
  // Engages the enemies in the staging area with `who` (the player guarding Gollum with `guardian`). `inPlay`: every enemy in play, the ones engaged with another player too, which move to `who` ("all enemies in play engage the player guarding Gollum", 02129:B:1; rr.in-play-and-out-of-play).
  z.strictObject({
    verb: z.literal("EngageAll"),
    trait: z.string().min(1).optional(),
    who: whoSchema,
    inPlay: z.literal(true).optional(),
    ...when,
  }),
  // `counted`: the running effect counts a card this discards out of play for its `noneDiscarded` condition ("discard Tom Bombadil. Then, shuffle ...", 147022:A:1: the part after "then" resolves only if the discard did, rr.then).
  z.strictObject({ verb: z.literal("Discard"), target: targetSchema, counted: z.literal(true).optional(), ...when }),
  // The card is destroyed (rr.destroy), not discarded: a hero or ally lies in its owner's discard pile and the table hears it was destroyed ("Destroy all heroes with the card 'Sacked!' attached", 02049:A:1).
  z.strictObject({ verb: z.literal("Destroy"), target: targetSchema, ...when }),
  z.strictObject({
    verb: z.literal("AttachSelf"),
    to: z.discriminatedUnion("kind", [
      // A hero the revealing player controls, or (`control: "any"`, "Attach to a hero.") any player's hero, chosen by the
      // first player (rr.first-player), or (`highestThreat`, "The player with the highest threat level attaches this card to one of his
      // heroes", 01080:A:1) a hero of the player with the highest threat, who chooses it (the first player chooses among the heroes
      // of the players tied for the highest), or (`highestThreatCost`, "Attach to the hero with the highest threat cost", 41043:A:2) the hero
      // with the highest printed threat cost among every hero in play (the first player chooses among those tied), or (`picked`, "attach this
      // card to one of that player's heroes", 900106:A:1) a hero of the player the effect picked, who chooses it.
      // or (`firstPlayer`, "Attach to a hero with no \"Sacked!\" cards attached controlled by the first player", 02048:A:1) a hero the first player controls, chosen by the first player.
      // or (`mostAttachments`, "Attach to the hero with the most attachments without Weighed Down attached", 18027:A:1) the hero with the most attachments among those the card is not on yet; the first player chooses among heroes tied.
      z.strictObject({ kind: z.literal("hero"), control: z.enum(["you", "any", "highestThreat", "highestThreatCost", "picked", "mostAttachments", "firstPlayer"]).optional(), exceptSphere: z.enum(["leadership", "tactics", "spirit", "lore", "neutral", "fellowship", "baggins"]).optional(),
        // "Attach to a Warrior hero." (143015:A:2): only a hero with this printed trait (rr.attachment-cards: a play restriction is checked as the attachment enters play).
        trait: z.string().min(1).optional(),
        // "Attach it to a hero with 1 or more Willpower" (900806:A:1): only a hero whose current Willpower is at least this.
        minWillpower: z.number().int().min(1).optional(),
        // The card has no limit per hero ("Driven by Fear", 50325:A:1: a second copy may go on the same hero): a hero that carries a copy is offered too.
        unlimited: z.literal(true).optional() }),
      // `challenge` (51017:A:1): the opposing team attaches it, nobody is asked: the enemy with the most hit points left (reading 3).
      z.strictObject({ kind: z.literal("enemy"), trait: z.string().min(1), challenge: z.literal(true).optional() }),
      // The enemy making the attack in progress ("Shadow: Attach this card to attacking enemy", 18018:A:2).
      z.strictObject({ kind: z.literal("attackingEnemy") }),
      // A Ship objective the players control, chosen by the first player ("Attach to a Ship objective.", 12132:A:1), or (`defender`) the Ship objective defending the attack in progress
      // ("If defending character is a Ship, attach ~ to it.", 12132:A:2).
      z.strictObject({ kind: z.literal("ship"), defender: z.literal(true).optional() }),
      // A character (hero or ally, an objective ally included) of any player, chosen by the first player: with `trait`, one that has the Trait now ("Attach to an Eagle character", 900607:A:2; a character that lost it is not offered); with `name`, the
      // character of that title ("Attach to Wilyador", 900608:A:2). A character that carries a copy is not offered, unless `unlimited` (the card has no limit per character). With none to host it the card is discarded. `control: mostAttachments`: of the characters the card is not on yet, those holding the most attachments ("Attach to the character with the most attachments without Befouled Equipment attached", 51036:A:1); the first player chooses among those tied.
      z.strictObject({ kind: z.literal("character"), trait: z.string().min(1).optional(), name: z.string().min(1).optional(), unlimited: z.literal(true).optional(), control: z.literal("mostAttachments").optional() }),
    ]),
    // The attachment is announced as it attaches (the `attached` trigger, as a played attachment is, rr.attachment-cards): "more than 1 copy" on a hero is read as the second one attaches (04023:A:1).
    announces: z.literal(true).optional(),
    ...when,
  }),
  z.strictObject({ verb: z.literal("UncommitAll"), who: whoSchema, ...when }),
  z.strictObject({ verb: z.literal("TakeControl"), who: whoSchema, ...when }),
  verb("GainSurge"),
  z.strictObject({ verb: z.literal("HideTest"), x: z.number().int().positive(), ...when }),
  // The source enemy attacks now, dealt a shadow card of its own; with `shadow: false` it is dealt none ("makes an additional attack after this one. (Do not deal it a shadow card.)", 18022:A:1).
  // `keepShadows` (with `shadow: false`): the shadow cards the enemy already holds are not discarded first, so they all resolve in this attack ("do not deal it another shadow card for this attack", 10131:A:2).
  // `afterThis`: while the source enemy's attack is in progress the new attack is made once this one has ended ("makes an additional attack against you after this one", 143052:A:1); with no attack under way nothing happens. `blankBonus`: when the shadow card dealt for this attack has no shadow effect the attacking enemy gets this much Attack for the attack ("If Hunting Warg is dealt a shadow card with no shadow effect for this attack, it gets +2 Attack", 51037:A:1).
  // `target: subject`: the enemy the answered event is about, engaged with a player, attacks that player, not the source (a Forced effect of the quest stage, "it makes an immediate attack. Do not deal it a shadow card", 50607:B:2).
  verbFlags(z.strictObject({ verb: z.literal("ImmediateAttack"), shadow: z.literal(false).optional(), keepShadows: z.literal(true).optional(), afterThis: z.literal(true).optional(), target: z.literal("subject").optional(), blankBonus: z.number().int().positive().optional(), ...when }), { runsInFrame: true }),
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
  // `maxWillpower` cannot defend the source's attacks (141068:A:3). `travelOnly` (on a location in the staging area): while there is no
  // active location the players must travel to it and nowhere else, if able (01088:A:1).
  z.strictObject({
    verb: z.literal("Restrict"),
    what: z.enum(["advance", "travel", "attach", "heroLimit", "defend", "travelOnly", "commit", "draw", "playFromHand"]),
    // With "travel" on a card that is not the location: the players cannot travel to the location with this code ("The players cannot travel to The Old Ford unless there is at least 5 progress here", 18068:B:1).
    location: z.string().min(1).optional(),
    // With "travel" and `location`: only the location with that code that guards the objective with this title ("the Grey Moorland guarding Tiny", 19048:B:3).
    guarding: z.string().min(1).optional(),
    exceptTrait: z.string().min(1).optional(),
    // With "travel": the players cannot travel to a location that holds resource tokens (51003:B:2).
    withResources: z.literal(true).optional(),
    // With "attach": the card may have boons attached though it has no other attachments ("Cannot have non-boon attachments", 146020:A:1). A boon is a card the campaign pool holds as one (`campaignKind`), which no trait names.
    exceptBoon: z.literal(true).optional(),
    // With "travel" on a card that is not the location: the players cannot travel to a location with this trait ("The players cannot travel to Pelennor locations", 145075:B:3).
    trait: z.string().min(1).optional(),
    maxWillpower: z.number().int().min(0).optional(),
    // With "defend": every ally (not only those with little Willpower) cannot defend the source's attacks ("Allies cannot defend against
    // Orc-chieftain", 142045:A:1).
    allies: z.boolean().optional(),
    // With "defend": only the allies whose printed hit points are fewer than the source's cannot defend ("Allies with fewer printed hit points than Uruk-hai
    // Captain cannot defend against Uruk-hai Captain", 142069:A:2).
    belowSourceHitPoints: z.boolean().optional(),
    // With "travel" on a card that is not the location: the players cannot travel to any location but the source ("players cannot travel to other locations", 50217:A:2).
    exceptSelf: z.boolean().optional(),
    // With "commit" (a player who does not control a card that matches this cannot commit characters to the quest, 02013:B:1) and "draw" (such a player cannot draw cards through card effects, 900404:A:1: the resource phase's and the round's draws are framework
    // draws, not card effects). The pick is read from each player's side.
    unlessControls: pickSchema.optional(),
    // With "commit" and "playFromHand": the rule binds the player guarding Gollum only ("The player guarding Gollum cannot commit characters to this quest", 02127:B:1; "cannot play cards from his hand", 02128:B:1). "playFromHand" bars playing a card from the hand, not putting one into play
    // (rr.play-and-put-into-play). `exceptAlone`: unless he is the only player remaining in the game. Read by src/rules/interpret/restrictions.ts (seatBarred) and src/rules/families/guardian/.
    guardian: z.literal(true).optional(),
    exceptAlone: z.literal(true).optional(),
    // With "draw" on an enemy: binds the player the source is engaged with, and only while it is ("While Sentinel of the Deep is engaged with a player, that player cannot draw cards from card effects", 901604:A:1).
    engagedPlayer: z.literal(true).optional(),
    ...when,
  }),
  // Constant: the holder's stat is set to `value`, overriding every other modifier (rr.modifiers; "Reduce attached hero's
  // Willpower, Attack, and Defense to 0", 141055:A:2).
  z.strictObject({
    verb: z.literal("SetStat"),
    // `questPoints`: "reduce its quest point value to 1".
    stat: z.enum(["willpower", "attack", "defense", "threat", "questPoints"]),
    value: z.number().int().min(0),
    target: z.enum(["self", "host"]).optional(),
    ...when,
  }),
  // Constant on an encounter card attached by its own text: it counts as an attachment with this trait while attached
  // ("Counts as a Condition attachment", 141043:A:2, 141055:A:2), so "a Condition attachment" finds it (01061:A:1); with no trait it counts as an attachment only ("Counts as an attachment", 50208:A:2).
  z.strictObject({ verb: z.literal("CountsAs"), cardType: z.literal("attachment"), trait: z.string().min(1).optional(), ...when }),
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
  // of the attachment on each (Limit 1 per hero). `hosts` is a list of filters, any of which a host may match ("Attach to a
  // Dale or Dwarf character", "Attach to a hero or Gandalf", "Attach to a location", "Attach to an enemy engaged with a
  // player"); with it, `host.kind` is ignored. A card with no such record may go on any character.
  z.strictObject({
    verb: z.literal("AttachesTo"),
    hosts: z.array(pickSchema).min(1).optional(),
    host: z.strictObject({
      // `quest`: a quest card in play, the current quest or a side quest ("Attach to a quest card in play").
      kind: z.enum(["hero", "character", "activeLocation", "ringBearer", "quest"]),
      trait: z.string().min(1).optional(),
      name: z.string().min(1).optional(),
      // The host's printed sphere ("Attach to a Lore character").
      sphere: z.enum(["leadership", "tactics", "spirit", "lore", "neutral", "fellowship", "baggins"]).optional(),
    }).optional(),
    limitPerHost: z.boolean().optional(),
    ...when,
  }),
  // Constant on a card in hand: it costs this much less to play while `when` holds ("by 1 for each Hobbit hero you control").
  // `host`: only while it is played onto a host that matches ("Reduce the cost to play Herugrim on Théoden by 1").
  z.strictObject({ verb: z.literal("ReduceCost"), amount: positiveAmountSchema, host: pickSchema.optional(), ...when }),
  // Constants on a card in hand, read when it would be played: it can only be played while the condition holds; it can be
  // played from its owner's discard pile (`only`: and from nowhere else); an ally or attachment enters play exhausted.
  z.strictObject({ verb: z.literal("PlayOnlyIf"), condition: conditionSchema, ...when }),
  z.strictObject({ verb: z.literal("PlayFromDiscard"), only: z.boolean().optional(), ...when }),
  verb("EntersPlayExhausted"),
  // The next card the actor (or the picked player) plays that matches costs less, once, until the phase or round ends ("Reduce
  // the cost of the next Silvan ally you play this phase by 1"). `min`: not below this ("to a minimum of 1").
  z.strictObject({
    verb: z.literal("ReduceNextCost"),
    pick: pickSchema,
    amount: positiveAmountSchema,
    // `used`: until a card spends it ("the next card you play"). `who: any`: the next one any player plays ("the next Silvan
    // ally played this phase"). `hostSphere`: only a card of the sphere of the source's host, read now. The card that spends it
    // gains Doomed `doomed` (each player raises their threat as it is played, rr.doomed-x), needs no resource match (`noMatch`)
    // and cannot quest this round (`cannotQuest`). With one of those the discount is made even when its amount comes to 0.
    until: z.enum(["endOfPhase", "endOfRound", "used"]),
    min: z.number().int().min(0).optional(),
    who: z.enum(["actor", "picked", "any"]).optional(),
    hostSphere: z.boolean().optional(),
    doomed: z.number().int().positive().optional(),
    noMatch: z.boolean().optional(),
    cannotQuest: z.boolean().optional(),
    ...when,
  }),
  // Constants on a card in play, read when its controller plays a card that matches. ReduceCostOf: it costs less (`firstEachRound`:
  // only the first such card each round; `onHost`: only an attachment played on the source, or on the source's host).
  // IgnoreResourceMatch: it needs no resource match, and any of the controller's heroes may pay for it. PaysFor: this hero's
  // resources may pay for it (of the `spheres` named, or of any sphere).
  z.strictObject({
    verb: z.literal("ReduceCostOf"),
    pick: pickSchema,
    amount: positiveAmountSchema,
    firstEachRound: z.boolean().optional(),
    onHost: z.enum(["self", "host"]).optional(),
    min: z.number().int().min(0).optional(),
    // The discount is every player's, whoever controls the source, and `firstEachRound` counts the cards all the players play together: "reduce the cost of the first ally played by the players each
    // round by 1" (12098:A:1). Without it only the source's controller gets it, counting their own plays.
    anyPlayer: z.literal(true).optional(),
    ...when,
  }),
  // `firstEachPhase`: only the first such card played in the phase (the sidequests family: "The first non-unique card you play each planning phase").
  z.strictObject({ verb: z.literal("IgnoreResourceMatch"), pick: pickSchema, firstEachRound: z.boolean().optional(), firstEachPhase: z.boolean().optional(), ...when }),
  z.strictObject({ verb: z.literal("PaysFor"), pick: pickSchema, spheres: z.array(z.enum(["leadership", "tactics", "spirit", "lore", "neutral", "fellowship", "baggins"])).min(1).optional(), ...when }),
  // Constant on a card in hand: its cost must be paid from at least `min` (at most `max`) different heroes' pools.
  z.strictObject({ verb: z.literal("PayDistinctHeroes"), min: z.number().int().positive().optional(), max: z.number().int().positive().optional(), ...when }),
  // A deckbuilding limit: at most this many copies of the card in a deck ("Limit 1 per deck").
  z.strictObject({ verb: z.literal("DeckLimit"), copies: z.number().int().positive(), ...when }),
  // Constants on an attachment: the attached card gains this trait, or this resource icon.
  z.strictObject({ verb: z.literal("GrantTrait"), trait: z.string().min(1), ...when }),
  // `fellowship`: the hero also pays for Fellowship cards and counts as a Fellowship hero for a filter that reads the sphere ("Attached hero gains the Ring-bearer trait and the Fellowship sphere", 146014:A:1).
  z.strictObject({ verb: z.literal("GrantIcon"), sphere: z.enum(["leadership", "tactics", "spirit", "lore", "fellowship"]), ...when }),
  // Engine use (Restricted): the source card's controller moves one of its restricted attachments to its owner's discard pile.
  verb("DiscardRestricted"),
  // Adds resources to the pool of the hero the source card is attached to.
  // To the host by default, or to the picked card, the source itself, or the card the answered event was about.
  z.strictObject({ verb: z.literal("AddResources"), amount: positiveAmountSchema, to: z.enum(["host", "picked", "self", "subject", "other"]).optional(), ...when }),
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
  // The source enemy leaves the player it is engaged with and engages the next player. `announces`: the engagement is announced (`engaged`), as any engagement is, so the enemy's own "after ~ engages a player" Forced effect fires again (Goblin Sneak, 04098:A:1).
  // `target: subject`: the enemy the answered event is about engages the next player, from a record on another card ("After Naurlhûg attacks ... it engages the next player", 50607:B:2, a Forced effect of the quest stage).
  z.strictObject({ verb: z.literal("EngageNextPlayer"), announces: z.literal(true).optional(), target: z.literal("subject").optional(), ...when }),
  // The host of the source card, its resource pool, and every card attached to it pass to a seat.
  z.strictObject({ verb: z.literal("TransferHost"), who: whoSchema, ...when }),
  // The players win the scenario. The resolution choices follow.
  verb("WinGame"),
  // Discards cards from the top of the encounter deck until `perPlayer` enemies for each player in the game have been
  // discarded, or the deck is empty, and puts each of those enemies into play engaged with the first player (141045:A:2).
  // `to: staging`: they are added to the staging area instead ("Add each enemy discarded this way to the staging area", 142056:A:2). `to: reveal`: each is revealed, in the order discarded, in full (RevealEnemies; "Reveal all enemies discarded by this effect", 901402:A:1).
  // As a quest card's Setup it is run in a frame of its own after the deal ("Shuffle the encounter deck and discard cards from the top until X enemies are discarded", 19168:A:1).
  // `cardType: location`: locations are counted instead, and with `to: staging` each is added to the staging area ("Discard cards from the top until X locations are discarded... Add each location discarded this way to the staging area", 146077:A:1).
  verbFlags(z.strictObject({ verb: z.literal("DiscardUntilEnemies"), perPlayer: z.number().int().positive(), less: z.number().int().positive().optional(), atLeast: z.number().int().positive().optional(), returnOthers: z.literal(true).optional(), trait: z.string().min(1).optional(), to: z.enum(["staging", "reveal"]).optional(), cardType: z.literal("location").optional(), ...when }), { setupRuns: "top" }),
  // `atLeast`: the count never falls below it ("X is one less than the number of players in the game (minimum of 1)", 04086:B:1, with `less: 1`). `returnOthers`: the cards the effect discarded that are not counted go back into the encounter deck, which is shuffled; the rest of the discard pile stays ("shuffle the other discarded cards back into the encounter deck").
  // The last picked card is placed facedown under the source location. While it is there it is out of play (141049:A:1).
  verb("PlaceUnderSelf"),
  // Each card under the source location returns to the staging area face up (141049:A:2). `to: "engaged"`: each is put into play engaged with the first player instead, and counts as engaging him ("put each enemy under it into play engaged with the first player", 146029:A:2).
  // `from`: the cards under the card in play with this code, not under the source ("add the Loot objective from underneath Stalking the Ruins to the staging area faceup", 50621:A:3).
  z.strictObject({ verb: z.literal("ReturnUnderToStaging"), to: z.literal("engaged").optional(), from: z.string().min(1).optional(), ...when }),
  // The source card (a shadow card) is shuffled into the encounter deck instead of being discarded (141069:A:3).
  verb("ShuffleSelfIntoEncounterDeck"),
  // The actor (or, with `who`, the first player) discards cards at random from their hand, `amount` (1 by default; read, so X works). The seed
  // picks them (141047:A:2, 141084:A:2). `raiseByCost`: the discarding player's threat is raised by the discarded card's printed cost, 0 for a card with no printed cost or an X cost ("Discard a random card from your hand and raise your threat by its printed cost", 10052:A:2).
  z.strictObject({ verb: z.literal("DiscardRandomFromHand"), amount: positiveAmountSchema.optional(), who: z.enum(["firstPlayer", "eachSeat"]).optional(), remember: z.literal(true).optional(), raiseByCost: z.literal(true).optional(), ...when }),
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
    // `onePlayer`: Campaign Setup only. Each seat in turn may take the card, and the offer ends once one has ("One player may choose one copy of Círdan's Blessing", 11200:A:3).
    who: z.enum(["firstPlayer", "eachSeat", "onePlayer"]),
    // `player`: a Resolution's card for a player chosen from those at the table, earned for that player and shuffled into their deck after the starting hand in the scenarios that follow ("choose a
    // player ... that player shuffles that Recurring Nightmare into their deck after they draw their starting hand", 11197:B:1).
    to: z.enum(["pool", "hand", "hero", "player"]),
    optional: z.boolean().optional(),
    leftover: z.enum(["firstPlayerDeck"]).optional(),
    // The card is dealt where `to` says but not earned: the scenario's Resolution decides whether it joins the pool (11182:A:2, with EarnDealt on 11182:B:2).
    unearned: z.boolean().optional(),
    // With `to: hand`: the card joins the hand once the mulligan is over, so a mulligan cannot shuffle it into the deck (the same as AddToHandAfterMulligan, 11182:A:2).
    afterMulligan: z.boolean().optional(),
    // With `to: hero` at a Resolution: the hero may be any player's, not only the chooser's ("record which hero you attach it to", 11182:B:1).
    anyHero: z.boolean().optional(),
    // A Resolution's offer only to a player who controls the objective with this code (a Clue attached to one of their characters, claimed): the card is offered to that seat alone, or to nobody ("For each Clue a player controls, that player may add the boon with the same name to the Campaign Pool and their deck", 10184:B:1).
    ifControls: z.string().min(1).optional(),
    // With `to: pool` and `who: firstPlayer`: the first player chooses one of the named cards for the group, and the others do not join the pool ("Gundabad Hunter or Gundabad Stalker", 12189:B:5); the resolution screen says so.
    only: z.literal(true).optional(),
    ...when,
  }),
  // Resolution: these cards are earned, with no choice. `eachPlayer`: one copy for each living player ("Each player earns 1 copy of
  // the Mendor's Support boon", 01129:B:1), the pool holding several copies of the one code.
  // `afterHand`: the copy goes into its player's deck, shuffled in once the starting hand is drawn ("adds a copy of Misplaced Trust to the campaign pool (and their deck)", 12184:B:3; the card's own Setup, 12186:A:1), as a card a player chooses for the pool does (Recurring Nightmare, 11197:B:1).
  // `forFirstPlayer`: the card is the first player's ("the first player has earned the Palantír of Orthanc boon card", 143081:B:1), a pool entry for that seat.
  z.strictObject({ verb: z.literal("Earn"), codes: z.array(z.string().min(1)).min(1), eachPlayer: z.boolean().optional(), afterHand: z.literal(true).optional(), forFirstPlayer: z.literal(true).optional(), ...when }),
  // Resolution: every burden in play, in the encounter deck and in the encounter discard pile is earned.
  verb("EarnAllBurdens"),
  // Resolution: the hero this card is attached to joins the fallen heroes.
  z.strictObject({ verb: z.literal("MarkFallen"), attached: z.string().min(1), ...when }),
  // Resolution: each player names a hero they control as a captive, other than these traits or codes.
  z.strictObject({ verb: z.literal("NameCaptives"), except: z.array(z.string().min(1)), ...when }),
  // The verbs each mechanic family adds (src/catalog/families).
  ...FAMILY_VERBS,
] as const;

export const simpleInstructionSchema = z.discriminatedUnion("verb", simpleVerbs);
