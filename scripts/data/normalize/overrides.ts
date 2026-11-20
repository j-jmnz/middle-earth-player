import { z } from "zod";

import { PILES } from "../../../src/catalog/scenario-data.ts";

// data/overrides.json: every place a source was wrong or silent, each with its reason and source.
const overridesSchema = z.object({
  cards: z.array(
    z.object({
      match: z.object({ code: z.string().optional(), name: z.string().optional(), set: z.string().optional(), number: z.number().optional() }),
      set: z.object({ code: z.string().optional(), pack: z.string().optional(), burdenSet: z.string().optional(), encounterSet: z.string().optional(), name: z.string().optional(), imageUrls: z.array(z.string().url()).min(1).optional(), traits: z.array(z.string().min(1)).optional(), type: z.enum(["ship-enemy", "enemy"]).optional(), threat: z.number().int().optional(), engagementCost: z.number().int().optional(), cost: z.number().int().optional(), willpower: z.number().int().optional(), attack: z.number().int().optional(), defense: z.number().int().optional(), health: z.number().int().optional(), victory: z.number().int().nullable().optional(), questPoints: z.number().int().nullable().optional(), backType: z.enum(["player", "encounter"]).nullable().optional(), keywords: z.record(z.string(), z.unknown()).optional(), back: z.union([z.object({ willpower: z.number().int().optional(), threat: z.number().int().optional(), engagementCost: z.number().int().optional(), attack: z.number().int(), defense: z.number().int(), health: z.number().int(), victory: z.number().int().optional() }), z.object({ threat: z.number().int() })]).optional() }),
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
        // The code of the card's other side, where the load list holds only one side of a two-sided card (Escape from Khazad-dûm's Dark Pit, whose back is Durin's Bane).
        back: z.string().min(1).optional(),
        reason: z.string().min(1),
        source: z.string().min(1),
      }),
    )
    .default([]),
  // Cards of an encounter set the scenario's own Setup removes from the game, which Hall of Beorn's list of the set still counts (Journey Up the
  // Anduin removes the Wilderlands locations and treacheries, emce.evil-creatures-deck): the dealt count is checked against the rest of the list only.
  scenarioRemovals: z
    .array(z.object({ scenario: z.string().min(1), set: z.string().min(1), types: z.array(z.string().min(1)).min(1), reason: z.string().min(1), source: z.string().min(1) }))
    .default([]),
  // A printed Easy count the sources disagree on, settled here with its reason (the count may differ from Hall of Beorn's). `easy` is the count of copies that stay in an Easy deck.
  scenarioEasy: z
    .array(z.object({ scenario: z.string().min(1), code: z.string().min(1), easy: z.number().int().nonnegative(), reason: z.string().min(1), source: z.string().min(1) }))
    .default([]),
  // A count the sources disagree on, settled by the printed card: the encounter set's size printed on its cards ("19/31") or a Setup line. `normal` and
  // `easy` are the copies of the card in `pile` (the encounter deck unless named) at that difficulty, replacing the load list's. A `normal` of 0 drops the
  // placement, for a card whose copies another pile holds (The Treachery of Rhudaur's Ancient Causeway: the staging pile holds both, the Setup searches the deck for them).
  scenarioCounts: z
    .array(
      z.object({
        scenario: z.string().min(1),
        code: z.string().min(1),
        pile: z.enum(PILES).optional(),
        normal: z.number().int().nonnegative().optional(),
        easy: z.number().int().nonnegative().optional(),
        reason: z.string().min(1),
        source: z.string().min(1),
      }),
    )
    .default([]),
  // A card whose Hall of Beorn `RingsDbCardId` is another card's: the code RingsDB gives it (or, where RingsDB lists none, a six-digit code), by Hall of Beorn's card set and collector number (The Mountain of
  // Fire's Orc Disguise, Captains of the West and Raise the Shire). `title` names one of two cards that share a collector number (Angmar Awakened's Protect the Innocent and Arnor Ravaged, the two sides of one card).
  hobRingsDbCodes: z.array(z.object({ set: z.string().min(1), number: z.number().int().positive(), title: z.string().min(1).optional(), code: z.string().regex(/^\d{5,6}$/), reason: z.string().min(1), source: z.string().min(1) })).default([]),
  // A card a dealt campaign card's own text hands out, which no Setup or Resolution line of the campaign card names: the five boons Mysterious Omens (10160) offers are loaded with The Weather Hills and every later
  // Angmar scenario that can shuffle Omens in (a copy comes from the supply when a player takes it). `code` is the card (or the cards, with one reason), `scenario` the game (or games) that load it.
  scenarioCampaignPlaced: z.array(z.object({ scenario: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]), code: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]), reason: z.string().min(1), source: z.string().min(1) })).default([]),
  // A card Hall of Beorn's scenario list counts that the scenario does not deal: the epic multiplayer mode's cards (mec113.epic-multiplayer-mode), which are dealt by the Epic
  // Multiplayer Mode campaign card's Setup. The dealt count is checked against the rest of the list only.
  scenarioExcluded: z.array(z.object({ scenario: z.string().min(1), code: z.string().min(1), reason: z.string().min(1), source: z.string().min(1) })).default([]),
  // A quest stage Hall of Beorn's scenario file does not list, though its cards and the load list have it (The Old Forest's The Wicked Willow, stage 3A): appended to the listed stages, in order.
  scenarioStages: z.array(z.object({ scenario: z.string().min(1), code: z.string().min(1), reason: z.string().min(1), source: z.string().min(1) })).default([]),
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
  // A DragnCards `packName` that stands for another pack's cards: the row's collector number (`numberInPack`) and name find the card in `pack`.
  // Ered Mithrin's first two scenarios load the 2011 Core Set's encounter sets, which the app deals as the Revised Core Set's reprints of them.
  dragnPackAliases: z
    .array(z.object({ dragncards: z.string().min(1), pack: z.string().min(1), reason: z.string().min(1), source: z.string().min(1) }))
    .default([]),
  // The card of a DragnCards row the sources cannot match: the row's box (`packName`), collector number and side ("a" the row of the id, "b" its
  // `.B` picture row). Hall of Beorn numbers or types the card otherwise (Mount Gundabad's Wormsbane is two Hall of Beorn cards, #143 and #144, and one
  // DragnCards card with two sides) or has no OCTGN guid for it.
  dragnCardCodes: z
    .array(z.object({ dragncards: z.string().min(1), number: z.number().int().positive(), side: z.enum(["a", "b"]), code: z.string().min(1), reason: z.string().min(1), source: z.string().min(1) }))
    .default([]),
  // Cards the app leaves out of the player card pool (not deck-legal): every card of a pack, or one card by code.
  outOfScope: z
    .array(z.object({ pack: z.string().min(1).optional(), code: z.string().min(1).optional(), reason: z.string().min(1), source: z.string().min(1) }))
    .default([]),
  // A campaign or a cycle no scenario file is built for yet. The sources group its scenarios under packs; the override names it
  // and the packs (Hall of Beorn products), because no source names a campaign or a cycle. `kind` "campaign" is played in
  // Campaign Mode (a saga, a Campaign Expansion); "cycle" is a grouping of scenarios that is part of no campaign. `box` is the
  // RCO product a campaign is printed in, the name the Scenarios tab gives it.
  campaigns: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        kind: z.enum(["campaign", "cycle"]),
        box: z.string().min(1).optional(),
        // The US release of its first product (hallofgondor.com/release-dates), the order the hubs list it in.
        released: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        products: z.array(z.string().min(1)).min(1),
        reason: z.string().min(1),
        source: z.string().min(1),
      }),
    )
    .default([]),
});
export type Overrides = z.infer<typeof overridesSchema>;
export function parseOverrides(raw: unknown): Overrides {
  return overridesSchema.parse(raw);
}
