import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { cards } from "../../catalog/schema";
import { notAppliedCodes } from "../../play/cards/not-applied";
import type { DeckFace } from "./status";
import { STEALTH_ID, WISDOM_ID, starterDeck } from "./starter-decks";
import { decks, type DeckCard } from "../data/user-schema";

// user.db `decks`, read and written whole. The deck screens and the briefing call these.
type Db<TRun> = BaseSQLiteDatabase<"sync", TRun>;

export type SavedDeck = {
  id: string;
  name: string;
  heroes: string[];
  cards: DeckCard[];
  updatedAt: number | null;
};

export type DeckWrite = {
  // Null for a deck that is not in user.db yet.
  id: string | null;
  name: string;
  heroes: readonly string[];
  cards: readonly DeckCard[];
};

const STARTER_IDS: ReadonlySet<string> = new Set([STEALTH_ID, WISDOM_ID]);

/** A starter deck is put back on launch when it is missing, so it is reset rather than deleted. */
export function isStarterDeck(id: string): boolean {
  return STARTER_IDS.has(id);
}

// Hermes has no global `crypto`, so a saved deck's id is the time and a random tail rather than `crypto.randomUUID()`.
// The `deck-` prefix keeps it apart from a starter deck's slug.
export function newDeckId(now: number = Date.now(), random: () => number = Math.random): string {
  return `deck-${now.toString(36)}-${Math.floor(random() * 36 ** 8).toString(36).padStart(8, "0")}`;
}

const columns = { id: decks.id, name: decks.name, heroes: decks.heroes, cards: decks.cards, updatedAt: decks.updatedAt };

/**
 * Every saved deck in the player's order: the decks with no position first (new, imported or duplicated ones; the one saved last
 * first, then rows never saved since 0005 in the order they were made), then the dragged order by position.
 */
export function listDecks<TRun>(user: Db<TRun>): SavedDeck[] {
  return user
    .select(columns)
    .from(decks)
    .orderBy(sql`${decks.position} is not null`, asc(decks.position), desc(decks.updatedAt), asc(sql`rowid`))
    .all();
}

/** Stores the list's order: position 0..n-1 for these ids, in one transaction. Ids that are not saved decks are ignored. */
export function writeDeckOrder<TRun>(user: Db<TRun>, ids: readonly string[]): void {
  user.transaction((tx) => {
    ids.forEach((id, position) => {
      tx.update(decks).set({ position }).where(eq(decks.id, id)).run();
    });
  });
}

export function readDeck<TRun>(user: Db<TRun>, id: string): SavedDeck | null {
  return user.select(columns).from(decks).where(eq(decks.id, id)).get() ?? null;
}

function copied(deck: Pick<DeckWrite, "heroes" | "cards">): { heroes: string[]; cards: DeckCard[] } {
  return { heroes: [...deck.heroes], cards: deck.cards.map((card) => ({ code: card.code, count: card.count })) };
}

/** Inserts a new deck or rewrites a saved one, and returns its id. A deck saves whether or not it is ready to play. */
export function writeDeck<TRun>(user: Db<TRun>, deck: DeckWrite, now: number = Date.now()): string {
  const body = { name: deck.name.trim(), ...copied(deck), updatedAt: now };
  if (deck.id && readDeck(user, deck.id)) {
    user.update(decks).set(body).where(eq(decks.id, deck.id)).run();
    return deck.id;
  }
  const id = newDeckId(now);
  user.insert(decks).values({ id, ...body }).run();
  return id;
}

/** A new deck with the same heroes and cards under `name`. */
export function duplicateDeck<TRun>(user: Db<TRun>, id: string, name: string, now: number = Date.now()): SavedDeck | null {
  const source = readDeck(user, id);
  if (!source) return null;
  const copy = writeDeck(user, { id: null, name, heroes: source.heroes, cards: source.cards }, now);
  return readDeck(user, copy);
}

export function deleteDeck<TRun>(user: Db<TRun>, id: string): void {
  if (isStarterDeck(id)) throw new Error(`${id} is a starter deck. Reset it instead.`);
  user.delete(decks).where(eq(decks.id, id)).run();
}

/** Puts a starter deck back to the printed list (MEC109) under its printed name. */
export function resetStarterDeck<TRun>(user: Db<TRun>, id: string): void {
  const printed = starterDeck(id);
  user.update(decks).set({ name: printed.name, ...copied(printed), updatedAt: null }).where(eq(decks.id, id)).run();
}

/** The catalog facts the deck screens show and the deckbuilding rules read, for these codes. */
export function deckFaces<TRun>(catalog: Db<TRun>, codes: Iterable<string>): Map<string, DeckFace> {
  const unique = [...new Set(codes)];
  if (unique.length === 0) return new Map();
  const rows = catalog
    .select({
      code: cards.code,
      name: cards.name,
      typeCode: cards.typeCode,
      typeName: cards.typeName,
      sphereCode: cards.sphereCode,
      sphereName: cards.sphereName,
      deckLimit: cards.deckLimit,
      deckLegal: cards.deckLegal,
      traits: cards.traits,
      imagesrc: cards.imagesrc,
      threat: cards.threat,
      text: cards.text,
      errata: cards.errata,
      cost: cards.cost,
    })
    .from(cards)
    .where(inArray(cards.code, unique))
    .all();
  // The errata is the text the card has now (brief, Decisions: errata wins).
  return new Map(rows.map(({ errata, ...row }) => [row.code, { ...row, text: errata ?? row.text }]));
}

/** The codes among these faces with a printed line the app does not apply (src/play/cards/not-applied.ts). */
export function notAppliedIn(faces: ReadonlyMap<string, DeckFace>): ReadonlySet<string> {
  return notAppliedCodes([...faces.values()].map((face) => [face.code, face.text ?? null] as const));
}
