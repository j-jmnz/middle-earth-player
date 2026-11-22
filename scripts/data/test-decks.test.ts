import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { prebuiltDecksSchema } from "../../src/catalog/prebuilt-deck.ts";
import { OPEN_LINES } from "../../src/effects/open-lines.ts";
import { loadCards } from "./load-cards.ts";
import { DATA_DIR } from "./paths.ts";
import { testDecksSchema } from "./test-decks.ts";

// The test decks (data/decks/test-decks.json): the RingsDB decklists the fixture seed finders play (scripts/e2e/seed-kit.ts, `FIXTURE_DECKS` and
// `SOLO_FIXTURE_DECK`; user instruction, 2026-11-22): 41298 for a true solo game, 53651 and 53652 for the two seats of a two-handed one.
// Built from data/raw/ringsdb/decklists, not offered by the app.
const decks = testDecksSchema.parse(JSON.parse(readFileSync(path.join(DATA_DIR, "decks", "test-decks.json"), "utf8")) as unknown);
const prebuilt = prebuiltDecksSchema.parse(JSON.parse(readFileSync(path.join(DATA_DIR, "decks", "prebuilt.json"), "utf8")) as unknown);
const cards = new Map(loadCards().map((card) => [card.code, card]));
const titleOf = (code: string): string => cards.get(code)?.name ?? code;
const BOND_OF_FRIENDSHIP = "22147";
const SOLO = "a-modern-one-deck-or-how-friendship-conquers-all";
const PAIR = ["100-fellowship-detours-and-defense", "100-fellowship-out-of-thin-air"];
const deckOf = (id: string) => {
  const found = decks.find((entry) => entry.id === id);
  if (!found) throw new Error(`data/decks/test-decks.json has no ${id}`);
  return found;
};

describe("the test decks", () => {
  it("are the solo list and the two-handed pair, and no other", () => {
    expect(decks.map((entry) => [entry.id, entry.source])).toEqual([
      [SOLO, "https://www.ringsdb.com/decklist/view/41298"],
      [PAIR[0], "https://www.ringsdb.com/decklist/view/53651"],
      [PAIR[1], "https://www.ringsdb.com/decklist/view/53652"],
    ]);
  });

  it("have four heroes each under the Bond of Friendship contract, and 50 cards beside it", () => {
    expect(deckOf(SOLO).heroes.map(titleOf)).toEqual(["Denethor", "Éowyn", "Glorfindel", "Elrond"]);
    expect(deckOf(PAIR[0] ?? "").heroes.map(titleOf)).toEqual(["Arwen Undómiel", "Denethor", "Thurindir", "Beregond"]);
    expect(deckOf(PAIR[1] ?? "").heroes.map(titleOf)).toEqual(["Gildor Inglorion", "Éowyn", "Glorfindel", "Elrond"]);
    for (const deck of decks) {
      expect(new Set(deck.heroes.map((code) => cards.get(code)?.sphere)).size, deck.id).toBe(4);
      expect(deck.cards.filter((row) => cards.get(row.code)?.type === "contract"), deck.id).toEqual([{ code: BOND_OF_FRIENDSHIP, count: 1 }]);
      expect(deck.cards.reduce((sum, row) => sum + row.count, 0), deck.id).toBe(51);
    }
  });

  it("hold only cards in data/cards, and no hero among their cards", () => {
    for (const deck of decks) {
      for (const row of deck.cards) {
        expect(cards.has(row.code), row.code).toBe(true);
        expect(cards.get(row.code)?.type, row.code).not.toBe("hero");
      }
      for (const code of deck.heroes) expect(cards.get(code)?.type, code).toBe("hero");
    }
  });

  it("have no card with a printed line no effect record owns", () => {
    const codes = new Set(decks.flatMap((deck) => [...deck.heroes, ...deck.cards.map((row) => row.code)]));
    const open = OPEN_LINES.filter((line) => codes.has(line.split(":")[0] ?? ""));
    expect(open).toEqual([]);
  });

  it("are not pre-built decks", () => {
    for (const deck of decks) expect(prebuilt.some((entry) => entry.id === deck.id), deck.id).toBe(false);
  });
});

describe("the two-handed pair", () => {
  it("shares no hero title between its seats, since a hero title may be in only one seat", () => {
    const first = new Set(deckOf(PAIR[0] ?? "").heroes.map(titleOf));
    expect(deckOf(PAIR[1] ?? "").heroes.map(titleOf).filter((title) => first.has(title))).toEqual([]);
  });
});

describe("the test decks under the campaigns' deck rules", () => {
  it("hold no title The Two Towers bans (mec112.saruman-grima-smeagol)", () => {
    for (const deck of decks) {
      const titles = new Set([...deck.heroes, ...deck.cards.map((row) => row.code)].map(titleOf));
      for (const title of ["Saruman", "Gríma", "Sméagol"]) expect(titles.has(title), `${deck.id}: ${title}`).toBe(false);
    }
  });

  it("have no Aragorn or Frodo Baggins, and no Fellowship-sphere hero", () => {
    for (const deck of decks) {
      const titles = new Set([...deck.heroes, ...deck.cards.map((row) => row.code)].map(titleOf));
      for (const title of ["Aragorn", "Frodo Baggins"]) expect(titles.has(title), `${deck.id}: ${title}`).toBe(false);
      expect(deck.heroes.filter((code) => cards.get(code)?.sphere === "fellowship"), deck.id).toEqual([]);
    }
  });
});
