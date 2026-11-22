import { readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

import type { Card } from "../../src/catalog/card-facts.ts";
import { RAW_DIR } from "./paths.ts";
import { TEST_DECKLISTS } from "./sources/ringsdb.ts";

// data/decks/test-decks.json: the RingsDB decklists the fixture games play (`pnpm data sync ringsdb` fetches them into
// data/raw/ringsdb/decklists/). They are not a printed product, so they stay out of data/decks/prebuilt.json and the app
// does not offer them. The deck is the list's `slots` without its heroes; the list prints a hero in both.
export const testDeckSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  // The decklist's page on RingsDB.
  source: z.string().min(1),
  // One to four: a list with the Bond of Friendship contract has four (src/catalog/deck-rules.ts).
  heroes: z.array(z.string().min(1)).min(1).max(4),
  cards: z.array(z.strictObject({ code: z.string().min(1), count: z.number().int().positive() })).min(1),
});
export type TestDeck = z.infer<typeof testDeckSchema>;
export const testDecksSchema = z.array(testDeckSchema);

const rawSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  heroes: z.record(z.string(), z.number()),
  slots: z.record(z.string(), z.number().int().positive()),
});

// The id a deck is saved under: the name, lowercased and hyphenated.
function idOf(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function loadTestDecks(cards: readonly Card[]): TestDeck[] {
  const known = new Set(cards.map((card) => card.code));
  return TEST_DECKLISTS.map((listId) => {
    const raw = rawSchema.parse(JSON.parse(readFileSync(path.join(RAW_DIR, "ringsdb", "decklists", `${listId}.json`), "utf8")) as unknown);
    const heroes = Object.keys(raw.heroes);
    for (const [code, count] of Object.entries(raw.slots)) {
      if (!known.has(code)) throw new Error(`Test deck ${raw.name}: card ${code} is not in data/cards`);
      if (raw.heroes[code] != null && count !== 1) throw new Error(`Test deck ${raw.name}: hero ${code} is listed ${count} times`);
    }
    const cardRows = Object.entries(raw.slots).filter(([code]) => raw.heroes[code] == null).map(([code, count]) => ({ code, count }))
      .sort((a, b) => a.code.localeCompare(b.code));
    return { id: idOf(raw.name), name: raw.name, source: `https://www.ringsdb.com/decklist/view/${listId}`, heroes, cards: cardRows };
  });
}
