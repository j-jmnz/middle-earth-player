import { z } from "zod";

const slotSchema = z.strictObject({ code: z.string().min(1), count: z.number().int().positive() });

// data/decks/prebuilt.json: the player decks an official product prints or ships ready to play, built by
// scripts/data/prebuilt-decks.ts from data/prebuilt-decks.json. `source` is the rule span that prints the list or the
// DragnCards deck it was read from. `sideboard` holds the product's remaining cards; the app imports heroes and cards only.
export const prebuiltDeckSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  // The heading the import screen lists it under (PREBUILT_GROUPS in scripts/data/prebuilt-decks.ts).
  group: z.string().min(1),
  // The RingsDB pack, when the deck is one product's contents.
  product: z.string().min(1).optional(),
  productName: z.string().min(1),
  source: z.string().min(1),
  heroes: z.array(z.string().min(1)).min(1).max(3),
  cards: z.array(slotSchema).min(1),
  sideboard: z.array(slotSchema),
  // A line the editor shows with the deck: a condition the decklist prints, or why the deck is short of 50.
  note: z.string().min(1).optional(),
});
export type PrebuiltDeck = z.infer<typeof prebuiltDeckSchema>;
export const prebuiltDecksSchema = z.array(prebuiltDeckSchema);
