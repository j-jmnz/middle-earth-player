import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { prebuiltDecksSchema } from "../../src/catalog/prebuilt-deck.ts";
import { OPEN_LINES } from "../../src/effects/open-lines.ts";
import { AUTHORED_EFFECTS as THE_TWO_TOWERS } from "../../src/effects/authored/the-two-towers.ts";
import { loadCards } from "./load-cards.ts";
import { loadCampaign } from "./load-scenarios.ts";
import { DATA_DIR } from "./paths.ts";
import { testDecksSchema } from "./test-decks.ts";

// The test decks (data/decks/test-decks.json): RingsDB decklist 8682, The One Deck, which the first seat of every fixture
// seed finder plays (scripts/e2e/seed-kit.ts). Built from data/raw/ringsdb/decklists, not offered by the app.
const decks = testDecksSchema.parse(JSON.parse(readFileSync(path.join(DATA_DIR, "decks", "test-decks.json"), "utf8")) as unknown);
const prebuilt = prebuiltDecksSchema.parse(JSON.parse(readFileSync(path.join(DATA_DIR, "decks", "prebuilt.json"), "utf8")) as unknown);
const cards = new Map(loadCards().map((card) => [card.code, card]));
const deck = decks.find((entry) => entry.id === "the-one-deck");
if (!deck) throw new Error("data/decks/test-decks.json has no the-one-deck");
const titleOf = (code: string): string => cards.get(code)?.name ?? code;

describe("The One Deck", () => {
  it("has Arwen Undómiel, Éowyn and Elrond, and 50 cards", () => {
    expect(deck.heroes.map(titleOf)).toEqual(["Arwen Undómiel", "Éowyn", "Elrond"]);
    expect(deck.heroes).toEqual(["10140", "145002", "04128"]);
    expect(deck.cards.reduce((sum, row) => sum + row.count, 0)).toBe(50);
  });

  it("holds only cards in data/cards, and no hero among its 50", () => {
    for (const row of deck.cards) {
      expect(cards.has(row.code), row.code).toBe(true);
      expect(cards.get(row.code)?.type, row.code).not.toBe("hero");
    }
    for (const code of deck.heroes) expect(cards.get(code)?.type, code).toBe("hero");
  });

  it("has no card with a printed line no effect record owns", () => {
    const codes = new Set([...deck.heroes, ...deck.cards.map((row) => row.code)]);
    const open = OPEN_LINES.filter((line) => codes.has(line.split(":")[0] ?? ""));
    expect(open).toEqual([]);
  });

  it("shares a hero title with Wisdom and Wizardry, which is why that deck leaves the fixtures", () => {
    const wisdom = loadCampaign("fellowship-of-the-ring").starterDecks.find((entry) => entry.id === "wisdom-and-wizardry");
    const titles = new Set(deck.heroes.map(titleOf));
    expect((wisdom?.rows ?? []).filter((row) => row.type === "hero" && titles.has(titleOf(row.code))).map((row) => titleOf(row.code))).toEqual(["Éowyn"]);
  });

  it("is not a pre-built deck", () => {
    expect(prebuilt.some((entry) => entry.id === deck.id)).toBe(false);
  });
});

describe("a fixture's second seat beside The One Deck", () => {
  const heroTitles = new Set(deck.heroes.map(titleOf));
  // The Fellowship fixtures' second seat is a campaign starter deck; every other fixture's is a pre-built one. Wisdom and
  // Wizardry has Éowyn (01007), the title of The One Deck's 145002, so the Fellowship's second seat is Stealth and Steadfastness.
  const starter = loadCampaign("fellowship-of-the-ring").starterDecks.find((entry) => entry.id === "stealth-and-steadfastness");
  const seats: [string, string[]][] = [
    ["defenders-of-gondor", prebuilt.find((entry) => entry.id === "defenders-of-gondor")?.heroes ?? []],
    ["stealth-and-steadfastness", (starter?.rows ?? []).filter((row) => row.type === "hero").map((row) => row.code)],
  ];
  for (const [id, heroes] of seats) {
    it(`${id} shares no hero title with it`, () => {
      expect(heroes.length, id).toBeGreaterThan(0);
      expect(heroes.filter((code) => heroTitles.has(titleOf(code)))).toEqual([]);
    });
  }
});

describe("The One Deck under the campaigns' deck rules", () => {
  const titles = new Set([...deck.heroes, ...deck.cards.map((row) => row.code)].map(titleOf));

  it("holds no title The Two Towers bans (mec112.saruman-grima-smeagol)", () => {
    for (const title of ["Saruman", "Gríma", "Sméagol"]) expect(titles.has(title), title).toBe(false);
  });

  it("has no Aragorn or Frodo Baggins, and no Fellowship-sphere hero", () => {
    for (const title of ["Aragorn", "Frodo Baggins"]) expect(titles.has(title), title).toBe(false);
    expect(deck.heroes.filter((code) => cards.get(code)?.sphere === "fellowship")).toEqual([]);
  });

  it("is not what The Uruk-hai's pool removal takes: Gildor Inglorion goes by his saga boon's code", () => {
    const setup = THE_TWO_TOWERS.find((effect) => effect.id === "143071:campaignSetup:1");
    const removal = setup?.instructions.find((step) => step.verb === "RemovePoolCards");
    const removed = removal && "codes" in removal ? removal.codes : [];
    expect(removed).toContain("141077");
    expect(cards.get("141077")?.name).toBe("Gildor Inglorion");
    // The deck's ally of the same title is another card and stays in its deck.
    expect(removed).not.toContain("02079");
    expect(cards.get("02079")?.name).toBe("Gildor Inglorion");
    expect(deck.cards.some((row) => row.code === "02079")).toBe(true);
  });
});
