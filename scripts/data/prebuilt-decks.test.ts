import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { deckSaveRefusal, type DeckSaveCard } from "../../src/catalog/deck-save.ts";
import { prebuiltDecksSchema } from "../../src/catalog/prebuilt-deck.ts";
import { loadCards } from "./load-cards.ts";
import { prebuiltIndexSchema } from "./prebuilt-decks.ts";
import { DATA_DIR } from "./paths.ts";
import type { RuleEntry } from "./rules/spans.ts";

// The pre-built player decks (data/decks/prebuilt.json). The four core decks are what the Learn to Play prints on page 5
// (ltp.starter-decks); the build resolves them against RingsDB's Revised Core Set. The four starter decks are DragnCards'
// lists, and the build checks that each is exactly its product's contents.
const entries = JSON.parse(readFileSync(path.join(DATA_DIR, "rules", "entries.json"), "utf8")) as RuleEntry[];
const index = prebuiltIndexSchema.parse(JSON.parse(readFileSync(path.join(DATA_DIR, "prebuilt-decks.json"), "utf8")) as unknown);
const decks = prebuiltDecksSchema.parse(JSON.parse(readFileSync(path.join(DATA_DIR, "decks", "prebuilt.json"), "utf8")) as unknown);
const cards = new Map(loadCards().map((card) => [card.code, card]));

const facts = new Map<string, DeckSaveCard>(
  [...cards.values()].map((card) => [
    card.code,
    { name: card.name, typeCode: card.type, sphereCode: card.sphere, deckLimit: card.deckLimit, deckLegal: card.deckLegal, traits: card.traits.map((trait) => `${trait}.`).join(" ") },
  ]),
);

type PrintedDeck = { name: string; heroes: string[]; from: number; to: number; extra: number };

// "Leadership Deck … Heroes: Aragorn, Théodred, Glóin Cards: All copies of cards numbered 13–27 and two copies of card 73"
function printedDecks(text: string): PrintedDeck[] {
  const flat = text.replace(/\s+/g, " ");
  return [...flat.matchAll(/(\w+) Deck \S+ .*?Heroes: (.+?) Cards: All copies of cards numbered (\d+)–(\d+) and two copies of card 73/g)].map((match) => ({
    name: `${match[1] ?? ""} Deck`,
    heroes: (match[2] ?? "").split(", "),
    from: Number(match[3]),
    to: Number(match[4]),
    extra: 73,
  }));
}

describe("pre-built decks", () => {
  it("builds every deck the index names, in its order", () => {
    expect(decks.map((deck) => deck.id)).toEqual(index.map((entry) => entry.id));
  });

  it("the core decks are the four the Learn to Play prints", () => {
    const span = entries.find((entry) => entry.id === "ltp.starter-decks");
    expect(span?.doc).toBe("learn-to-play");
    const printed = printedDecks(span?.text ?? "");
    expect(printed.map((deck) => deck.name)).toEqual(["Leadership Deck", "Tactics Deck", "Spirit Deck", "Lore Deck"]);
    const ours = index.flatMap((entry) => ("span" in entry && entry.span === "ltp.starter-decks" ? [entry] : []));
    expect(ours.map((entry) => ({ name: entry.name, heroes: entry.heroes, from: entry.collectors.from, to: entry.collectors.to, extra: entry.plus }))).toEqual(
      printed.map((deck) => ({ name: deck.name, heroes: deck.heroes, from: deck.from, to: deck.to, extra: [{ collector: deck.extra, count: 2 }] })),
    );
  });

  for (const deck of decks) {
    it(`${deck.name}: heroes are heroes and no hero is a deck card`, () => {
      expect(deck.heroes.map((code) => cards.get(code)?.type)).toEqual(["hero", "hero", "hero"]);
      expect(deck.cards.filter((slot) => cards.get(slot.code)?.type === "hero")).toEqual([]);
    });

    // The Learn to Play's first-game decks are 47 cards; a saved deck needs 50 (rr.deckbuilding).
    const core = deck.source === "ltp.starter-decks";
    it(`${deck.name}: ${core ? "is 47 cards, so saving it asks for 3 more" : "is a legal 50-card deck"}`, () => {
      expect(deck.cards.reduce((total, slot) => total + slot.count, 0)).toBe(core ? 47 : 50);
      expect(deckSaveRefusal(deck.heroes, deck.cards, facts, [])?.rule ?? null).toBe(core ? "At least 50 cards." : null);
    });
  }
});
