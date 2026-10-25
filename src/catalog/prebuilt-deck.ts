import { z } from "zod";

const slotSchema = z.strictObject({ code: z.string().min(1), count: z.number().int().positive() });

// data/decks/prebuilt.json: the player decks an official product prints or ships ready to play, built by
// scripts/data/prebuilt-decks.ts from data/prebuilt-decks.json. `source` is the rule span that prints the list or the
// DragnCards deck it was read from. `sideboard` holds the product's remaining cards; the app imports heroes and cards only.
export const prebuiltDeckSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  product: z.string().min(1),
  productName: z.string().min(1),
  source: z.string().min(1),
  heroes: z.array(z.string().min(1)).min(1).max(3),
  cards: z.array(slotSchema).min(1),
  sideboard: z.array(slotSchema),
});
export type PrebuiltDeck = z.infer<typeof prebuiltDeckSchema>;
export const prebuiltDecksSchema = z.array(prebuiltDeckSchema);
