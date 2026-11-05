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
  verbFlags(z.strictObject({ verb: z.literal("ShuffleIntoPile"), pile, code, ...when }), { setupRole: "afterSetup" }),
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
] as const;

const TRIGGERS = [] as const;
const FLAGS = [
  // On a character: the next damage it would be dealt cancels this many points of it, and the flag is spent ("The next time that character would be dealt damage this round, cancel 1 of that damage", 12166:A:2). Set with a ModifyStat that lasts
  // until the end of the round or the phase; src/rules/families/wilderland/shield.ts takes it as damage is placed.
  "damageShield",
] as const;

export const manifest = { name: "wilderland", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
