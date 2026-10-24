import { readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

import type { Card } from "../../src/catalog/card-facts.ts";
import { starterDeckSchema, type StarterDeckData } from "../../src/catalog/scenario-data.ts";
import { DATA_DIR } from "./paths.ts";
import type { RuleEntry } from "./rules/spans.ts";

// data/starter-decks.json is hand-checked against the MEC109 booklet (page 9): the two decklists, with the catalog code
// chosen for each printed row. The build copies it into data/campaigns as `starterDecks` after checking that every code is
// a card of that name and type, and that the span it names exists.
export function loadStarterDecks(cards: readonly Card[], entries: readonly RuleEntry[], dataDir = DATA_DIR): StarterDeckData[] {
  const decks = z.array(starterDeckSchema).parse(JSON.parse(readFileSync(path.join(dataDir, "starter-decks.json"), "utf8")) as unknown);
  const byCode = new Map(cards.map((card) => [card.code, card]));
  const spans = new Set(entries.map((entry) => entry.id));
  for (const deck of decks) {
    if (!spans.has(deck.span)) throw new Error(`Starter deck ${deck.id}: span ${deck.span} is not in data/rules/index.json`);
    for (const row of deck.rows) {
      const card = byCode.get(row.code);
      if (!card) throw new Error(`Starter deck ${deck.id}: ${row.name} names ${row.code}, which is not in data/cards`);
      if (card.name !== row.name || card.type !== row.type) throw new Error(`Starter deck ${deck.id}: ${row.code} is ${card.name} (${card.type}), not ${row.name} (${row.type})`);
    }
  }
  return decks;
}
