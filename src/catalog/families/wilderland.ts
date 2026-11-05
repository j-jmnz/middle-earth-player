// The vocabulary the Ered Mithrin campaign adds to effect records (phase 50): the treasures the players find (emce.treasure), the boon allies
// who either join the Campaign Pool or are traded for a log line (emce.boon-allies), the encounter cards the pool holds
// (emce.campaign-pool-encounter) and the cards a campaign card removes at Setup. Simple verbs; effect-schema-verbs.ts composes them.
// src/rules/families/wilderland/ runs them (the Resolution ones in src/rules/setup/resolution.ts, the Setup removal in src/campaign/checklist.ts).
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { ALLY_LINES } from "../ally-lines.ts";
import { cardRefSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const code = z.string().min(1);

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
  // or with `inPlay` one copy of a code for each card with that code in play that the pool did not deal into this game. The log tallies the copies, never past what one collection holds.
  z.strictObject({ verb: z.literal("AddEncounterToPool"), codes: z.array(code).min(1), inPlay: z.boolean().optional(), ...when }),
  // Resolution: cards leave the Campaign Pool. A record names exactly one of `codes` and `choice` (checked on the effect: src/catalog/effect-schema.ts). `codes` reaches only the encounter cards the pool tallies, not the pool's own cards: every copy of these encounter cards ("Remove A Growing Threat from the campaign pool", 12193:B). `choice: "eachPlayerNonBurden"`: each player in turn may
  // remove one card that is not a burden, a card of the pool or an encounter card the pool tallies ("Each player may remove a non-burden card from the campaign pool", 12187:B); a player may decline.
  z.strictObject({ verb: z.literal("RemoveFromPool"), codes: z.array(code).min(1).optional(), choice: z.literal("eachPlayerNonBurden").optional(), ...when }),
  // Campaign Setup: "If 'Turayn has taken an oath of vigilance,' search the encounter deck for 3 treacheries and remove them from the game" (12170:A, 12175:A, 12184:A, 12187:A, 12189:A, 12193:A, 12195:A).
  // When the log records `line`, the first player chooses up to `count` cards of `cardType` in the encounter deck, `nonUnique` ones only when it says so, none of the titles in `except`, and they are
  // removed from the game. The checklist asks for each choice (campaign/checklist.ts); the cards the deal builds are fewer by them.
  z.strictObject({ verb: z.literal("RemoveFromEncounterDeckIfLogged"), line: z.enum(ALLY_LINES), count: z.number().int().positive(), cardType: z.enum(["enemy", "location", "treachery"]), nonUnique: z.boolean().optional(), except: z.array(z.string().min(1)).optional() }),
] as const;

const TRIGGERS = [] as const;
const FLAGS = [] as const;

export const manifest = { name: "wilderland", verbs: VERBS, triggers: TRIGGERS, flags: FLAGS } as const satisfies CatalogFamily;
