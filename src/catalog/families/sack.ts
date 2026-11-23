// The sack family (We Must Away, Ere Break of Day, docs/scenarios/the-hobbit.md, We Must Away, Ere Break of Day; hob.sack-deck, hob.sack-x): the Sack deck, the Sack X keyword and its When Sacked effects, the Troll Cave's Baggins travel cost and the small verbs and
// condition the Troll lines need. src/rules/families/sack/ runs and reads them. A card with the Sack trait lies in the Sack deck (the zone `sackDeck`, out of play, facedown) until a Sack X draws it; it is shuffled back into the deck whenever it leaves play.
import { z } from "zod";

import type { CatalogFamily } from "../family-manifest.ts";
import { positiveAmountSchema } from "../effect-schema-amount.ts";
import { when } from "../effect-schema-conditions.ts";
import { verbFlags } from "../verb-flags.ts";

const VERBS = [
  // Setup: "Remove and shuffle the 7 Sack cards into a Sack deck and set it aside face down" (131023:A:1; hob.sack-deck): the set-aside cards with the Sack trait go into the Sack deck, facedown, and the deck is shuffled with the game's seed.
  verbFlags(z.strictObject({ verb: z.literal("PrepareSackDeck"), ...when }), { setupRuns: "top" }),
  // "Sack X" (131032:A:2, 131051:A:1; hob.sack-x): the first player draws the top X cards of the Sack deck one at a time and resolves each card's When Sacked effect (its record of timing `triggered`, trigger `sacked`) before the next is drawn. An empty Sack deck ignores the keyword.
  verbFlags(z.strictObject({ verb: z.literal("Sack"), amount: positiveAmountSchema, ...when }), { runsInFrame: true }),
  // The When Sacked effect of a Sack card (131044:A:1 to 131050:A:1; hob.sack-x-example): the source Sack card attaches to the eligible character with the highest `by` and no Sack card attached, never a card titled Gandalf and never a character that cannot have attachments; the first player chooses
  // among characters tied. `to`: `ally` (allies only), `character` (heroes and allies), `hero` (heroes only). `by`: the printed `cost`, `attack`, `defense`, `willpower` or `hitPoints` (a missing value counts 0), the number of `attachments` on the character, or the `resources` in its pool.
  // With no eligible character the card is shuffled into the Sack deck.
  z.strictObject({ verb: z.literal("AttachSacked"), to: z.enum(["ally", "character", "hero"]), by: z.enum(["cost", "attack", "defense", "willpower", "hitPoints", "attachments", "resources"]), ...when }),
  // "Remove all Troll enemies and Sack cards from the game" (131025:B:1): every card with one of these traits leaves the game wherever it lies (in play, set aside, in a deck or discard pile, in the victory display); its attachments leave play with it.
  z.strictObject({ verb: z.literal("RemoveTraitFromGame"), traits: z.array(z.string().min(1)).min(1), ...when }),
  // The Travel cost of Troll Cave (131037:A:2): the first player spends `amount` resources from Bilbo Baggins' pool (`reduced` while Bilbo has the card with code `purse` attached), and the players can pay it only while Bilbo has the card with code `key` attached
  // and his pool holds the cost (rr.travel: a cost the players cannot pay bars the travel).
  z.strictObject({ verb: z.literal("SpendBagginsToTravel"), amount: z.number().int().positive(), reduced: z.number().int().positive(), key: z.string().min(1), purse: z.string().min(1), ...when }),
] as const;

// "sacked": the event a Sack card's When Sacked record answers (src/rules/families/sack/deck.ts reads the record when the card is drawn; no card listens for it).
export const manifest = { name: "sack", verbs: VERBS, triggers: ["sacked"], flags: [] } as const satisfies CatalogFamily;
