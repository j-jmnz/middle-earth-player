// The deck screens say how much of a deck the app does not apply (docs/plans/done/inactive-text.md): a count on the deck list,
// the editor and the briefing, each card's loss in its row, and a count on each pre-built deck the import screen offers.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { textCheck } from "../catalog/active-text";
import { shippedLedger } from "../catalog/printed-ledger";
import { EFFECTS } from "../effects";
import { notAppliedCodes, notAppliedWords } from "../play/cards/not-applied";
import { prebuiltDecks, prebuiltNotApplied, withNotApplied } from "./deck-import";
import { notAppliedCards, notAppliedLine } from "./deck-status";

// The catalog's card text, from data/cards (the phone reads the same rows from catalog.db).
function texts(): [string, string | null][] {
  const dir = path.join(__dirname, "../../data/cards");
  return readdirSync(dir).flatMap((file) => (JSON.parse(readFileSync(path.join(dir, file), "utf8")) as { code: string; text: string | null; errata: string | null }[]).map((card): [string, string | null] => [card.code, card.errata ?? card.text]));
}

describe("not applied on the deck screens", () => {
  it("counts the copies a deck holds, heroes included, and names each title once", () => {
    const inactive = new Set(["a", "h"]);
    const deck = { heroes: ["h", "k"], cards: [{ code: "a", count: 3 }, { code: "b", count: 2 }] };
    expect(notAppliedCards(deck, inactive)).toEqual([
      { code: "h", copies: 1 },
      { code: "a", copies: 3 },
    ]);
    expect(notAppliedLine(deck, inactive)).toBe("4 cards with text not applied");
    expect(notAppliedLine({ heroes: ["k"], cards: [] }, inactive)).toBeNull();
  });

  it("words a row's loss by type", () => {
    // Every card is meant to have records; these three have theirs taken away to show the words.
    const unread = new Set(["02003", "02053", "02026"]);
    const check = textCheck(EFFECTS.filter((effect) => !unread.has(effect.cardCode)), shippedLedger());
    expect(notAppliedWords("02003", "event", check)).toBe("Cannot be played");
    expect(notAppliedWords("02053", "ally", check)).toBe("Ability not applied");
    expect(notAppliedWords("02026", "attachment", check)).toBe("Text not applied");
  });

  it("counts each pre-built deck: the four core decks are applied in full, and a deck with an unapplied card says how many", () => {
    const inactive = notAppliedCodes(texts());
    const byId = new Map(prebuiltDecks().map((deck) => [deck.id, deck]));
    for (const id of ["core-leadership", "core-tactics", "core-spirit", "core-lore"]) {
      const deck = byId.get(id);
      expect(deck && prebuiltNotApplied(deck, inactive), id).toBeNull();
    }
    const elves = byId.get("elves-of-lorien");
    const hero = elves?.heroes[0] ?? "";
    expect(elves && prebuiltNotApplied(elves, new Set([...inactive, hero]))).toMatch(/^\d+ of \d+ cards with text not applied$/);
    expect(withNotApplied("Galadriel", "3 of 50 cards with text not applied")).toBe("Galadriel · 3 of 50 cards with text not applied");
  });
});
