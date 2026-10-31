import { z } from "zod";

import { PILES } from "../../../src/catalog/scenario-data.ts";

// data/overrides.json: every place a source was wrong or silent, each with its reason and source.
const overridesSchema = z.object({
  cards: z.array(
    z.object({
      match: z.object({ code: z.string().optional(), name: z.string().optional(), set: z.string().optional(), number: z.number().optional() }),
      set: z.object({ code: z.string().optional(), pack: z.string().optional(), burdenSet: z.string().optional(), encounterSet: z.string().optional(), name: z.string().optional(), type: z.enum(["ship-enemy"]).optional(), threat: z.number().int().optional(), engagementCost: z.number().int().optional(), willpower: z.number().int().optional(), attack: z.number().int().optional(), defense: z.number().int().optional(), health: z.number().int().optional(), victory: z.number().int().optional(), backType: z.enum(["player", "encounter"]).nullable().optional(), keywords: z.record(z.string(), z.unknown()).optional(), back: z.object({ willpower: z.number().int().optional(), attack: z.number().int(), defense: z.number().int(), health: z.number().int(), victory: z.number().int().optional() }).optional() }),
      reason: z.string().min(1),
      source: z.string().min(1),
    }),
  ),
  // A scenario's pile for one card, where the sources put it somewhere its own Setup text does not. `from` limits the move to the
  // load-list lines that put the card in that pile (Raid on the Grey Havens loads Sahír's Ravager in the encounter deck and, once more,
  // set aside: only the set-aside copy is staged); without it every line of the card moves.
  scenarioPiles: z
    .array(
      z.object({
        scenario: z.string().min(1),
        code: z.string().min(1),
        from: z.enum(PILES).optional(),
        pile: z.enum([...PILES, "campaign"]),
        reason: z.string().min(1),
        source: z.string().min(1),
      }),
    )
    .default([]),
  // A printed Easy count the sources disagree on. `easy` is the count of copies that stay in an Easy deck.
  scenarioEasy: z
    .array(z.object({ scenario: z.string().min(1), code: z.string().min(1), easy: z.number().int().nonnegative(), reason: z.string().min(1), source: z.string().min(1) }))
    .default([]),
  // A count the sources disagree on, settled by the printed card: the encounter set's size printed on its cards ("19/31") or a Setup line. `normal` and
  // `easy` are the copies of the card in `pile` (the encounter deck unless named) at that difficulty, replacing the load list's.
  scenarioCounts: z
    .array(
      z.object({
        scenario: z.string().min(1),
        code: z.string().min(1),
        pile: z.enum(PILES).optional(),
        normal: z.number().int().positive().optional(),
        easy: z.number().int().nonnegative().optional(),
        reason: z.string().min(1),
        source: z.string().min(1),
      }),
    )
    .default([]),
  // A product whose Hall of Beorn codes collide with another product's: the code is `prefix` and the collector number padded to
  // `width` digits (two by default), which is the code RingsDB gives the same cards where it lists them. A set may have several
  // entries, each for the collector numbers from `from` up (0 by default); the entry with the highest `from` the card reaches wins.
  productCodes: z
    .array(
      z.object({
        set: z.string().min(1),
        prefix: z.string().regex(/^\d{2,3}$/),
        width: z.number().int().min(2).max(3).default(2),
        from: z.number().int().nonnegative().default(0),
        reason: z.string().min(1),
        source: z.string().min(1),
      }),
    )
    .default([]),
  // A name a booklet prints for an encounter set that the cards print otherwise (the Learn to Play's "Journey Down the Anduin").
  encounterSetAliases: z
    .array(z.object({ booklet: z.string().min(1), set: z.string().min(1), reason: z.string().min(1), source: z.string().min(1) }))
    .default([]),
  // Cards the app leaves out of the player card pool (not deck-legal): every card of a pack, or one card by code.
  outOfScope: z
    .array(z.object({ pack: z.string().min(1).optional(), code: z.string().min(1).optional(), reason: z.string().min(1), source: z.string().min(1) }))
    .default([]),
  // A campaign no scenario file is built for yet. The sources group its scenarios under packs; the override names the
  // campaign and the packs (Hall of Beorn products), because no source names a campaign.
  campaigns: z
    .array(z.object({ id: z.string().min(1), name: z.string().min(1), products: z.array(z.string().min(1)).min(1), reason: z.string().min(1), source: z.string().min(1) }))
    .default([]),
});
export type Overrides = z.infer<typeof overridesSchema>;
export function parseOverrides(raw: unknown): Overrides {
  return overridesSchema.parse(raw);
}
