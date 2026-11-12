// The vocabulary the Ered Mithrin campaign adds to effect records: the treasures the players find (emce.treasure), the boon allies
// who either join the Campaign Pool or are traded for a log line (emce.boon-allies), the encounter cards the pool holds
// (emce.campaign-pool-encounter), the cards a campaign card removes at Setup, and what several scenarios share: the Caves deck and Deep
// (emce.caves-deck, emce.deep), the Evil Creatures deck (emce.evil-creatures-deck), Discover X and Loot (emce.discover, emce.loot). Simple verbs; effect-schema-verbs.ts composes them.
// src/rules/families/wilderland/ runs them (the Resolution ones in src/rules/setup/resolution.ts, the Setup removal in src/campaign/checklist.ts).
// Guarded (enemy or location) on an objective (emce.guarded-x) is the objectives family's GuardObjective with `types`.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { ALLY_LINES } from "../ally-lines.ts";
import { cardRefSchema, pileNameSchema, positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const code = z.string().min(1);
// The decks beside the encounter deck (emce.caves-deck, emce.evil-creatures-deck; src/rules/core/piles.ts): the Caves deck, the Evil Creatures deck, and the two encounter sets Lost in Mirkwood sets aside.
const pile = pileNameSchema;

const VERBS = [
  // "Look at 3 random undiscovered treasures and attach 1 of them to ~ as a guarded objective" (12168:A:2, 12170:A, 12189:B:2): `count` treasures (3 by default) the log has not recorded and
  // the game has not dealt are drawn with the game's seed, the first player chooses one, and it enters the staging area attached to `to` (the source by default), which guards it
  // (rr.guarded, emce.treasure). The treasure is free of encounters when the guard leaves play; the players claim it then (ClaimObjective). The deal loads every treasure of the catalog for a record that names this verb.
  verbFlags(z.strictObject({ verb: z.literal("AttachRandomTreasure"), to: cardRefSchema.optional(), count: z.number().int().min(1).optional(), ...when }), { collection: "treasure" }),
  // Resolution: "The players discover each treasure they control" (every Ered Mithrin campaign card): each treasure a player controls, claimed and attached to a character, is written to the log's
  // discovered treasures. A treasure still guarded in the staging area is not controlled and is not discovered.
  z.strictObject({ verb: z.literal("DiscoverTreasure"), ...when }),
  // Resolution: "If the heroes choose to accept his aid, add Turayn to the campaign pool ... Otherwise, mark in the campaign log that 'Turayn has taken an oath of vigilance'" (12166 to 12188, emce.boon-allies).
  // The players choose between the two, the first player answering for the group; there is no default. `ally` joins the pool (any player may add it to their deck), or `line` is recorded.
  z.strictObject({ verb: z.literal("BoonAllyOrLogLine"), ally: code, line: z.enum(ALLY_LINES), ...when }),
  // Resolution: encounter cards join the Campaign Pool ("Add A Growing Threat and each Evil Creatures enemy in play to the campaign pool", 120165:B; emce.campaign-pool-encounter): one copy of each of `codes`,
  // or with `inPlay` one copy of a code for each card with that code in play that the pool did not deal into this game, or with `fromDeck` (not `codes`) one copy of each card dealt from that deck in play ("each Evil Creatures enemy in play",
  // a card of the deck whatever its code). The log tallies the copies, never past what one collection holds.
  z.strictObject({ verb: z.literal("AddEncounterToPool"), codes: z.array(code).min(1).optional(), fromDeck: z.literal("evilCreatures").optional(), inPlay: z.boolean().optional(), ...when }),
  // Resolution: cards leave the Campaign Pool. A record names exactly one of `codes` and `choice` (checked on the effect: src/catalog/effect-schema.ts). `codes` reaches only the encounter cards the pool tallies, not the pool's own cards: every copy of these encounter cards ("Remove A Growing Threat from the campaign pool", 12193:B). `choice: "eachPlayerNonBurden"`: each player in turn may
  // remove one card that is not a burden, a card of the pool or an encounter card the pool tallies ("Each player may remove a non-burden card from the campaign pool", 12187:B); a player may decline.
  z.strictObject({ verb: z.literal("RemoveFromPool"), codes: z.array(code).min(1).optional(), choice: z.literal("eachPlayerNonBurden").optional(), ...when }),
  // Campaign Setup: "If 'Turayn has taken an oath of vigilance,' search the encounter deck for 3 treacheries and remove them from the game" (12170:A, 12175:A, 12184:A, 12187:A, 12189:A, 12193:A, 12195:A).
  // When the log records `line`, the first player chooses up to `count` cards of `cardType` in the encounter deck, `nonUnique` ones only when it says so, none of the titles in `except`, and they are
  // removed from the game. The checklist asks for each choice (campaign/checklist.ts); the cards the deal builds are fewer by them.
  z.strictObject({ verb: z.literal("RemoveFromEncounterDeckIfLogged"), line: z.enum(ALLY_LINES), count: z.number().int().positive(), cardType: z.enum(["enemy", "location", "treachery"]), nonUnique: z.boolean().optional(), except: z.array(z.string().min(1)).optional() }),
  // Setup: "Create the Caves deck" / "Create the Evil Creatures deck" (emce.caves-deck, emce.evil-creatures-deck): the cards the scenario dealt to the deck are shuffled together with the game's seed. Run by the quest card's Setup, like PrepareUnchartedDeck.
  verbFlags(z.strictObject({ verb: z.literal("ShufflePile"), pile, ...when }), { setupRuns: "top" }),
  // "Shuffle Abandoned Ruin into the Caves deck" (12170:A, 12174:A:1): the copy of the card the game already has (dealt into the encounter deck, or set aside) joins the deck, which is shuffled; with no such deck it is removed from the game. A campaign card's Setup verb the engine resolves after the quest card's Setup shuffled the deck.
  // With `placed` (the campaign card's own line, 12170:A:2: the game has no such card in the pool) a copy the campaign card brings is spawned into a dealt pile; with no such pile it is not in the game.
  verbFlags(z.strictObject({ verb: z.literal("ShuffleIntoPile"), pile, code, placed: z.literal(true).optional(), ...when }), { setupRole: "afterSetup" }),
  // "Add the top card of the Evil Creatures deck to the staging area" / "Put the top card ... into play engaged with the first player" (18017:A, 18066:B, 18068:A; emce.evil-creatures-deck): `count` cards (1 by default) come off the top of the deck
  // into the staging area or engaged with the actor, the first player or each player (`who`, the actor by default; the staging area ignores it). A deck with a discard pile of its own (Evil Creatures) is refilled from it first when it is empty. The card enters play, and the last one added is the picked card of the running effect (a later AttachGuard or FlipOver reads it). With `attachSource`
  // the source card is attached to each card added ("Add the top card of the Evil Creatures deck to the staging area and attach Frenzied Creature to it", 18018:A:1); with no card to add it stays where it is.
  // `reveal`: the top card is revealed, not only added (rr.reveal; the Harad deck, 144068:B:1 "reveal the top facedown card from under The Cross-roads and add it to the staging area"): its Surge, Peril and When Revealed resolve, then it is staged or put into play engaged; one card, for the first seat the verb names.
  z.strictObject({ verb: z.literal("AddFromPile"), pile, to: z.enum(["staging", "engaged"]), count: positiveAmountSchema.optional(), who: z.enum(["actor", "firstPlayer", "eachSeat"]).optional(), attachSource: z.boolean().optional(), reveal: z.literal(true).optional(), ...when }).refine((verb) => verb.reveal !== true || (verb.count == null && verb.attachSource !== true && verb.who !== "eachSeat"), "AddFromPile reveal reveals one card for one seat: it takes no count, no attachSource and not who eachSeat"),
  // "Shuffle the Spiders of Mirkwood encounter set into the encounter deck" (18072:A): the cards of the set-aside deck join the encounter deck, which is shuffled, and the deck stays empty (emce.setup-lost-in-mirkwood).
  z.strictObject({ verb: z.literal("ShufflePileIntoEncounterDeck"), pile, ...when }),
  // Constant on a location, the Deep keyword (emce.deep; 18046:A, 19016:A): after the players travel to it and the Responses to the travel are done, they discard it and the top card of the Caves deck replaces it as the active location. Ignored with the Caves
  // deck empty, while the location is no longer the active location (unless its own Response added it to the victory display before the keyword, 18055:A:2), or while a card in play ignores the keyword (IgnoreKeyword). A location that is not a Deep location is not touched; the engine reads this record when the players travel (families/wilderland/deep.ts).
  z.strictObject({ verb: z.literal("Deep") }),
  // Constant on a card in play, usually the campaign card or the quest stage: "Ignore the deep keyword" / "Ignore the deep and discover keywords" (12187:A, 12195:A, 18080:B, 19023:B; emce.deep, emce.discover). While the card is in play the keywords
  // are not resolved: the scenario-level switch. It does nothing when run.
  z.strictObject({ verb: z.literal("IgnoreKeyword"), keywords: z.array(z.enum(["deep", "discover"])).min(1) }),
  // Forced on a location, trigger becameActive with subject self: the Discover X keyword (emce.discover; 19102:A, 19104:A, 19105:A). The first player looks at the top X cards of the encounter deck (the discard pile is shuffled into it when it holds fewer),
  // attaches one looked-at Loot objective to the active location as a guarded objective (the first player chooses among several), reveals a random looked-at card with the Hazard trait, and puts the rest in the encounter discard pile. Ignored while a card in play ignores the keyword.
  // `afterTravel` is engine use: the keyword the travel step held back to resolve once the Responses to the travel are done (families/wilderland/discover.ts, so a Response such as Crypt Key's, 19094:A:3, comes before it).
  z.strictObject({ verb: z.literal("Discover"), amount: positiveAmountSchema, afterTravel: z.literal(true).optional(), ...when }),
  // Constant on an objective, the Loot keyword (emce.loot; 19094:A, 19095:A, 19096:A): the card enters play only through the Discover keyword. One revealed from the encounter deck is discarded and another card is revealed (windows/frames.ts startReveal).
  z.strictObject({ verb: z.literal("Loot") }),
  // Constant on an objective: "The first player gains control of Haldan while he is free of encounters" (18070:A:1; rr.guarded). The objective stays in the staging area under its guard; once none is attached to it, it enters the first player's play area,
  // controlled by them (families/wilderland/control.ts). With `claim` gaining control is a claim (rr.objective-cards: "If a player claims an objective, then that player gains control of that objective", 19054:A:2) and `claimed` is announced. It does nothing when run.
  z.strictObject({ verb: z.literal("GainControlWhenFree"), who: z.literal("firstPlayer"), claim: z.literal(true).optional() }),
  // A marker in a record of a card that lies in a hand: "Cannot be discarded by player card effects" (18026:A:1). A pick from a hand that a player card makes leaves the card out; an encounter card's effect still discards it. It does nothing when run.
  z.strictObject({ verb: z.literal("Undiscardable") }),
  // "The players look at 3 random undiscovered treasures and choose 1 to attach to an eligible character" (120165:A:3; emce.treasure): `count` treasures (3 by default) the log has not recorded and the game has not dealt are drawn with the game's
  // seed and the first player chooses one. It is the picked card of the running effect, set aside until a later Pick of a card it may attach to (`hostForPicked`) and AttachPicked put it on that character: the players claim it, announced as `claimed`.
  // The deal loads every treasure of the catalog for a record that names this verb.
  verbFlags(z.strictObject({ verb: z.literal("ClaimRandomTreasure"), count: z.number().int().min(1).optional(), ...when }), { collection: "treasure" }),
  // "Set aside the topmost non-unique, non-objective, non-burden encounter card in the encounter discard pile. During quest resolution, add a copy of that card to the campaign pool, if able" (12167:A:2; emce.campaign-pool-encounter):
  // the topmost card of the encounter discard pile that is none of the `exclude` kinds is set aside, and the Resolution adds a copy of it to the pool (the log keeps no more copies than one collection holds). Nothing happens when no card qualifies.
  z.strictObject({ verb: z.literal("SetAsideDiscardForPool"), exclude: z.array(z.enum(["unique", "objective", "burden"])), ...when }),
  // "Flip over Woodmen Village and attach Haldan to the just-added enemy as a guarded objective" (18069:A:2): the source card, wherever it lies, shows the card `into` and enters the staging area, faceup; with `guardedBy` the picked card (the enemy the last
  // AddFromPile added) guards it (rr.guarded). The old side is kept as the card's other side.
  z.strictObject({ verb: z.literal("FlipOver"), into: code, guardedBy: z.literal("picked").optional(), ...when }),
  // "The player with the most cards in his hand without a copy of Lost in the Wild adds Lost in the Wild to his hand" (18026:A:1): of the players with no card of the source's title in hand, the one with the most cards in hand takes the source into
  // their hand (the first player chooses among players tied). Nothing happens when every player holds a copy.
  z.strictObject({ verb: z.literal("AddSourceToHandOfMost"), ...when }),
  // Lost in Mirkwood's Objective-Locations (18029 to 18032:A:3, "advance to the next stage A, if able"): the quest advances to the stage of the next number with this letter (A is the first of its level, C the second). `levels` lists the quest's stages by number, each level its
  // A stage and its C stage (18071 | 18072, 18073 | 18074, 18075 | 18076, 18077). With no such stage (the last level) nothing happens. The stage left is defeated and the new one is revealed, as AdvanceToStage does.
  z.strictObject({ verb: z.literal("AdvanceToLetterStage"), letter: z.enum(["A", "C"]), levels: z.array(z.array(z.string().min(1)).min(1).max(2)).min(2), ...when }),
  // Quest Setup: "The first player takes control of Haldan" (18071:A:1; emce.haldan): the set-aside card with this code enters the first player's play area, faceup and ready. The card was dealt set aside by the scenario's piles; this is the stage's own Setup, run once the piles are placed.
  verbFlags(z.strictObject({ verb: z.literal("TakeControlOfSetAside"), code }), { setupRuns: "top" }),
  // Campaign Setup: "The first player may search the encounter deck for a copy of Twilight Hall and add it to the staging area. If they do, the players look at 3 random undiscovered treasures and attach 1 of them to Twilight Hall as a guarded objective"
  // (12168:A:2): once the quest card's Setup has run, the first player chooses whether to search the encounter deck and its discard pile for a copy of `code`; if they search and one is found it is added to the staging area and AttachRandomTreasure
  // guards a treasure with it. No copy to find, or a refusal, changes nothing.
  verbFlags(z.strictObject({ verb: z.literal("SearchGuardForTreasure"), code, count: z.number().int().min(1).optional(), ...when }), { setupRole: "afterSetup", collection: "treasure" }),
  // Resolution: "Discard cards from the encounter deck until X cards from either the Spiders of Mirkwood or Dol Guldur Orcs encounter set have been discarded and add those cards to the campaign pool" (12168:B:3; emce.campaign-pool-encounter): cards come off the top of the encounter deck
  // into the encounter discard pile until `count` of them belong to one of `sets`, or the deck is empty; each of those goes to the pool (the log keeps no more copies than one collection holds). Run by the Resolution (src/rules/setup/resolution.ts).
  z.strictObject({ verb: z.literal("DiscardToPoolFromSets"), sets: z.array(z.string().min(1)).min(1), count: positiveAmountSchema, ...when }),
  // "The first Spider enemy revealed each quest phase gains surge" (18072:B:1, 18073:B:1): the card the answered `encounterRevealed` event is about gains surge, as if it printed the keyword (rr.surge). A Forced effect of a quest stage with a limit of once per phase.
  z.strictObject({ verb: z.literal("GrantSurgeToSubject"), ...when }),
  // A constant marker beside the flag progressDiscards on Searching for a Way Out (18028:A:2): after the cards that progress was turned into are discarded, the topmost Objective-Location in the encounter discard pile enters play (the staging area, its Guarded keyword resolved). It does nothing when run.
  z.strictObject({ verb: z.literal("PutObjectiveLocationAfterDiscard") }),
  // Carried Away (18074:A:1): "Each player chooses a hero he controls, discards each token and attachment from that hero, and places it in the staging area ... attaches that enemy to the hero he owns in the staging area, guarding it." After a Pick of the hero, a DiscardUntil enemy and a
  // MoveEncounterCard of that enemy to the staging area, the hero (the card picked before the last) loses its tokens and attachments and lies facedown under the enemy (the captive zone: in play, controlled by no one), flagged as guarded; the enemy guards it (guardsHero). Nothing happens when no enemy was found.
  z.strictObject({ verb: z.literal("CarryAwayHero"), ...when }),
  // Carried Away (18074:B:2): "When an enemy guarding a hero is defeated, return that hero to its owner's control, exhausted." (user ruling, 2026-11-05: when it leaves play in any way) The hero the event's subject (the enemy) guarded comes back among its owner's heroes, faceup and exhausted.
  z.strictObject({ verb: z.literal("ReleaseGuardedHero"), ...when }),
  // Carried Away (18074:B:3): "When the players advance from this stage, discard each guarded hero." Each hero an enemy guards goes to its owner's discard pile; a player left with no hero is eliminated (rr.player-elimination).
  z.strictObject({ verb: z.literal("DiscardGuardedHeroes"), ...when }),
  // Truly Lost (18075:A:1): "Each player places his hand of cards facedown under a different location in the staging area." The actor chooses a location in the staging area (an Objective-Location is one) that no player has put a hand under yet, and every card of their hand goes facedown under it, still theirs.
  // With an empty hand nothing is chosen.
  z.strictObject({ verb: z.literal("PlaceHandUnderLocation"), ...when }),
  // Truly Lost (18075:B:2): "return each facedown player card under that location to its owner's hand." The location the event is about (the subject; it has been explored and left play).
  z.strictObject({ verb: z.literal("ReturnFacedownToHands"), ...when }),
  // Truly Lost (18075:B:3): "When the players advance from this stage, discard each facedown player card under each location." Each facedown player card under a location goes to its owner's discard pile.
  z.strictObject({ verb: z.literal("DiscardFacedownUnder"), ...when }),
  // The Forest of Great Fear (18076:A:1): "Search the remaining set-aside encounter set for the enemy with the most hit points and add it to the staging area. That enemy is the 'nemesis' until it leaves play." Of the enemies in the Spiders of Mirkwood and Dol Guldur Orcs
  // piles that are still set aside, the one with the most printed hit points (the first player chooses among a tie) enters the staging area, flagged as the nemesis (the pick field nemesis). Nothing happens with both piles used.
  z.strictObject({ verb: z.literal("SearchNemesis"), ...when }),
  // The Forest of Great Fear (18076:B:2): "return the nemesis to the staging area and it makes an attack against the first player." An engaged nemesis goes back to the staging area; it then attacks the first player (a shadow card is dealt for the attack, as AttackFirstPlayer does).
  z.strictObject({ verb: z.literal("NemesisAttacks"), ...when }),
  // The King's Quest (part 3, campaign card 12170; ledger lines 12170:A:2, 12172:A:1, 18078:A:1, 18078:B:1, 18079:A:1, 18079:B:2, 18080:A:1, 18080:B:2, 18055:A:2, 18045:A:2, 18043:A:3, 18048:A:1, 18050:A:2, 12173:A:2).
  // "Add The Threat to Wilderland to the staging area with X resources on it" (12170:A:2, 12172:A:1): the card enters the staging area with `amount` resource tokens on it. On the campaign card's Setup it is spawned; on the card's own Setup (a copy of the pool the Setup search found) that copy is placed.
  verbFlags(z.strictObject({ verb: z.literal("AddToStagingWithResources"), code, amount: positiveAmountSchema, ...when }), { setupRole: "dealt" }),
  // "Discard Contested Depths and replace it with the top card of the Caves deck" (18045:A:2): the source, the active location, is discarded and the top card of the Caves deck takes its place, as the Deep keyword does (emce.deep), but not ignored by a card that ignores the keyword. Nothing happens with the Caves deck empty.
  z.strictObject({ verb: z.literal("ReplaceFromCaves"), ...when }),
  // "Look at the top 2 cards of the Caves deck. Put one on top of the Caves deck and put the other on the bottom" (18055:A:2, 18079:B:2): the first player chooses the card that stays on top of the `count` looked at; the rest go to the bottom of the deck, in their order. With fewer than 2 cards in the deck nothing changes.
  z.strictObject({ verb: z.literal("ArrangeCaves"), count: z.number().int().min(2), ...when }),
  // "Place Dragon Hoard on the bottom of the Caves deck" (18079:A:1): the set-aside (or encounter deck) card with this code goes to the bottom of the pile, facedown. A game with no such pile dealt, or no such card, changes nothing.
  z.strictObject({ verb: z.literal("PutOnPileBottom"), pile, code, ...when }),
  // "Attach to a questing hero" (18048:A:1): the source card is attached to the last picked card (a Pick of a committed hero comes first).
  z.strictObject({ verb: z.literal("AttachSelfToPicked"), ...when }),
  // "Search the encounter deck and discard pile for a Dragon treachery and attach it to Fire-drake, if able" (18080:A:1): the first player chooses a card of the type and trait in the encounter deck or its discard pile (one of each title) that the enemy named `to` does not carry yet, and it is attached to that enemy in play. The deck is shuffled by the instruction after it. `name`: only a card with this title ("a Fell Beast", 145077:A:1).
  z.strictObject({ verb: z.literal("AttachSearched"), type: z.enum(["treachery"]), trait: z.string().min(1), to: z.string().min(1), name: z.string().min(1).optional(), ...when }),
  // "The first player chooses a player to attach an Artifact attachment from his hand to Dragon Hoard. That attachment gains the guarded (location) keyword" (18043:A:3): the last picked card of a hand is guarded by a location of the encounter deck, found as the Guarded (location) keyword does (emce.guarded-x), and lies in the staging area; once nothing guards it the players claim it, the first player choosing the character it attaches to, as for a treasure. With no location to find it is claimed at once.
  z.strictObject({ verb: z.literal("GuardPickedAttachment"), types: z.array(z.enum(["enemy", "location"])).min(1), ...when }),
  // "The first player attaches the top card of his deck to Hobgoblin faceup as a guarded attachment" (18050:A:2): the first player's top deck card lies faceup under the source, which guards it (cardsUnder). Nothing happens with an empty deck.
  z.strictObject({ verb: z.literal("GuardWithDeckTop"), ...when }),
  // A marker on Hobgoblin (18050:A:2, its Forced record on leftPlay): "When Hobgoblin leaves play, return the card it was guarding to its owner's hand". An enemy leaving play queues no event, so the settle sweep returns a card held under an enemy that is out of play (families/wilderland/kings.ts returnHeld). It does nothing when run.
  z.strictObject({ verb: z.literal("ReturnGuardedToHand") }),
  // "Cancel the attack" (18080:B:2): the player attack in progress deals no damage; its attackers stay exhausted. Run in the response to enemyAttacked, which resolves before the attack's strength is read.
  z.strictObject({ verb: z.literal("CancelStrike"), ...when }),
  // The Withered Heath (part 4, campaign card 12175; ledger lines 12175:A:2, 12175:B:7, 19012:A:3, 19015:A:1, 19018:A:1, 19022:A:1, 19022:B:1, 19024:A:1, 19024:B:2, 12176:A:4, 12179:A:4).
  // "Shuffle 2 set aside Dragon Sign objectives into the Caves deck" (19022:A:1, 19024:A:1): up to `count` set-aside copies of the card join the pile, which is shuffled with the game's seed. A game that dealt no such pile, or has no copy set aside, changes nothing.
  z.strictObject({ verb: z.literal("ShuffleSetAsideIntoPile"), pile, code, count: z.number().int().positive(), ...when }),
  // "Remove 3 damage tokens from the set-aside Cold-Drake" (19024:B:2): up to `amount` damage tokens come off the set-aside card with this code (no card in play has the damage: moria's RemoveDamageFrom reaches only a card in play).
  z.strictObject({ verb: z.literal("RemoveSetAsideDamage"), code, amount: z.number().int().positive(), ...when }),
  // "Search the Caves deck for a Dragon Sign and attach it to Creature Den as a guarded objective. Shuffle the Caves deck." (19018:A:1): the first card of the pile with this code enters the staging area (added to it from out of play) and the source card, in play as the active location,
  // becomes its guard (rr.guarded, as AttachRandomTreasure guards a treasure). The Dragon Sign is free of encounters once the source leaves play. With no such card in the pile nothing changes. The shuffle is the record's (ShufflePile).
  z.strictObject({ verb: z.literal("AttachGuardedFromPile"), pile, code, ...when }),
  // A constant marker on an objective: "When Dragon Sign is free of encounters, add it to the victory display" (19012:A:3). The settle sweep moves a card with it in the staging area to the victory display once nothing guards it (families/wilderland/heath.ts). It does nothing when run.
  z.strictObject({ verb: z.literal("VictoryWhenFree") }),
  // A constant marker, in play under the record's own condition: "While Mountain Pass is in the staging area, the 'when revealed' effects of Weather treachery cards cannot be canceled" (19015:A:1). A Response that cancels the When Revealed effects of an encounter card
  // with the trait is not offered while the marker's source is in play and its record holds (rr.cancel, families/wilderland/heath.ts). With `cardType` the effects of treachery cards ("The 'when revealed' effects of treachery cards cannot be canceled", 19048:B:1). It does nothing when run.
  // With `firstRevealedEachRound`, only the first treachery revealed each round ("The 'when revealed' effects of the first treachery revealed each round cannot be canceled", 19137:B:1).
  z.strictObject({ verb: z.literal("UncancelableWhenRevealed"), trait: z.string().min(1).optional(), cardType: z.literal("treachery").optional(), firstRevealedEachRound: z.literal(true).optional() }),
  // "Look at the top 3 cards of the encounter deck. Reveal 1 of those cards and discard the rest" (19022:B:1, 19024:B:1): after LookAtTop and a PickEncounter of one looked card, the other looked cards that are still on top go to the encounter discard pile faceup; the picked card is then the top card, and the
  // RevealEncounter after it reveals it. The discard comes first, a deliberate order as Discover's (emce.discover): a Surge on the revealed card reveals the next card of the deck, not one of the looked ones.
  z.strictObject({ verb: z.literal("DiscardOtherLooked"), ...when }),
  // "They put 1 of those cards on the top of their deck and put the rest on the bottom of their deck in any order" (12176:A:4): the actor (the player whose deck was looked at, after SwitchActor) chooses which of the `top` cards LookAtTop showed stays on top, then the card for each next place
  // among the others from the top of what goes to the bottom; the bottom cards keep the order they are chosen in. One card or none looked at changes nothing. `kept` and `bottom` are engine use: the choices so far.
  z.strictObject({ verb: z.literal("ArrangeLookedDeck"), kept: z.string().optional(), bottom: z.array(z.string()).optional(), ...when }),
  // "...it makes an immediate attack against you" (12179:A:4): the card the answered event is about (`target`, the subject by default), an enemy engaged with the actor, makes an immediate attack against them, dealt a shadow card of its own as any attack an effect makes is.
  // Nothing happens when it is not engaged or may not attack.
  z.strictObject({ verb: z.literal("ImmediateAttackBy"), target: cardRefSchema.optional(), ...when }),
  // "For each ready character a player controls, he must choose: either exhaust that character, or deal 1 damage to it" (19021:A:1): the actor, run for each player in turn, is asked once for each ready character they control, in the order they entered play,
  // whether it is exhausted or takes `amount` damage. The characters are those ready when the verb starts.
  // With `or: "threat"` the other choice is to raise their threat by `amount` ("either exhaust that character or raise his threat by 1", 19045:A:1).
  z.strictObject({ verb: z.literal("ExhaustOrDamageEachReady"), amount: z.number().int().positive(), or: z.enum(["damage", "threat"]).optional(), ...when }),
  // Campaign Setup: "A player may search their deck for a unique boon ally and add it to their hand" (12175:A:2). Each player in turn, the first player first, may take a unique boon ally of their deck (a pool ally the checklist is about to shuffle into it is in the deck already) into their starting hand, or decline;
  // the offer ends with the first who takes one. Dealt by the checklist (campaign/checklist.ts), so it changes nothing here.
  z.strictObject({ verb: z.literal("SearchBoonAllyToHand") }),
  // Campaign Setup: "If 'Melanwar has given you guidance on traversing Wilderland,' search ... the Caves deck for 1 location and remove them from the game" (12175:A:2). As RemoveFromEncounterDeckIfLogged, but from the Caves deck the scenario deals (emce.caves-deck): the first player
  // chooses up to `count` cards of `cardType` and they are removed from the game. Dealt by the checklist, so it changes nothing here.
  z.strictObject({ verb: z.literal("RemoveFromCavesIfLogged"), line: z.enum(ALLY_LINES), count: z.number().int().positive(), cardType: z.enum(["enemy", "location", "treachery"]), nonUnique: z.boolean().optional() }),
  // Resolution: "the players also look at 3 random undiscovered treasures and choose 1 to attach to an eligible character" (12175:B:7; emce.treasure): `count` (3) undiscovered treasures are drawn with the game's seed and the first player chooses one. The scenario is over, so the
  // attachment has no game left to matter in: the treasure joins the discovered ones the Resolution writes (the line after it, DiscoverTreasure, would write a treasure the players control). Run by the Resolution (rules/setup/resolution.ts).
  verbFlags(z.strictObject({ verb: z.literal("ChooseRandomTreasure"), count: z.number().int().min(1).optional(), ...when }), { collection: "treasure" }),
  // Roam Across Rhovanion (part 5, campaign card 12184; ledger lines 12184:A:2, 12184:B:1, 12184:B:3, 12184:B:4, 19036:A:1, 19037:A:1, 19044:A:1, 19047:B:2, 19048:B:2, 19051:A:1).
  // "Advance to a random stage 2A, if able. Otherwise, advance to stage 3A" (19047:B:2, 19048:B:2, 19049:B:2, 19050:B:2): the quest card names the stages it proceeds to, each played once in a random order (the game's seed): one of `codes` still in the quest deck, else `otherwise`; with `remove` the stage defeated
  // is removed from the game. The scenario definition copies it onto the stage (`stages[i].randomNext`) and the quest takes it when the stage is defeated, so run on a stage that was defeated it does nothing; run on the stage the quest is at (19047:B:2's Forced effect) it advances the quest at once.
  z.strictObject({ verb: z.literal("AdvanceToRandomStage"), codes: z.array(code).min(2), otherwise: code.optional(), remove: z.literal(true).optional() }),
  // "The first player loses control of both Urdug and Tiny, flips them to their enemy sides, and adds them to the staging area. (Remove any damage that was on them.)" (19051:A:1): the card in play with this code becomes the card `into`, faceup and ready in the staging area, controlled by no one,
  // with no damage; it keeps its resource tokens and its attachments. Nothing happens when no such card is in play.
  z.strictObject({ verb: z.literal("FlipToEnemySide"), code, into: code, ...when }),
  // "The first player may put their trust in Urdug by placing a resource on him (from the token pool). If they don't, shuffle a copy of the Urdug's Cunning burden into the encounter deck" (12184:A:2, 12184:B:1): the first player chooses to place a resource on the card in play with the code `code`, or a copy of `burden`
  // is shuffled into the encounter deck. Run in Campaign Setup after the quest card's Setup (Urdug comes into play there), and as a Forced effect of the campaign card.
  verbFlags(z.strictObject({ verb: z.literal("PutTrust"), code, burden: code, ...when }), { setupRole: "afterSetup" }),
  // A constant marker on an objective: "While Durin's Key is free of encounters, the first player attaches it to a hero he controls" (19036:A:1), "While Urdug's Horn is free of encounters, attach it to Urdug" (19037:A:1). The settle sweep claims a card with it in the staging area once nothing guards it
  // (families/wilderland/rhovanion.ts): the first player chooses one of their heroes, or with `host` the card in play with that title is the host. The claim is announced as `claimed`. It does nothing when run.
  z.strictObject({ verb: z.literal("ClaimWhenFree"), host: z.string().min(1).optional() }),
  // "The first player loses control of Urdug, then attach Urdug to a location in the staging area as a guarded objective" (19044:A:1): the card in play with this code goes back to the staging area, controlled by no one, guarded by the last picked card (a location in the staging area). Nothing happens when no such card is
  // in play or nothing is picked.
  z.strictObject({ verb: z.literal("GuardReturnedBy"), code, ...when }),
  // Resolution: "Each player chooses a location in the staging area and adds a copy of it to the campaign pool. Players must choose different locations, if able" (12184:B:4): each player in turn, the first player first, chooses a location (by title) in the staging area that no earlier player chose, unless
  // every title is taken; a copy of each joins the Campaign Pool's encounter cards (never more than one collection holds). A burden location (Abandoned Ruin) is not offered: it joins the pool as a burden. Run by the Resolution (rules/setup/resolution.ts).
  z.strictObject({ verb: z.literal("ChooseStagedLocationForPool"), ...when }),
  // Fire in the Night (part 6, campaign card 12187; ledger lines 19066:A:2, 19083:B:1, 12188:A:1; emce.side-quests, emce.side-quests-in-play).
  // "Reveal the top card of the side quest deck and add it to the staging area" (19083:B:1): the top card of the side quest deck is revealed as an encounter card by the actor, its When Revealed effects resolve, and it lies in the staging area. A side quest's When Revealed
  // effects cannot be canceled (emce.side-quests). Nothing happens with an empty deck, or in a game that dealt none.
  z.strictObject({ verb: z.literal("RevealSideQuest"), ...when }),
  // "Dagnir makes an attack against Hrogar's Hill. Do not deal a shadow card for this attack. The first player may declare a defender for this attack. Excess damage must be dealt to Hrogar's Hill." (19083:B:1): the last picked enemy, in the staging area, attacks the main quest card. The first player is the
  // defending player: they may declare a defender (a character they control, or a Sentinel) or leave it undefended; the whole undefended damage, and the damage beyond a defender's remaining hit points, is dealt to the quest card. No shadow card is dealt. It does not use up the enemy's attack of the combat phase.
  z.strictObject({ verb: z.literal("AttackStage"), ...when }),
  // "Excess damage from this attack must be dealt to Hrogar's Hill" (19080:A:3, a Shadow effect): the damage the attack in progress deals beyond its defender's remaining hit points goes on the main quest card. Nothing happens outside an attack.
  z.strictObject({ verb: z.literal("ExcessToStage"), ...when }),
  // Engine use, the first player's question at the beginning of the quest phase (emce.side-quests-in-play): the side quest `card` (a card id, never written in a record) is the current quest until the end of the phase. A card that is not a side quest in the staging area changes nothing.
  z.strictObject({ verb: z.literal("MakeCurrentQuest"), card: z.string().min(1) }),
  // "Mark a use in the campaign log" (12188:A:1): the actor's box beside Beldis is marked (the log's four boxes for each player, emce.campaign-log). The Action's condition `beldisBox` says one is left. The log keeps it when the scenario is won.
  z.strictObject({ verb: z.literal("MarkBeldisUse") }),
  // The Ghost of Framsburg (part 7, campaign card 12189; ledger lines 12189:B:6, 19101:A:2, 19106:A:1, 12191:A:1; emce.discover, emce.loot, emce.campaign-pool-encounter).
  // "Each player resolves the Discover keyword of the active location in turn order" (19106:A:1): the actor, for the player in the keyword's first player, resolves the Discover keyword of the active location (its Discover value, with any adjustment): looks at the top cards, chooses a Loot objective to guard the location,
  // reveals a random Hazard and discards the rest, exactly as emce.discover says. Nothing happens when the active location has no Discover keyword, or the keyword is ignored (the condition `discoverUnavailable` tells).
  z.strictObject({ verb: z.literal("ResolveDiscover"), ...when }),
  // "Then, attach a Loot objective in the encounter discard pile to that enemy as a guarded objective" (19101:A:2): after a DiscardUntil and a MoveEncounterCard put the enemy in the staging area, a Loot objective of the encounter discard pile (the first player chooses among several) is added to the staging area
  // and the picked enemy guards it (rr.guarded). Nothing happens when no enemy was found or no Loot objective is in the discard pile.
  z.strictObject({ verb: z.literal("AttachLootFromDiscard"), ...when }),
  // Resolution: "Shuffle the encounter discard pile into the encounter deck and discard cards from the top until 2 Hazard cards are discarded. The players, as a group, must choose 1 of those cards and add it to the campaign pool" (12189:B:6; emce.campaign-pool-encounter): the discard
  // pile is shuffled in, cards come off the top into the discard pile until `count` Hazard cards are among them (or the deck is empty), and the first player chooses for the group one of those Hazard cards: an encounter card joins the Campaign Pool's encounter cards, a burden joins the pool as a burden.
  // Run by the Resolution (rules/setup/resolution.ts).
  z.strictObject({ verb: z.literal("ChooseHazardForPool"), count: z.number().int().min(1), ...when }),
  // Mount Gundabad (part 8, campaign card 12193; emce.gundabad-quest-deck, emce.bypassing). A constant marker on side A of each Exploring Gundabad stage 2: "If Exploring Gundabad is the current main quest, do not flip it over until the beginning of
  // the quest phase" (19135:A:2). The scenario definition copies it onto the stage (`stages[i].deck`): the quest is ordered by its quest deck, a stage arrives with side A up, the stage defeated goes to the victory display and the quest advances to the top
  // stage of the deck (rules/families/quest/order.ts). Run alone it does nothing.
  z.strictObject({ verb: z.literal("FlipAtQuestPhase") }),
  // "At the beginning of the quest phase" the current quest card shows side B (emce.gundabad-quest-deck). A stage that already shows side B changes nothing.
  z.strictObject({ verb: z.literal("FlipCurrentQuest"), ...when }),
  // "The players may bypass this stage" (19135:B:3; emce.bypassing): the source stage loses all its progress and goes to the bottom of the quest deck with side A up, and the top stage of the quest deck is revealed, its When Revealed effects resolving. Nothing happens
  // when the quest deck holds no other stage. A bypassed stage is not defeated: the Forced effects of "when this stage is defeated" do not hear it.
  z.strictObject({ verb: z.literal("BypassStage"), ...when }),
  // "Search the quest deck for a quest card and make it the current main quest. Then, flip it over. Shuffle the rest of the quest deck" (19124:A:1): the actor chooses a stage of the quest deck, it becomes the current quest in place of the stage now current (which goes back into
  // the quest deck with no progress, side A up, as a bypassed stage does), it is revealed and shows side B at once, and the quest deck is shuffled.
  z.strictObject({ verb: z.literal("SearchQuestDeck"), ...when }),
  // "Flip Wormsbane to its Reforged side" (19122:A:3): the card in play with the code `code` shows its other side `into`, staying where it lies with its tokens and attachments (the old side is kept as the card's other side).
  // With `attachTo: "picked"` it then moves to the hero last picked, leaving the card it was attached to.
  z.strictObject({ verb: z.literal("FlipInPlace"), code, into: code, attachTo: z.literal("picked").optional(), ...when }),
  // "Search the Caves deck for a location and make it the active location. Shuffle the Caves deck" (19137:B:2): the actor chooses a card of the Caves deck, which becomes the active location (the one active now returns to the staging area) and hears that it did. The shuffle is the record's (ShufflePile).
  // Nothing happens with the Caves deck empty.
  z.strictObject({ verb: z.literal("ActivateFromCaves"), ...when }),
  // "Add a random enemy discarded this way to the staging area" (19138:B:1): after a DiscardEncounterTop, one of the cards it discarded that is still in the encounter discard pile and is of `type`, chosen with the game's seed, enters the staging area.
  z.strictObject({ verb: z.literal("StageRandomDiscarded"), type: z.literal("enemy"), ...when }),
  // "Attach all unguarded treasures in play to that character" (12194:A:2): every treasure in play with nothing guarding it, attached to a character or lying in the staging area, is attached to the character the source card is attached to, leaving the card it was on.
  z.strictObject({ verb: z.literal("AttachTreasuresToHost"), ...when }),
  // A constant of a card in play: "Each player cannot play more than 1 card each phase" (19140:B:1). A player who has played `max` cards in the phase (the plays state.played records) may play no more; a card put into play is not played.
  z.strictObject({ verb: z.literal("LimitPlaysPerPhase"), max: z.number().int().min(1) }),
  // The Fate of Wilderland (part 9, campaign card 12195; ledger lines 12195:A:2, 19155 to 19170).
  // Campaign Setup: "Each player may search their deck for a boon or treasure card and add it to their hand" (12195:A:2). Each player in turn may take a boon or a treasure card of their deck (a pool card the checklist is about to shuffle into it is in the deck already) into their
  // starting hand, or decline; every player is asked, unlike the search for a boon ally. Dealt by the checklist (campaign/checklist.ts), so it changes nothing here.
  z.strictObject({ verb: z.literal("SearchBoonOrTreasureToHand") }),
  // "Search the encounter deck, discard pile, and victory display for a Goblin Troop and add it to the staging area" (19161:A:3): the card with this code in any of the three is added to the staging area, entering play there. Nothing happens when none is left.
  z.strictObject({ verb: z.literal("SearchStageCard"), code, ...when }),
  // "Add each enemy discarded by this effect to the staging area" (19162:A:2): every card of `type` that the effect's DiscardEncounterTop discarded and that is still in the encounter discard pile enters the staging area, in the order they were discarded.
  z.strictObject({ verb: z.literal("StageDiscarded"), type: z.literal("enemy"), ...when }),
  // "Remove 1 progress from The Goblins' Assault" (19163:A:2): progress comes off the card in play with this title, at most as much as it holds.
  z.strictObject({ verb: z.literal("RemoveProgressFrom"), amount: positiveAmountSchema, named: z.string().min(1), ...when }),
] as const;

const TRIGGERS = [
  // About a side quest: it became the current quest at the beginning of the quest phase ("After Draw Her Fire becomes the current quest", 19066:A:2; emce.side-quests-in-play).
  "becameCurrentQuest",
  // About a location: its Discover keyword was just resolved (emce.discover). The event's amount is 1 when a Hazard card was revealed by it, else 0 ("After resolving the Discover keyword on Hidden Staircase", 19103:A:3).
  "discovered",
] as const;
const FLAGS = [
  // On a character: the next damage it would be dealt cancels this many points of it, and the flag is spent ("The next time that character would be dealt damage this round, cancel 1 of that damage", 12166:A:2). Set with a ModifyStat that lasts
  // until the end of the round or the phase; src/rules/families/wilderland/shield.ts takes it as damage is placed.
  "damageShield",
  // On an enemy: the damage it would be dealt is canceled and the card that granted the flag (Dragon Scales, 18059:A:2) is discarded. Set by a constant ModifyStat of the attachment; src/rules/families/wilderland/shield.ts cancelAllDamage takes it as damage is placed.
  "cancelsDamage",
  // On an enemy: it has at most this many damage tokens ("it cannot have more than 18 damage", 19023:B:3); damage past the amount is not placed. Read where damage is placed (rules/core/keywords.ts placeDamage).
  "damageCeiling",
  // On a card that holds damageCap: the damage a quest card or a side quest deals is not counted against the cap or held to it ("takes at most X damage each round from effects other than a quest card's", 19074:A:2). Read where damage is placed (rules/core/keywords.ts placeDamage).
  "damageCapSparesQuest",
  // On a character, or on every character ModifyStat target "characters" holds now and later: player card effects cannot ready it ("characters cannot be readied by player card effects", 19020:A:2). Read by readyBarred (rules/core/holder-classes.ts).
  "cannotReadyByPlayerCard",
  // On a location in the staging area: no more than this much progress can be placed on the locations in the staging area as a whole each round ("no more than 1 progress can be placed on locations in the staging area each round", 19042:A:1). Read by progressRoom (families/south/locations.ts).
  "progressCapShared",
  // Engine use: the progress placed this round on locations that hold progressCapShared, noted on the table (families/south/locations.ts notePlaced).
  "progressPlacedShared",
  // On a side quest in the staging area: it is the current quest until the end of the phase (emce.side-quests-in-play). Set by MakeCurrentQuest; a record reads it with the `flag` condition ("While Defend the Town is the current quest", 19071:A:1).
  "currentQuest",
  // On an enemy: the characters defending against it do not count their Defense ("Characters do not count their Defense when defending against Dagnir", 19067:A:1). Read by defenseAsDefender (rules/core/keywords.ts).
  "defenseIgnored",
  // On an enemy: allies cannot be declared as attackers against it ("Allies cannot be declared as attackers against Dagnir", 19068:A:1). Read by canAttack (rules/combat/combat.ts).
  "alliesCannotAttack",
  // On an enemy: it is dealt this many shadow cards where it is dealt one ("deal it a number of shadow cards equal to the number of Loot objectives the players control", 19098:A:3; to a minimum of 1). Read by dealOneShadow (rules/interpret/interpret.ts).
  "dealtShadows",
  // On a location: the adjustment a Response made to its Discover value this phase, positive or negative ("increase or decrease its Discover value by 1 before resolving it", 19094:A:3). Read by the Discover keyword (families/wilderland/discover.ts).
  "discoverValue",
  // On an enemy: a player can optionally engage it only while a unique enemy is engaged with them ("cannot be optionally engaged except by a player who is engaged with a unique enemy", 12192:A:1). Read by the optional-engagement hook (families/wilderland/engage.ts).
  "optionalEngageUnique",
  // On a seat (target eachSeat): the most its threat can be reduced by player card effects each round ("each player's threat cannot be reduced by more than 1 via player card effects each round", 19104:A:2). Read by lowerThreatByEffect (families/quest/threat.ts).
  "playerThreatReductionCap",
  // On a card: damage that comes from an effect other than a quest card's is not placed on it ("Dagnir cannot take damage from non-quest effects", 19127:A:1). Combat damage is not an effect of a card and still counts. Read where damage is placed (rules/core/keywords.ts placeDamage).
  "cannotTakeNonQuestDamage",
  // On a card in play: an encounter card's effect cannot discard it ("Unique locations cannot be discarded from play by encounter card effects", 12193:B:1). Read by the Discard verb (rules/interpret/verbs.ts).
  "cannotBeDiscardedByEncounter",
  // On a hero (set by a constant ModifyStat of an attachment on its host): the players lose the game when it leaves play ("If attached hero leaves play, the players lose the game", 19143:A:3). Read where a card is destroyed (rules/core/keywords.ts destroyCard).
  "lossOnLeavingPlay",
  // Engine use, on a card or the table: the first treachery revealed this round, noted as it is revealed in a game that reads firstRevealedEachRound (families/wilderland/reveals.ts), and that a treachery was revealed this round.
  "firstTreachery",
  "treacheryRevealed",
  // On a card in play: resource tokens cannot be placed on it ("resources cannot be placed on The Heroes' Defense", 19161:A:2). Read by PlaceResourceTokens (families/nightmare/dungeon.ts).
  "noResourcesPlaced",
] as const;

export const manifest = { name: "wilderland", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
