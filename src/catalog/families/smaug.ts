// The smaug family (The Battle of Lake-town, docs/scenarios/standalone-scenarios/the-battle-of-lake-town.md, The Battle of Lake-town): the Smaug deck revealed at the beginning of every quest phase, Burn X and "resolve all burn damage", Smaug's attack against Lake-town and the stage that heals Lake-town with progress.
// Lake-town takes damage tokens (`changeDamageOn` of the moria family), its damage and the Victory points in the display are the amounts `lakeTownDamage` and `victoryDisplay` (effect-schema-amount.ts), and the card refs `smaug` and `lakeTown` name the two cards
// (MoveDamageTo). src/rules/families/smaug/ runs and reads them.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { when } from "../effect-schema-conditions.ts";

const VERBS = [
  // The first player reveals the top card of the Smaug deck into the play area (engaged with him) or the staging area ("Smaug", Quest Companion rulings: The Smaug Deck): the engine's own question at the beginning of the quest phase offers it (families/smaug/deck.ts).
  z.strictObject({ verb: z.literal("RevealSmaug"), to: z.enum(["play", "staging"]), ...when }),
  // "Resolve all burn damage from all locations in play" (50205:A:2): the Burn of every location in play is a pool; each player in turn may exhaust ready characters to assign it to them, and the rest goes on Lake-town. The fields are the engine's own: the pool left,
  // the seats still to answer, the character just exhausted, and the share just chosen.
  z.strictObject({
    verb: z.literal("ResolveBurn"),
    pool: z.number().int().min(0).optional(),
    seats: z.array(z.number().int().min(0)).optional(),
    pending: z.string().min(1).optional(),
    assign: z.strictObject({ id: z.string().min(1), amount: z.number().int().positive() }).optional(),
    ...when,
  }),
  // "Smaug makes an attack against Lake-town. The last player may declare a defender" (50211:A:1): the Smaug in play attacks the last player now with a shadow card; undefended damage and excess damage go on Lake-town.
  z.strictObject({ verb: z.literal("AttackLakeTown"), ...when }),
  // Stage 2B (50202:B:2): the first player chooses how many of the replaced progress tokens (the event's X) are discarded to remove as many damage tokens from Lake-town; the rest goes on the quest card. `progress` and `heal` are the engine's own.
  z.strictObject({ verb: z.literal("HealLakeTownByProgress"), progress: z.number().int().min(0).optional(), heal: z.number().int().min(0).optional(), ...when }),
  // Fisherman's Dock (50223:A:2): the players split the progress from questing between the two active locations (the official ruling in docs/brief.md). The first player chooses how much goes on the first location; the rest goes on the second. `amount` is the event's X on the first call
  // (quest/quest.ts hands it over while Fisherman's Dock is one of two active locations, families/smaug/split.ts); `onFirst` is the share chosen, the engine's own.
  z.strictObject({ verb: z.literal("SplitProgress"), amount: z.number().int().min(0).optional(), onFirst: z.number().int().min(0).optional(), ...when }),
] as const;

const TRIGGERS = [] as const;

const FLAGS = [
  // On a location (target `self`, 50215:A:1): each location in play gains Burn 1 while it is in play, one each for every card that holds the flag. Read by `ResolveBurn`.
  "locationsGainBurn",
  // On an enemy: the damage beyond the remaining hit points of the character its attack damages goes on Lake-town ("Excess damage from attacks by Smaug the Magnificent must be assigned to Lake-town", 50206:A:2).
  "excessToLakeTown",
  // On an enemy: allies cannot be declared as defenders against it ("Allies cannot be declared as defenders", 50214:A:1).
  "alliesCannotDefend",
  // On a quest stage: the progress tokens that questing would place on it are not placed, and its record hears them as `progressReplaced` (50202:B:2, quest/quest.ts PROGRESS_REPLACED).
  "progressHealsLakeTown",
] as const;

export const manifest = { name: "smaug", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
