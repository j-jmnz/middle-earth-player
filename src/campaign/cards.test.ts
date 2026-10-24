import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { cards } from "../catalog/schema.ts";
import { printedFromCard } from "../rules/printed.ts";
import { loadCards } from "../../scripts/data/load-cards.ts";
import { temporaryCatalog } from "../../scripts/temp-catalog.ts";

import { printedFromRow, printedMap } from "./cards.ts";

// The phone builds the engine's cards from catalog.db rows. They must equal the cards the engine tests build from data/cards.
describe("printedFromRow", () => {
  const rows = drizzle(new Database(temporaryCatalog(), { readonly: true })).select().from(cards).all();
  const source = new Map(loadCards().map((card) => [card.code, card]));

  it("reads every Fellowship card the way data/cards does", () => {
    const fellowship = rows.filter((row) => row.campaignId === "fellowship-of-the-ring");
    expect(fellowship.length).toBeGreaterThan(100);
    for (const row of fellowship) {
      const card = source.get(row.code);
      if (!card) throw new Error(`data/cards has no ${row.code}`);
      let expected;
      try {
        expected = printedFromCard(card);
      } catch {
        continue;
      }
      expect(printedFromRow(row), `${row.code} ${row.name}`).toEqual(expected);
    }
  });

  it("keeps the campaign facts a boon or burden needs", () => {
    const map = printedMap(rows);
    const burdens = [...map.values()].filter((card) => card.campaignKind === "burden");
    expect(burdens.length).toBeGreaterThan(0);
    expect(map.get("141078")?.campaignKind).toBe("burden");
    expect(map.get("141001")?.traits).toContain("Ring-bearer");
    expect(map.get("141085")?.leavesPlayLoses).toBe(true);
  });
});
