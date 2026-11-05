// The vocabulary the Ered Mithrin campaign adds to effect records: the treasures the players find (emce.treasure), the boon allies
// who either join the Campaign Pool or are traded for a log line (emce.boon-allies), the encounter cards the pool holds
// (emce.campaign-pool-encounter), the cards a campaign card removes at Setup, and what several scenarios share: the Caves deck and Deep
// (emce.caves-deck, emce.deep), the Evil Creatures deck (emce.evil-creatures-deck), Discover X and Loot (emce.discover, emce.loot). Simple verbs; effect-schema-verbs.ts composes them.
// src/rules/families/wilderland/ runs them (the Resolution ones in src/rules/setup/resolution.ts, the Setup removal in src/campaign/checklist.ts).
// Guarded (enemy or location) on an objective (emce.guarded-x) is the objectives family's GuardObjective with `types`.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { ALLY_LINES } from "../ally-lines.ts";
import { cardRefSchema, positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const code = z.string().min(1);
// The decks beside the encounter deck (emce.caves-deck, emce.evil-creatures-deck; src/rules/core/piles.ts): the Caves deck, the Evil Creatures deck, and the two encounter sets Lost in Mirkwood sets aside.
const pile = z.enum(["caves", "evilCreatures", "spiders", "orcs"]);

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
  z.strictObject({ verb: z.literal("AddFromPile"), pile, to: z.enum(["staging", "engaged"]), count: positiveAmountSchema.optional(), who: z.enum(["actor", "firstPlayer", "eachSeat"]).optional(), attachSource: z.boolean().optional(), ...when }),
  // "Shuffle the Spiders of Mirkwood encounter set into the encounter deck" (18072:A): the cards of the set-aside deck join the encounter deck, which is shuffled, and the deck stays empty (emce.setup-lost-in-mirkwood).
  z.strictObject({ verb: z.literal("ShufflePileIntoEncounterDeck"), pile, ...when }),
  // Constant on a location, the Deep keyword (emce.deep; 18046:A, 19016:A): after the players travel to it and the Responses to the travel are done, they discard it and the top card of the Caves deck replaces it as the active location. Ignored with the Caves
  // deck empty, while the location is no longer the active location, or while a card in play ignores the keyword (IgnoreKeyword). A location that is not a Deep location is not touched; the engine reads this record when the players travel (families/wilderland/deep.ts).
  z.strictObject({ verb: z.literal("Deep") }),
  // Constant on a card in play, usually the campaign card or the quest stage: "Ignore the deep keyword" / "Ignore the deep and discover keywords" (12187:A, 12195:A, 18080:B, 19023:B; emce.deep, emce.discover). While the card is in play the keywords
  // are not resolved: the scenario-level switch. It does nothing when run.
  z.strictObject({ verb: z.literal("IgnoreKeyword"), keywords: z.array(z.enum(["deep", "discover"])).min(1) }),
  // Forced on a location, trigger becameActive with subject self: the Discover X keyword (emce.discover; 19102:A, 19104:A, 19105:A). The first player looks at the top X cards of the encounter deck (the discard pile is shuffled into it when it holds fewer),
  // attaches one looked-at Loot objective to the active location as a guarded objective (the first player chooses among several), reveals a random looked-at card with the Hazard trait, and puts the rest in the encounter discard pile. Ignored while a card in play ignores the keyword.
  z.strictObject({ verb: z.literal("Discover"), amount: positiveAmountSchema, ...when }),
  // Constant on an objective, the Loot keyword (emce.loot; 19094:A, 19095:A, 19096:A): the card enters play only through the Discover keyword. One revealed from the encounter deck is discarded and another card is revealed (windows/frames.ts startReveal).
  z.strictObject({ verb: z.literal("Loot") }),
  // Constant on an objective: "The first player gains control of Haldan while he is free of encounters" (18070:A:1; rr.guarded). The objective stays in the staging area under its guard; once none is attached to it, it enters the first player's play area,
  // controlled by them (families/wilderland/control.ts). It does nothing when run.
  z.strictObject({ verb: z.literal("GainControlWhenFree"), who: z.literal("firstPlayer") }),
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
  // "Search the encounter deck and discard pile for a Dragon treachery and attach it to Fire-drake, if able" (18080:A:1): the first player chooses a card of the type and trait in the encounter deck or its discard pile (one of each title) that the enemy named `to` does not carry yet, and it is attached to that enemy in play. The deck is shuffled by the instruction after it.
  z.strictObject({ verb: z.literal("AttachSearched"), type: z.enum(["treachery"]), trait: z.string().min(1), to: z.string().min(1), ...when }),
  // "The first player chooses a player to attach an Artifact attachment from his hand to Dragon Hoard. That attachment gains the guarded (location) keyword" (18043:A:3): the last picked card of a hand is guarded by a location of the encounter deck, found as the Guarded (location) keyword does (emce.guarded-x), and lies in the staging area; once nothing guards it the players claim it, the first player choosing the character it attaches to, as for a treasure. With no location to find it is claimed at once.
  z.strictObject({ verb: z.literal("GuardPickedAttachment"), types: z.array(z.enum(["enemy", "location"])).min(1), ...when }),
  // "The first player attaches the top card of his deck to Hobgoblin faceup as a guarded attachment" (18050:A:2): the first player's top deck card lies faceup under the source, which guards it (cardsUnder). Nothing happens with an empty deck.
  z.strictObject({ verb: z.literal("GuardWithDeckTop"), ...when }),
  // A marker on Hobgoblin (18050:A:2, its Forced record on leftPlay): "When Hobgoblin leaves play, return the card it was guarding to its owner's hand". An enemy leaving play queues no event, so the settle sweep returns a card held under an enemy that is out of play (families/wilderland/kings.ts returnHeld). It does nothing when run.
  z.strictObject({ verb: z.literal("ReturnGuardedToHand") }),
  // "Cancel the attack" (18080:B:2): the player attack in progress deals no damage; its attackers stay exhausted. Run in the response to enemyAttacked, which resolves before the attack's strength is read.
  z.strictObject({ verb: z.literal("CancelStrike"), ...when }),
] as const;

const TRIGGERS = [] as const;
const FLAGS = [
  // On a character: the next damage it would be dealt cancels this many points of it, and the flag is spent ("The next time that character would be dealt damage this round, cancel 1 of that damage", 12166:A:2). Set with a ModifyStat that lasts
  // until the end of the round or the phase; src/rules/families/wilderland/shield.ts takes it as damage is placed.
  "damageShield",
  // On an enemy: the damage it would be dealt is canceled and the card that granted the flag (Dragon Scales, 18059:A:2) is discarded. Set by a constant ModifyStat of the attachment; src/rules/families/wilderland/shield.ts cancelAllDamage takes it as damage is placed.
  "cancelsDamage",
] as const;

export const manifest = { name: "wilderland", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
