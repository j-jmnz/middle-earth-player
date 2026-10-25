import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { deckSaveRefusal, type DeckSaveCard } from "../../src/catalog/deck-save.ts";
import { prebuiltDecksSchema } from "../../src/catalog/prebuilt-deck.ts";
import { parseDecklist } from "./decklists.ts";
import { loadCards } from "./load-cards.ts";
import { prebuiltIndexSchema } from "./prebuilt-decks.ts";
import { DATA_DIR } from "./paths.ts";
import type { RuleEntry } from "./rules/spans.ts";

// The pre-built player decks (data/decks/prebuilt.json). The four core decks are what the Learn to Play prints on page 5
// (ltp.starter-decks); the build resolves them against RingsDB's Revised Core Set. Every other deck is a decklist an official
// product prints (a `decklist.*` span); the starter decks are also checked against DragnCards and their product's contents.
const entries = JSON.parse(readFileSync(path.join(DATA_DIR, "rules", "entries.json"), "utf8")) as RuleEntry[];
const { aliases, decks: index } = prebuiltIndexSchema.parse(JSON.parse(readFileSync(path.join(DATA_DIR, "prebuilt-decks.json"), "utf8")) as unknown);
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
    const ours = index.flatMap((entry) => ("collectors" in entry ? [entry] : []));
    expect(ours.map((entry) => ({ name: entry.name, heroes: entry.heroes, from: entry.collectors.from, to: entry.collectors.to, extra: entry.plus }))).toEqual(
      printed.map((deck) => ({ name: deck.name, heroes: deck.heroes, from: deck.from, to: deck.to, extra: [{ collector: deck.extra, count: 2 }] })),
    );
  });

  it("uses every alias, so none outlives the decklist it was written for", () => {
    const rows = index.flatMap((entry) => ("sets" in entry ? parseDecklist(entries.find((item) => item.id === entry.span)?.text ?? "").rows : []));
    const unused = aliases.filter(
      (alias) =>
        !rows.some(
          (row) =>
            row.name === alias.printed &&
            (alias.qualifier === undefined || alias.qualifier === row.qualifier) &&
            (alias.collector === undefined || alias.collector === row.collector),
        ),
    );
    expect(unused).toEqual([]);
  });

  // The printed sizes: the Learn to Play's first-game decks are 47 cards, which a saved deck may not be (rr.deckbuilding);
  // the Dream-chaser Ruling Steward list prints 51 and On the Doorstep's second list 52.
  const SIZE: Readonly<Record<string, number>> = { "core-leadership": 47, "core-tactics": 47, "core-spirit": 47, "core-lore": 47, "ruling-steward": 51, "on-the-doorstep-2": 52 };

  for (const deck of decks) {
    const entry = index.find((item) => item.id === deck.id);
    it(`${deck.name}: heroes are heroes and no hero is a deck card`, () => {
      expect(deck.heroes.map((code) => cards.get(code)?.type)).toEqual(["hero", "hero", "hero"]);
      expect(deck.cards.filter((slot) => cards.get(slot.code)?.type === "hero")).toEqual([]);
    });

    const size = SIZE[deck.id] ?? 50;
    it(`${deck.name}: is ${size} cards${size < 50 ? ", so saving it asks for 3 more" : " and saves"}`, () => {
      expect(deck.cards.reduce((total, slot) => total + slot.count, 0)).toBe(size);
      expect(deckSaveRefusal(deck.heroes, deck.cards, facts, [])?.rule ?? null).toBe(size < 50 ? "At least 50 cards." : null);
    });

    if (entry && "sets" in entry) {
      it(`${deck.name}: has the printed rows' cards, with the counts the deck chooses`, () => {
        const rows = parseDecklist(entries.find((item) => item.id === entry.span)?.text ?? "").rows;
        const printed = rows.filter((row) => row.section !== "hero").reduce((total, row) => total + (entry.counts?.[row.name] ?? row.max), 0);
        expect(deck.cards.reduce((total, slot) => total + slot.count, 0)).toBe(printed);
        expect(rows.filter((row) => row.section === "hero")).toHaveLength(3);
      });
    }
  }
});
