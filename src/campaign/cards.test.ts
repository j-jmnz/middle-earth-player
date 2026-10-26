import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { cards } from "../catalog/schema.ts";
import { printedFromCard } from "../rules/printed.ts";
import { loadCards } from "../../scripts/data/load-cards.ts";
import { temporaryCatalog } from "../../scripts/temp-catalog.ts";

import { printedFromRow, printedMap, unprintable } from "./cards.ts";

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
    const map = printedMap(rows.filter((row) => unprintable(row) === undefined || row.typeCode === "campaign"));
    const burdens = [...map.values()].filter((card) => card.campaignKind === "burden");
    expect(burdens.length).toBeGreaterThan(0);
    expect(map.get("141078")?.campaignKind).toBe("burden");
    expect(map.get("141001")?.traits).toContain("Ring-bearer");
    expect(map.get("141085")?.leavesPlayLoses).toBe(true);
  });

  it("leaves the campaign card out on purpose and prints every other card a scenario deals", () => {
    const campaignCards = rows.filter((row) => row.typeCode === "campaign");
    expect(campaignCards.length).toBeGreaterThan(0);
    expect(printedMap(campaignCards).size).toBe(0);
  });

  it("throws, naming the code, when a row the engine cannot print is mapped", () => {
    // Every card type the catalog holds now prints (side quests and contracts included), so a row of a type no engine card has stands in.
    const first = rows[0];
    if (!first) throw new Error("the catalog is empty");
    const nightmare = { ...first, code: "nightmare-row", typeCode: "nightmare" };
    expect(unprintable(nightmare)).toBeDefined();
    expect(() => printedMap([nightmare])).toThrow(nightmare.code);
  });
});
