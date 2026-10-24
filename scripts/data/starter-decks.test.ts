import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadCards } from "./load-cards.ts";
import { loadCampaign } from "./load-scenarios.ts";
import type { RuleEntry } from "./rules/spans.ts";
import { DATA_DIR } from "./paths.ts";

// The two starter decklists are data (data/starter-decks.json, copied into the campaign file). Each row's name, collector
// number and count is checked against the MEC109 span that prints the list (page 9), and each section's total against the
// "Allies (21)" heading the booklet prints above it.
const entries = JSON.parse(readFileSync(path.join(DATA_DIR, "rules", "entries.json"), "utf8")) as RuleEntry[];
const campaign = loadCampaign();
const cards = new Map(loadCards().map((card) => [card.code, card]));

type Printed = { section: string; name: string; collector: number; count: number };

function straight(text: string): string {
  return text.replaceAll("’", "'");
}

function printedRows(text: string): { rows: Printed[]; totals: Map<string, number> } {
  const start = text.search(/^Heroes \(\d+\)$/m);
  const lines = straight(text.slice(start))
    .replace(/\n\(/g, " (")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const rows: Printed[] = [];
  const totals = new Map<string, number>();
  let section = "";
  for (const line of lines) {
    const heading = /^(Heroes|Allies|Attachments|Events) \((\d+)\)$/.exec(line);
    if (heading) {
      section = heading[1] ?? "";
      totals.set(section, Number(heading[2]));
      continue;
    }
    const row = /^(?:(\d+)x )?(.+?) \( (\d+)\)$/.exec(line);
    if (!row) throw new Error(`Unreadable starter row: ${line}`);
    rows.push({ section, name: row[2] ?? "", collector: Number(row[3]), count: row[1] ? Number(row[1]) : 1 });
  }
  return { rows, totals };
}

const SECTION: Record<string, string> = { hero: "Heroes", ally: "Allies", attachment: "Attachments", event: "Events" };

describe("starter decks", () => {
  it("names both decks and the span that prints each", () => {
    expect(campaign.starterDecks.map((deck) => [deck.id, deck.span])).toEqual([
      ["stealth-and-steadfastness", "mec109.starter-stealth"],
      ["wisdom-and-wizardry", "mec109.starter-wisdom"],
    ]);
  });

  for (const deck of campaign.starterDecks) {
    it(`${deck.name}: every row's name, collector number and count is the one the booklet prints`, () => {
      const entry = entries.find((item) => item.id === deck.span);
      expect(entry, `${deck.span} is in data/rules/entries.json`).toBeDefined();
      expect(entry?.doc).toBe("mec109");
      const printed = printedRows(entry?.text ?? "");
      const ours = deck.rows.map((row) => ({ section: SECTION[row.type] ?? "", name: straight(row.name), collector: row.collector, count: row.count }));
      expect(ours).toEqual(printed.rows.map((row) => ({ ...row, name: row.name })));
      for (const [section, total] of printed.totals) {
        const sum = deck.rows.filter((row) => SECTION[row.type] === section).reduce((count, row) => count + row.count, 0);
        expect(sum, `${deck.name} ${section}`).toBe(total);
      }
    });

    it(`${deck.name}: every code is a card of that name and type`, () => {
      for (const row of deck.rows) {
        expect(cards.get(row.code)?.name, row.code).toBe(row.name);
        expect(cards.get(row.code)?.type, row.code).toBe(row.type);
      }
    });
  }
});
