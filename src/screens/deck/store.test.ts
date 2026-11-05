import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import migrations from "../../../drizzle/migrations";
import { deleteDeck, duplicateDeck, isStarterDeck, listDecks, newDeckId, readDeck, resetStarterDeck, writeDeck, writeDeckOrder } from "./store.ts";
import { insertStarterDecks, starterDeck, STEALTH_ID, WISDOM_ID } from "./starter-decks.ts";

function openUser() {
  const sqlite = new Database(":memory:");
  for (const entry of migrations.journal.entries) {
    const key = `m${entry.idx.toString().padStart(4, "0")}` as keyof typeof migrations.migrations;
    for (const statement of migrations.migrations[key].split("--> statement-breakpoint")) if (statement.trim()) sqlite.exec(statement.trim());
  }
  return drizzle(sqlite);
}

describe("deck store", () => {
  it("saves a deck that is not ready to play, and rewrites it under the same id", () => {
    const user = openUser();
    const id = writeDeck(user, { id: null, name: "  Hobbits ", heroes: ["141002"], cards: [{ code: "01073", count: 1 }] }, 1000);
    expect(readDeck(user, id)).toEqual({ id, name: "Hobbits", heroes: ["141002"], cards: [{ code: "01073", count: 1 }], updatedAt: 1000 });
    expect(writeDeck(user, { id, name: "Halflings", heroes: [], cards: [] }, 2000)).toBe(id);
    expect(readDeck(user, id)).toMatchObject({ name: "Halflings", heroes: [], cards: [], updatedAt: 2000 });
    expect(listDecks(user)).toHaveLength(1);
  });

  it("lists the deck saved last first, and the starters after", () => {
    const user = openUser();
    insertStarterDecks(user);
    const older = writeDeck(user, { id: null, name: "Older", heroes: [], cards: [] }, 1000);
    const newer = writeDeck(user, { id: null, name: "Newer", heroes: [], cards: [] }, 2000);
    expect(listDecks(user).map((deck) => deck.id)).toEqual([newer, older, STEALTH_ID, WISDOM_ID]);
  });

  it("duplicates a deck under a new id and name", () => {
    const user = openUser();
    insertStarterDecks(user);
    const copy = duplicateDeck(user, STEALTH_ID, "Stealth and Steadfastness copy", 3000);
    const printed = starterDeck(STEALTH_ID);
    expect(copy).toMatchObject({ name: "Stealth and Steadfastness copy", heroes: printed.heroes, cards: printed.cards, updatedAt: 3000 });
    expect(copy?.id).not.toBe(STEALTH_ID);
    expect(isStarterDeck(copy?.id ?? "")).toBe(false);
    expect(duplicateDeck(user, "missing", "x")).toBeNull();
  });

  it("deletes a deck of the player's own, and resets a starter instead of deleting it", () => {
    const user = openUser();
    insertStarterDecks(user);
    const id = writeDeck(user, { id: null, name: "Mine", heroes: [], cards: [] });
    deleteDeck(user, id);
    expect(readDeck(user, id)).toBeNull();
    expect(() => deleteDeck(user, STEALTH_ID)).toThrow("Reset it instead");
    writeDeck(user, { id: STEALTH_ID, name: "Changed", heroes: [], cards: [] }, 5000);
    resetStarterDeck(user, STEALTH_ID);
    const printed = starterDeck(STEALTH_ID);
    expect(readDeck(user, STEALTH_ID)).toEqual({ ...printed, updatedAt: null });
  });
});

describe("newDeckId", () => {
  it("is the time and an eight-character random tail, without crypto", () => {
    expect(newDeckId(0, () => 0)).toBe("deck-0-00000000");
    expect(newDeckId(36, () => 0.5)).toBe("deck-10-i0000000");
  });

  it("differs between two decks saved in the same millisecond", () => {
    expect(newDeckId(1000)).not.toBe(newDeckId(1000));
  });
});

describe("deck order", () => {
  it("keeps a dragged order, with a deck that has no position ahead of it", () => {
    const user = openUser();
    insertStarterDecks(user);
    const first = writeDeck(user, { id: null, name: "First", heroes: [], cards: [] }, 1000);
    const second = writeDeck(user, { id: null, name: "Second", heroes: [], cards: [] }, 2000);
    expect(listDecks(user).map((deck) => deck.id)).toEqual([second, first, STEALTH_ID, WISDOM_ID]);

    writeDeckOrder(user, [STEALTH_ID, first, WISDOM_ID, second]);
    expect(listDecks(user).map((deck) => deck.id)).toEqual([STEALTH_ID, first, WISDOM_ID, second]);

    // A new deck has no position and leads; saving an ordered deck keeps its place.
    const fresh = writeDeck(user, { id: null, name: "Fresh", heroes: [], cards: [] }, 3000);
    writeDeck(user, { id: second, name: "Second, edited", heroes: [], cards: [] }, 4000);
    expect(listDecks(user).map((deck) => deck.id)).toEqual([fresh, STEALTH_ID, first, WISDOM_ID, second]);
  });

  it("orders several decks with no position as it always did", () => {
    const user = openUser();
    insertStarterDecks(user);
    const older = writeDeck(user, { id: null, name: "Older", heroes: [], cards: [] }, 1000);
    writeDeckOrder(user, [STEALTH_ID, WISDOM_ID, older]);
    const a = writeDeck(user, { id: null, name: "A", heroes: [], cards: [] }, 5000);
    const b = writeDeck(user, { id: null, name: "B", heroes: [], cards: [] }, 6000);
    expect(listDecks(user).map((deck) => deck.id)).toEqual([b, a, STEALTH_ID, WISDOM_ID, older]);
  });

  it("ignores ids that are not decks and survives a reset or a delete", () => {
    const user = openUser();
    insertStarterDecks(user);
    const mine = writeDeck(user, { id: null, name: "Mine", heroes: [], cards: [] }, 1000);
    writeDeckOrder(user, [mine, "gone", WISDOM_ID, STEALTH_ID]);
    resetStarterDeck(user, WISDOM_ID);
    expect(listDecks(user).map((deck) => deck.id)).toEqual([mine, WISDOM_ID, STEALTH_ID]);
    deleteDeck(user, mine);
    expect(listDecks(user).map((deck) => deck.id)).toEqual([WISDOM_ID, STEALTH_ID]);
  });
});
