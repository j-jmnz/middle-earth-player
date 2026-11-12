// Conditions in effect records, the targets an instruction names, and the phase names a condition reads.
import { z } from "zod";

import { ALLY_LINES } from "./ally-lines.ts";
import { amountSchema, pileNameSchema } from "./effect-schema-amount.ts";
import { pickSchema } from "./effect-schema-pick.ts";

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


// The conditions that hold no other condition. `not`, `all` and `any` (below) combine these, one level deep.
const atomSchema = z.discriminatedUnion("kind", [
  // The actor failed a Hide test in the current phase or round.
  z.strictObject({ kind: z.literal("hideFailed"), scope: z.enum(["phase", "round"]) }),
  // The last Hide test the running effect made failed ("Each player who fails this Hide test raises his threat by 5", 906108:A:1; "If the
  // engaged player fails the hide test", 906102:A:3). False before the effect has made one. Read by src/rules/families/nightmare/index.ts.
  z.strictObject({ kind: z.literal("lastHideFailed") }),
  // The current quest card is the quest deck's stage `stage`, its place in the deck counting from 1 ("If the players are on stage 3",
  // 900204:A:2, 900302:A:2). Read by src/rules/families/nightmare/guards.ts.
  z.strictObject({ kind: z.literal("onStage"), stage: z.number().int().positive() }),
  // The actor has an enemy engaged with them, with this trait if one is named.
  z.strictObject({ kind: z.literal("hasEngaged"), trait: z.string().min(1).optional() }),
  // A card with this code is in play and its exhausted state is `is`.
  z.strictObject({ kind: z.literal("exhausted"), code: z.string().min(1), is: z.boolean() }),
  // The source is an enemy engaged with the actor.
  z.strictObject({ kind: z.literal("engagedWithActor") }),
  // The running effect has returned no enemy to staging (or, for ImmediateAttackEach, made no attack).
  z.strictObject({ kind: z.literal("noneReturned") }),
  // The running effect has discarded no card with DiscardEach ("If no cards are discarded by this effect, ~ gains surge", 12106:A:1). Read by src/rules/families/south/damage.ts.
  z.strictObject({ kind: z.literal("noneDiscarded") }),
  // The Embassy from the Dark Tower's pair the running effect is on (EmbassyNext): `pair`, there is one (its player card still lies faceup); `playable`, its player card can be played at no cost by its owner now (146072:B:1). Read by src/rules/families/black-gate/embassy.ts.
  z.strictObject({ kind: z.literal("embassy"), is: z.enum(["pair", "playable"]) }),
  // The mount-doom family's conditions (src/rules/families/mount-doom/conditions.ts). `lastFortitudeFailed`, `lastFortitudePassed`: the last Fortitude test the running effect made was failed, or passed ("If you fail this test", 146051:A:1; "If a player passes this test", 146076:B:1);
  // false before the effect has made one. `fortitudeFailed`: a player failed a Fortitude test this round, `who` the actor ("If you failed a Fortitude test this round", 146055:A:3) or any player ("If a player has failed a Fortitude test this round", 146046:A:1).
  z.strictObject({ kind: z.literal("lastFortitudeFailed") }),
  z.strictObject({ kind: z.literal("lastFortitudePassed") }),
  z.strictObject({ kind: z.literal("fortitudeFailed"), scope: z.literal("round"), who: z.enum(["actor", "any"]) }),
  // The source card is attached to a card the actor controls ("After you fail a Fortitude test, exhaust attached hero", 146057:A:1): an encounter card attached to a hero is controlled by nobody, so the Forced effect's actor, the player the event happened to, is compared with the host's controller.
  z.strictObject({ kind: z.literal("hostControlledByActor") }),
  z.strictObject({ kind: z.literal("phase"), is: phaseNameSchema }),
  // The encounter deck or discard pile holds a card with this code or trait.
  // Where the source card is now. `play` means any zone the source's controller plays from.
  // `victory`: the source is in the victory display, and its constant effects work from there (141046:A:2). `hand`: an Action
  // its player uses from the hand ("put Emery into play from your hand", src/rules/families/deck/play.ts). `encounterDeck`: a card that left play
  // for the encounter deck (Gavin's Planning Action shuffles him in; "When Gavin leaves play (other than by his ability)", 11210:A:3).
  z.strictObject({ kind: z.literal("sourceIn"), zone: z.enum(["activeLocation", "staging", "engaged", "questStage", "play", "victory", "hand", "stormcallerArea", "encounterDeck"]) }),
  // The source card shows this side (a contract, flipped by FlipCard; side A at the start).
  z.strictObject({ kind: z.literal("faceUp"), side: z.enum(["A", "B"]) }),
  // The actor's seat (`seat`) or the source card (`self`) holds this flag, a modifier of that stat that is in force now (`is`: false
  // for not): "You can only choose each option once per round" records an option as taken on the seat until the end of the round.
  z.strictObject({ kind: z.literal("flag"), stat: z.string().min(1), holder: z.enum(["seat", "self"]), is: z.boolean().optional() }),
  // A card with this code is in the victory display (`is`) or is not.
  z.strictObject({ kind: z.literal("inVictory"), code: z.string().min(1), is: z.boolean() }),
  // The victory display holds a copy (a card with the same title) of the source, the card the answered event is about, the last
  // picked card, the second card the event names or the active location (`is`), or none does ("if there is a card with the same
  // title in the victory display", src/rules/families/sidequests/pick.ts).
  z.strictObject({ kind: z.literal("copyInVictory"), card: z.enum(["self", "subject", "picked", "other", "activeLocation"]), is: z.boolean().optional() }),
  // Some location other than the source is in the staging area or is the active location.
  z.strictObject({ kind: z.literal("otherLocationInPlay") }),
  // The actor controls a hero that is exhausted.
  z.strictObject({ kind: z.literal("heroExhausted") }),
  // The attack in progress has no defender (declared or considered).
  z.strictObject({ kind: z.literal("undefended") }),
  // `type`: only a card of this printed type counts ("discard cards from the top of the encounter deck until an enemy is discarded" is offered while an enemy is left in the deck, 146061:A:1). `victory`: the victory display is read too (146036:A:2).
  z.strictObject({ kind: z.literal("searchable"), trait: z.string().min(1).optional(), code: z.string().min(1).optional(), type: z.enum(["enemy", "location", "treachery", "objective", "encounter-side-quest"]).optional(), deckOnly: z.literal(true).optional(), victory: z.literal(true).optional() }),
  // Some card matches this pick (for the actor now): a choice that could be made.
  z.strictObject({ kind: z.literal("canPick"), pick: pickSchema }),
  // Each of the actor's heroes has this trait, and the actor has one ("Play only if each of your heroes is a Hobbit",
  // 19121:A:1).
  z.strictObject({ kind: z.literal("heroesAll"), trait: z.string().min(1) }),
  // The actor has a card in hand.
  z.strictObject({ kind: z.literal("handHasCard") }),
  // The event is about the actor engaging an enemy whose engagement cost is higher than the actor's threat.
  z.strictObject({ kind: z.literal("engagedAboveThreat") }),
  // The card the event is about (a location that left play) had enough progress to be explored.
  z.strictObject({ kind: z.literal("subjectExplored") }),
  // Another player is still in the game.
  z.strictObject({ kind: z.literal("otherPlayer") }),
  // The actor holds the first player token ("Each other player searches ...", 41003:A:1, is `not` this one; src/rules/interpret/conditions.ts).
  z.strictObject({ kind: z.literal("firstPlayer") }),
  // The card with this code, in play, holds at least `min` resource tokens ("If there are 6 or more resource tokens here", 41050:B:1): read at a
  // campaign card's Resolution (campaign family, src/rules/families/campaign/index.ts).
  // With `perPlayer`, `min` is for each player in the game ("X resource tokens on this stage. X is the number of players times 3", 142041:B:2).
  z.strictObject({ kind: z.literal("tokens"), code: z.string().min(1), min: z.number().int().min(0), perPlayer: z.boolean().optional() }),
  // The total Threat of the encounter cards in the actor's staging area is at most `max` ("if the total Threat of encounter cards in this staging
  // area is less than 4", 142063:A:1: max 3). Once stages are separate that is the actor's own area (mec109.multiple-staging-areas); read by
  // src/rules/interpret/conditions.ts.
  z.strictObject({ kind: z.literal("stagingThreat"), max: z.number().int().min(0) }),
  // The source card holds at most `max` damage tokens (0: none, "if there are no damage tokens here", 142043:A:1). Read by the moria family
  // (src/rules/families/moria/index.ts).
  z.strictObject({ kind: z.literal("damageHere"), max: z.number().int().min(0) }),
  // The amount `left` is less than the amount `right`: "If that character's printed Willpower is less than the discarded card's Threat" (142058:A:2).
  z.strictObject({ kind: z.literal("less"), left: amountSchema, right: amountSchema }),
  // Each surviving player's threat is at most `max` ("1 XP if each surviving player's threat is 40 or less", dcce.gaining-xp): read at a campaign
  // card's Resolution, true with no surviving player.
  z.strictObject({ kind: z.literal("survivorsThreat"), max: z.number().int().min(0) }),
  // The attack that left this effect for its end (AfterAttack), or the damage the answered event placed, dealt at least `min` damage (1 by default):
  // "If this attack deals damage to a Ship objective" (11051:A:2; read with a `matches` condition on the defender).
  // The attack that left this effect for its end sent at least `min` damage on past its defender (excessToShip; 11055:A:2).
  // The heal or ready the effect answers was made by a player card's effect (11217:B:3), not by a rule, the refresh phase or an encounter card.
  z.strictObject({ kind: z.literal("byPlayerCard") }),
  // The engagement the Forced effect answers was from the staging area ("When Corsair Skiff engages you from the staging area", 12022:A:3): known only in a game with ships (dcce.boarding).
  z.strictObject({ kind: z.literal("fromStaging") }),
  z.strictObject({ kind: z.literal("excess"), min: z.number().int().positive() }),
  z.strictObject({ kind: z.literal("dealt"), min: z.number().int().positive().optional() }),
  // The Heading card's setting (dcce.heading): on-course (Sun, the only on-course setting), off-course (Cloud, Rain or Storm), or at the worst
  // setting (Storm). False when the game has no Heading card. Read by the sea family (src/rules/families/sea/heading.ts).
  z.strictObject({ kind: z.literal("heading"), is: z.enum(["onCourse", "offCourse", "worst"]) }),
  // The actor's characters committed to the quest add up to at least `min` Willpower ("Each player contributing at least 8 Willpower to the quest", 12028:A:1): the stat the quest counts, as the quest reads it.
  z.strictObject({ kind: z.literal("committedWillpower"), min: z.number().int().min(0) }),
  // The allies the actor controls have a total Willpower of at least `min` ("discard allies he controls with a total of at least 3 Willpower", 12125:A:3). Read by the sea family (src/rules/families/sea/skirmisher.ts).
  z.strictObject({ kind: z.literal("alliesWillpower"), min: z.number().int().positive() }),
  // The players are at the same quest stage as the Stormcaller (`sameStage`, dcce.stormcallers-area-stages: their main quest stage's number matches its current stage), or not. False in a game
  // with no Stormcaller's area. Read by the stormcaller family (src/rules/families/stormcaller/values.ts).
  z.strictObject({ kind: z.literal("stormcaller"), is: z.enum(["sameStage", "ahead"]) }),
  // No player holds more than `max` cards in hand ("If no cards were discarded by this effect": no player holds more than 3 cards, 12080:A:1).
  z.strictObject({ kind: z.literal("handSize"), max: z.number().int().min(0) }),
  // The Island Map (src/rules/families/island/pick.ts): at most `flippedAtMost` of its double-sided (Uncharted) locations are flipped over to the location side ("4 or fewer Uncharted locations are faceup", 11197:B:6, read as the flipped ones: a short route; user decision, 2026-11-01), and/or the last travel went to the right
  // ("When you travel to the right", 12077:A:1), and/or at least `revealed.min` copies of the card with this code are in the game and not secrets under a Temple location ("For each Recurring Nightmare that is not a secret", 11197:B:1).
  z.strictObject({ kind: z.literal("island"), flippedAtMost: z.number().int().min(0).optional(), movedRight: z.literal(true).optional(), revealed: z.strictObject({ code: z.string().min(1), min: z.number().int().positive() }).optional() }),
  // A card with this code is in play (`is`) or is not. Read at the end of a scenario, for a resolution.
  z.strictObject({ kind: z.literal("inPlay"), code: z.string().min(1), is: z.boolean() }),
  // The quest advanced to the stage with this code (`is`) or did not. Kept only by a quest that branches (BranchStage), read by the
  // Resolution of 01129 ("If stage 3B was Beorn's Path"): src/rules/interpret/conditions.ts, state.stagesReached.
  z.strictObject({ kind: z.literal("stageReached"), code: z.string().min(1), is: z.boolean() }),
  // The source objective has no encounter card attached to it: it is "free of encounters" (rr.guarded; 01108:A:2). Read for a Guarded
  // objective in the staging area.
  z.strictObject({ kind: z.literal("freeOfEncounters") }),
  // The players control the source objective: a freed tower in the staging area (12134:A:2, ControlWhenFree) or an objective a player claimed and attached to a hero (`claimed`,
  // families/objectives/claimed.ts). "If the players control Tower of the Gull" (12135:A:3).
  z.strictObject({ kind: z.literal("controlledByPlayers") }),
  // A hero is the "prisoner" now, facedown, until it is rescued (`is`), or none is (01124:B:3; src/rules/families/prisoner/index.ts).
  z.strictObject({ kind: z.literal("prisoner"), is: z.boolean() }),
  // The Ered Mithrin Campaign Log (emce.boon-allies, emce.treasure; src/rules/families/wilderland/index.ts): the "Unique Allies Protecting Wilderland" line is recorded (`is` false: it is not),
  // or at least `min` treasures are recorded as discovered ("If there are 6 or more treasures recorded in the campaign log"). Read from the facts the log hands the game; a game without them holds neither.
  z.strictObject({ kind: z.literal("logged"), line: z.enum(ALLY_LINES), is: z.boolean().optional() }),
  z.strictObject({ kind: z.literal("treasuresLogged"), min: z.number().int().positive() }),
  // The actor has a box left beside Beldis on the Campaign Log (emce.campaign-log: four for each player): "mark a use in the campaign log" (12188:A:1). Read by the wilderland family; a game without the log's facts has none marked.
  z.strictObject({ kind: z.literal("beldisBox") }),
  // The Caves deck (emce.caves-deck) holds at least `min` cards (1 by default): "look at the top 2 cards of the Caves deck" (18055:A:2). Read by the wilderland family; a game with no Caves deck holds none.
  z.strictObject({ kind: z.literal("cavesDeck"), min: z.number().int().positive().optional() }),
  // The deck beside the encounter deck holds at least `min` and at most `max` cards (a game that did not deal it holds none): "The players cannot travel here unless there are no facedown cards under The Cross-roads" (144030:A:2; `max` 0) and the Travel cost of
  // Southward Road, which reveals the top card of that deck (144032:A:2). Read by the wilderland family, which also reads `cavesDeck`.
  z.strictObject({ kind: z.literal("pileHas"), pile: pileNameSchema, min: z.number().int().positive().optional(), max: z.number().int().min(0).optional() }),
  // The cards facedown under the card in play with this code number at least `min` and at most `max`, each plus the number of players with `players` ("If there are at least X facedown cards under The Black Gate, the players lose the game. X is 3 more than the
  // number of players", 144027:A:2). 0 with no such card in play. The count of a card in the zone `under`, as `underBurn` reads it for The Havens Burn. Read by the harad family.
  z.strictObject({ kind: z.literal("facedownUnder"), code: z.string().min(1), min: z.number().int().min(0).optional(), max: z.number().int().min(0).optional(), players: z.literal(true).optional() }),
  // The actor's threat dial holds a copy of the card with this code (`onDial`: "attached to your threat dial"), or a copy of it is set aside and the dial holds none (`canAttachToDial`: the option "attach a set aside Overcome by Fear to your threat dial" can be done;
  // Limit 1 per threat dial). Read by the attachments family (src/rules/families/attachments/dial.ts).
  z.strictObject({ kind: z.literal("onDial"), code: z.string().min(1) }),
  z.strictObject({ kind: z.literal("canAttachToDial"), code: z.string().min(1) }),
  // The quest deck holds at least `min` stages (1 by default): the stage 2s Mount Gundabad's current quest can be bypassed in favor of (19135:B:3; emce.bypassing). Read by the wilderland family.
  z.strictObject({ kind: z.literal("questDeck"), min: z.number().int().positive().optional() }),
  // The enemy with this title has resolved an attack in the combat phase now under way ("unless he has resolved an attack this phase", 19155:A:1): false in any other phase. Read by the wilderland family.
  z.strictObject({ kind: z.literal("attackedThisPhase"), name: z.string().min(1) }),
  // The card in play with this title holds this flag, a modifier of that stat in force now: "resources cannot be placed on The Heroes' Defense" (19161:A:2) read by the Watchtower's option (19163:A:2). Read by the wilderland family.
  z.strictObject({ kind: z.literal("namedFlag"), name: z.string().min(1), stat: z.string().min(1) }),
  // The active location has no Discover keyword to resolve (none printed, or the keyword is ignored): "If they cannot, Abandoned Ruins gains surge and doomed 2" (19106:A:1; emce.discover). Read by the wilderland family.
  z.strictObject({ kind: z.literal("discoverUnavailable") }),
  // A card with this code is attached to a hero (`is`) or is not.
  z.strictObject({ kind: z.literal("attachedToHero"), code: z.string().min(1), is: z.boolean() }),
  // Read while a stat is read, not when a constant effect is synced. `defending`: the holder is the declared defender
  // and the attacking enemy's engagement cost is higher than its controller's threat. `attacking`: the holder is
  // attacking an enemy whose engagement cost is higher than the holder's controller's threat.
  z.strictObject({ kind: z.literal("versusHighEngagement"), role: z.enum(["defending", "attacking"]) }),
  // The holder is an enemy attacking a defender (declared, not undefended) whose printed hit points are at most `maxHitPoints` ("gets +2 Attack against
  // characters with 2 or fewer printed hit points", 142071:A:2). Read while a stat is read, like versusHighEngagement (src/rules/core/keywords.ts).
  // `ally`: the defender is an ally ("gets +2 Attack when attacking allies", 12054:A:2).
  z.strictObject({ kind: z.literal("versusDefender"), maxHitPoints: z.number().int().min(0).optional(), ally: z.literal(true).optional() }),
  // The source card is attached to a card with this name.
  z.strictObject({ kind: z.literal("hostNamed"), name: z.string().min(1) }),
  // The actor controls a hero or ally in play with this code.
  z.strictObject({ kind: z.literal("controls"), code: z.string().min(1) }),
  // A copy of this card is out of play where an effect can take it from ("shuffle 1 out of play Ringwraith into the encounter
  // deck" on 141026:B:2, 141051:A:2, 141053:A:1, 141054:A:2): set aside, in the encounter discard pile or the victory display
  // (rr.in-play-and-out-of-play), or under a location (141049:A:1). See outOfPlayCopies in src/rules/interpret/conditions.ts.
  z.strictObject({ kind: z.literal("outOfPlay"), code: z.string().min(1) }),
  // The current quest card has progress on it (141026:B:2: removing progress is an effect that changes the game, rr.effects).
  z.strictObject({ kind: z.literal("questProgress") }),
  // An enemy (with this trait, if one is named) is in play (`is`) or none is (141027:B:1).
  z.strictObject({ kind: z.literal("enemyInPlay"), trait: z.string().min(1).optional(), is: z.boolean() }),
  // How many cards match the filter, from the actor's side, is at least `min` and at most `max` ("while you control at least
  // 5 Dwarf characters", "if there is at least 1 Gondor hero in play", "while you have no cards in your hand").
  z.strictObject({ kind: z.literal("count"), pick: pickSchema, min: z.number().int().min(0).optional(), max: z.number().int().min(0).optional() }),
  // Every card of `of` also matches `match`, and there is at least one ("if each hero you control has a printed Leadership
  // resource icon"; heroesAll is the Hobbit case).
  z.strictObject({ kind: z.literal("allMatch"), of: pickSchema, match: pickSchema }),
  // The actor's threat is at least `min` and at most `max` (Valour: 40 or higher; Secrecy: 20 or less). `valour` marks Valour's own
  // threshold (`min: 40`) or its complement (`max: 39`): both read 40 higher while the main quest has Dire (mec113.dire).
  z.strictObject({ kind: z.literal("threat"), min: z.number().int().min(0).optional(), max: z.number().int().min(0).optional(), valour: z.boolean().optional() }),
  // The source card, its host, the card the event was about, or the active location matches the filter (its zone is not
  // checked): "while ~ is committed to a quest", "if attached hero is a Dwarf", "if that enemy is an Orc".
  // `inPlay`: the card is in play now (`false`: it is not), for "if that ally is still in play".
  z.strictObject({
    kind: z.literal("matches"),
    // `previous`: the card picked before the last one ("if that copy was discarded", 146019:A:1).
    card: z.enum(["self", "host", "subject", "other", "activeLocation", "picked", "previous", "attacker", "defender"]),
    pick: pickSchema.optional(),
    inPlay: z.boolean().optional(),
    // The card is in a staging area now (`false`: it is not): "raise your threat by its Threat to engage that enemy" needs the enemy still there (142067:B:2).
    inStaging: z.boolean().optional(),
  }),
  // At most `max` other copies of the source card were played from the hand this round ("if this is the first time you
  // played a copy of ~ this round"); a card played again counts its earlier play. `you`: only the actor's plays count.
  z.strictObject({ kind: z.literal("copiesPlayedThisRound"), max: z.number().int().min(0), you: z.boolean().optional() }),
  // The actor's heroes with a resource icon that pays `sphere` (every player's, with `group`) hold at least `min` resources
  // ("the players as a group may spend 2 Leadership resources").
  z.strictObject({ kind: z.literal("resources"), min: z.number().int().positive(), sphere: z.enum(["leadership", "tactics", "spirit", "lore", "fellowship"]).optional(), group: z.boolean().optional() }),
  // The actor's quest succeeded this round (rr.step-3-4): "If you quest successfully this phase", read in the quest phase.
  // `committed`: and the source card was committed to it ("After Hirgon quests successfully").
  z.strictObject({ kind: z.literal("questSucceeded"), committed: z.boolean().optional() }),
  // The actor quested this round and the quest did not succeed ("If you quested unsuccessfully this round", 12169:A:2): the quest was resolved and the actor is not among the seats it succeeded for. False before the quest is resolved.
  z.strictObject({ kind: z.literal("questFailed") }),
  // Where the round is in its framework steps (rr.framework-steps): in the quest phase before the staging step, after it, or
  // before the quest is resolved; in the travel phase with no active location, so the players could travel (rr.step-4-2); in
  // the encounter phase after the engagement checks ("Play only after the staging step").
  z.strictObject({ kind: z.literal("step"), is: z.enum(["beforeStaging", "afterStaging", "beforeResolution", "canTravel", "afterEngagementChecks"]) }),
  // An enemy was engaged in this encounter phase (`is`), or none was (12065:A:2).
  z.strictObject({ kind: z.literal("engagedThisPhase"), is: z.boolean() }),
  // The current quest card has a printed keyword (`is`), or has none (17034:A:1).
  z.strictObject({ kind: z.literal("questKeywords"), is: z.boolean() }),
  // The current quest card has (`is`) or lacks the Battle / Siege keyword, printed or gained (hon.battle, hon.siege).
  z.strictObject({ kind: z.literal("questKeyword"), keyword: z.enum(["battle", "siege"]), is: z.boolean() }),
  // Where the combat phase is (rr.combat-phase): `beforeEnemyAttacks`, before the resolving enemy attacks step; `beforeAttacksResolve`,
  // after shadow cards have been dealt and before any attack has resolved; `afterEnemyAttacks`, once the resolving enemy attacks
  // step is complete.
  z.strictObject({ kind: z.literal("combatStep"), is: z.enum(["beforeEnemyAttacks", "beforeAttacksResolve", "afterEnemyAttacks"]) }),
  // The source is attached to the active location ("While attached location is the active location").
  z.strictObject({ kind: z.literal("hostActive") }),
  // The source enemy was dealt a shadow card and one of them has no shadow effect ("If Wargs is dealt a shadow card with no effect",
  // 01085:A:1). A card that was dealt none is not blank.
  z.strictObject({ kind: z.literal("shadowBlank") }),
  // The card is attacking in the player attack in progress (rr.step-6-8-4): read while a stat is read, for the stat's holder
  // (src/rules/families/attack/strike.ts); elsewhere for `card` (the source by default). `enemy`: the attacked enemy matches the filter
  // (from that card's controller's side: `engaged`, `stagingOnly`, then its predicates); `notEnemy`: it does not ("an enemy
  // not engaged with you"); `alone`: no other character attacks with it; `ranged`: it is a ranged attack (rr.ranged).
  z.strictObject({
    kind: z.literal("attacking"),
    card: z.enum(["self", "host", "subject"]).optional(),
    enemy: pickSchema.optional(),
    notEnemy: pickSchema.optional(),
    alone: z.boolean().optional(),
    ranged: z.boolean().optional(),
  }),
  // The characters the actor controls have at least `min` different Traits between them ("a total of at least 9 different Traits
  // between them", 17064:A:1).
  z.strictObject({ kind: z.literal("distinctTraits"), min: z.number().int().positive() }),
  // The actor engaged an enemy this round (`is`), or did not ("If you have not engaged an enemy this round", 08056:A:2).
  z.strictObject({ kind: z.literal("engagedThisRound"), is: z.boolean() }),
  // The burden deck holds at least `min` cards (1 by default): "shuffle the top card of the burden deck into the encounter deck".
  z.strictObject({ kind: z.literal("burdenDeck"), min: z.number().int().positive().optional() }),
  // The scenario is played in Campaign Mode, which is when its campaign card is in the game (rr.campaign-cards): "Use this
  // action only if you are playing campaign mode" (141062:A:1).
  z.strictObject({ kind: z.literal("campaign") }),
  // The Campaign Log marks this card upgraded (every box beside it is marked, dcce.scalable-upgradable): "If \"Gavin returned,\" put him into play" (11215:A:3). False in a game with no campaign facts.
  z.strictObject({ kind: z.literal("upgraded"), code: z.string().min(1) }),
  // The scenario is played in Campaign Mode and no card with this code is in play: the campaign's own copy of the card is outside the game, where an effect may put it into play from ("Put Spyglass into play", 11203:A:5, dcce.campaign-mode).
  z.strictObject({ kind: z.literal("campaignCopyOutside"), code: z.string().min(1) }),
  // The card DiscardBottom discarded in this effect has a printed cost of `max` or less ("If that card's printed cost is 2 or less", 11032:A:2); a card with no printed cost does not, and nothing
  // discarded does not. Read by the uncharted family (src/rules/families/uncharted/cards.ts).
  z.strictObject({ kind: z.literal("discardedCost"), max: z.number().int().min(0) }),
  // The running effect's X is at least `min`. The effect an attack leaves for its end has as X the number of characters the
  // attack destroyed ("If this attack destroys a character", 141065:A:2, 141066:A:2).
  z.strictObject({ kind: z.literal("x"), min: z.number().int().min(0) }),
  // The answered damaged event placed the source's `nth` damage token: it holds at least that many now and held fewer before ("After
  // placing the 6th damage here", 142024:A:3).
  z.strictObject({ kind: z.literal("damageReached"), nth: z.number().int().positive() }),
  // The current quest card holds at least `min` progress tokens ("While there are at least 8 progress tokens on this stage", 41007:B:1).
  z.strictObject({ kind: z.literal("stageProgress"), min: z.number().int().positive() }),
  // The running effect's X is at least the remaining hit points of the picked card (its hit points less its damage): "If the printed cost of the
  // discarded card is equal to or higher than the remaining hit points of the exhausted character" (41038:A:1). False with no picked card.
  z.strictObject({ kind: z.literal("xReachesRemaining") }),
  // The highest threat among the players is at most `max`: a campaign card's Resolution reads "the final threat of the player with the highest
  // threat: if it is under 40" (41051:B:1). An eliminated player's threat is raised to 50 (rr.scoring), so that player counts as 50.
  z.strictObject({ kind: z.literal("highestThreat"), max: z.number().int().min(0) }),
  // The cards facedown underneath The Havens Burn number at least `min` and at most `max` (dcce.aflame; "If there are X or more cards underneath The Havens Burn, ... X is 3 more than the
  // number of players", 11038:A:2 is `min: 3, players: true`; "2 or fewer cards are underneath", 11182:B:5 is `max: 2`). With `players`, both bounds count the number of players in the game
  // on top of what they name. Read by the aflame family (src/rules/families/aflame/values.ts).
  z.strictObject({ kind: z.literal("underBurn"), min: z.number().int().min(0).optional(), max: z.number().int().min(0).optional(), players: z.literal(true).optional() }),
  // The encounter discard pile (`discard`), or the encounter deck and its discard pile (`deckAndDiscard`), holds a card of this printed type and/or with the Aflame keyword: the either/or of a search
  // that has something to find ("search ... for the Aflame location", 11040:A:1; "the topmost enemy in the encounter discard pile", 11044:A:2; rr.effects). Read by the aflame family.
  z.strictObject({ kind: z.literal("encounterHas"), piles: z.enum(["discard", "deckAndDiscard"]), cardType: z.enum(["enemy", "location", "treachery"]).optional(), aflame: z.literal(true).optional() }),
  // A location in play with this trait has a total Threat of at least `min`, its grappled enemies' Threat included ("if the total Threat of any one Ship location is 9 or higher", 12041:B:2;
  // src/rules/families/grapple/values.ts).
  z.strictObject({ kind: z.literal("locationThreat"), trait: z.string().min(1), min: z.number().int().min(0) }),
  // The Corsair deck or its discard pile holds a card: Boarding has an enemy to reveal. The either/or of a card that gives a choice between a cost and Boarding ("raise your threat by 3 or it gains Boarding 1",
  // 12022:A:3) offers the Boarding branch only then (rr.effects: an option that cannot change the game state is not offered). Read by the stormcaller family.
  z.strictObject({ kind: z.literal("corsairHas") }),
  // The When Revealed effects of the source card are resolving now: a quest stage's side B holds from the moment it is revealed, but its text is not in force while side A's When Revealed is
  // ("Each Raider enemy revealed by the encounter deck enters play with 1 resource on it" does not reach the cards revealed by the stage's own When Revealed, 11037:B:2).
  z.strictObject({ kind: z.literal("revealing") }),
  // The current quest, read by the angmar family: `side` a side quest is the current quest ("If the current quest is a side quest", 09047:A:1), `self` the source is the side quest that is the current quest ("While Orc Rearguard is the current quest", 09023:A:2),
  // `other` there is a quest card besides the current one that may be chosen to be the current quest (09049:A:2: the main quest card, or an encounter side quest in the staging area).
  z.strictObject({ kind: z.literal("currentQuest"), is: z.enum(["side", "self", "other"]) }),
  // The total Willpower of the characters committed to the quest is greater than the total Threat in the staging area, as the quest would count them now ("If the total Willpower of characters committed to the quest is greater than the total Threat in the staging area", 09021:A:1; rr.step-3-4). Read by the angmar family.
  z.strictObject({ kind: z.literal("questLeads") }),
  // The pursuit value (mec112.pursuit, the pursuit tracker beside the quest deck) is at most `max` and at least `min`: "If the pursuit value is 25 or lower" (143071:B:1), "30 or greater" (143022:A:2). False while no tracker is set (ScenarioState.pursuit).
  z.strictObject({ kind: z.literal("pursuit"), max: z.number().int().min(0).optional(), min: z.number().int().min(0).optional() }),
  // The sole attacker: exactly one character was declared as an attacker in the attack in progress ("declared as the only attacker", 143015:A:3; rr.step-6-8b). Read by the attack family.
  // The encounter deck placed at least 1 progress on the current quest stage itself as the result of questing, in the quest resolution just made (the Defense keyword, mec112.defense):
  // progress the active location took does not count (143074:B:2). False while no quest has resolved under Defense. Read by the fortress family.
  z.strictObject({ kind: z.literal("encounterPlacedOnStage") }),
  // Some living player has no enemy engaged with them ("if any player is not engaged with an enemy", 143041:A:1). Read by the fortress family.
  z.strictObject({ kind: z.literal("playerUnengaged") }),
  // The active location prints a Wizardry line ("If no Wizardry effect is triggered this way", 143062:A:1, read with `not`; false with no active location). Read by the wizardry family.
  z.strictObject({ kind: z.literal("hasWizardry") }),
  z.strictObject({ kind: z.literal("soleAttacker") }),
  // The Captives in play (the Uruk-hai's heroes under To Isengard! or held by an enemy; src/rules/families/captives): at least `min` and at most `max` of them, or with `of: "actor"` only the acting seat's ("a seat with no Captive chooses one", 143069:A:1; "if there are no Captives in play", 143022:A:1).
  z.strictObject({ kind: z.literal("captives"), min: z.number().int().min(0).optional(), max: z.number().int().min(0).optional(), of: z.literal("actor").optional() }),
  // A Resolution's ChooseOption was answered with `option` (the first player's answer for the group, or any seat's when each player answers): "either each player earns one of the Skill boons ... or one player
  // earns Beyond All Hope" (143071:B:1). False until the option is chosen. Read by src/rules/families/campaign/resolution.ts.
  z.strictObject({ kind: z.literal("picked"), name: z.string().min(1), option: z.string().min(1) }),
  // Some living player's hand holds at least `min` and at most `max` cards: "If any player has 3 or fewer cards in his hand" (143081:B:1, `max: 3`), "3 or more" (`min: 3`).
  // With `every`: every living player's hand does ("each player holds at least 3 cards", the cost of 144070:B:2 paid by each hand; rr.cost).
  z.strictObject({ kind: z.literal("anyHand"), min: z.number().int().min(0).optional(), max: z.number().int().min(0).optional(), every: z.literal(true).optional() }),
]);

export const conditionSchema = z.discriminatedUnion("kind", [
  ...atomSchema.options,
  // The inner condition does not hold.
  z.strictObject({ kind: z.literal("not"), condition: atomSchema }),
  // Each inner condition holds.
  z.strictObject({ kind: z.literal("all"), conditions: z.array(atomSchema).min(1) }),
  // At least one inner condition holds.
  z.strictObject({ kind: z.literal("any"), conditions: z.array(atomSchema).min(1) }),
]);

// The conditions a stat modifier carries and checks each time the stat is read.

export type Condition = z.infer<typeof conditionSchema>;

export function isStatCondition(condition: Condition | undefined): condition is Extract<Condition, { kind: "versusHighEngagement" | "attacking" | "versusDefender" }> {
  return condition?.kind === "versusHighEngagement" || condition?.kind === "attacking" || condition?.kind === "versusDefender";
}

export const targetSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("self") }),
  z.strictObject({ kind: z.literal("host") }),
  // The last picked card, the card the answered event was about, the attacking enemy.
  z.strictObject({ kind: z.literal("picked") }),
  z.strictObject({ kind: z.literal("subject") }),
  z.strictObject({ kind: z.literal("attacker") }),
  z.strictObject({ kind: z.literal("activeLocation") }),
  // The card picked before the last ("discard that character" after the top card of the encounter deck was discarded, 142058:A:2).
  z.strictObject({ kind: z.literal("previous") }),
  // The second card the answered event names (the enemy a character attacked).
  z.strictObject({ kind: z.literal("other") }),
  z.strictObject({
    kind: z.literal("engagedEnemies"),
    trait: z.string().min(1).optional(),
    who: z.enum(["actor", "each"]),
    pick: z.enum(["all", "choose"]),
  }),
]);

export const when = { when: conditionSchema.optional() };
