import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { campaignOf } from "../data/campaign-data";
import { bumpDeckRevision } from "./revision";
import { decks } from "../data/user-schema";

export const STEALTH_ID = "stealth-and-steadfastness";
export const WISDOM_ID = "wisdom-and-wizardry";

export const STARTER_NOTE =
  "When both decks are used together, replace the three copies of Gandalf in Stealth and Steadfastness with three copies of Elrond.";

const STARTER_PACKS = new Set(["Core", "RevCore", "TBR", "TRD"]);
const SAGA_PACKS = new Set(["TBR", "TRD"]);

export type StarterCandidate = {
  code: string;
  name: string;
  typeCode: string;
  packCode: string;
  packCodes: string[];
  position: number;
};

export type StarterPrint = {
  deckId: string;
  name: string;
  collector: number;
  typeCode: "hero" | "ally" | "attachment" | "event";
  count: number;
  code: string;
};

export type StarterDeck = {
  id: string;
  name: string;
  heroes: string[];
  cards: { code: string; count: number }[];
};

// The printed starter decks, from the Fellowship campaign campaign-data.ts already parses (once, when first asked).
function starterDecks() {
  return campaignOf("fellowship-of-the-ring")?.starterDecks ?? [];
}

let prints: readonly StarterPrint[] | null = null;

/**
 * The printed lists, from data/campaigns/fellowship-of-the-ring.json (data/starter-decks.json, checked against the
 * MEC109 span each deck names). Codes were resolved against assets/catalog.db.
 * Dwarven Tomb's booklet collector is 63. The only catalog row is 01053 at position 53.
 */
export function starterPrints(): readonly StarterPrint[] {
  prints ??= starterDecks().flatMap((deck) =>
    deck.rows.map((row) => ({ deckId: deck.id, name: row.name, collector: row.collector, typeCode: row.type, count: row.count, code: row.code })),
  );
  return prints;
}

function packHits(card: StarterCandidate, packs: ReadonlySet<string>): boolean {
  if (packs.has(card.packCode)) return true;
  return card.packCodes.some((code) => packs.has(code));
}

function oneRow(printed: { name: string; typeCode: string; collector: number }, rows: readonly StarterCandidate[]): string {
  const row = rows.length === 1 ? rows[0] : undefined;
  if (!row) {
    const codes = rows.map((candidate) => candidate.code).join(", ");
    throw new Error(
      `Starter ${printed.name} (${printed.typeCode}) collector ${printed.collector} is not one row: ${codes || "none"}`,
    );
  }
  return row.code;
}

export function resolveStarterCode(
  candidates: readonly StarterCandidate[],
  printed: { name: string; typeCode: string; collector: number },
): string {
  const eligible = candidates.filter(
    (card) => card.name === printed.name && card.typeCode === printed.typeCode && packHits(card, STARTER_PACKS),
  );
  const positioned = eligible.filter((card) => card.position === printed.collector);
  if (positioned.length > 0) {
    const revised = positioned.filter((card) => card.packCode === "RevCore");
    return oneRow(printed, revised.length > 0 ? revised : positioned);
  }
  const saga = eligible.filter((card) => packHits(card, SAGA_PACKS));
  if (saga.length === 1) {
    const row = saga[0];
    if (!row) throw new Error(`Starter ${printed.name} is not one row: none`);
    return row.code;
  }
  if (saga.length > 1) return oneRow(printed, saga);
  // Booklet collector did not match a RingsDB position, and the card is not in TBR or TRD.
  // One remaining starter-pack row is that card. Several would be a guess.
  return oneRow(printed, eligible);
}

export function starterDeck(id: string): StarterDeck {
  const rows = starterPrints().filter((row) => row.deckId === id);
  const name = starterDecks().find((deck) => deck.id === id)?.name;
  if (!name) throw new Error(`Unknown starter ${id}`);
  return {
    id,
    name,
    heroes: rows.filter((row) => row.typeCode === "hero").map((row) => row.code),
    cards: rows
      .filter((row) => row.typeCode !== "hero")
      .map((row) => ({ code: row.code, count: row.count })),
  };
}

export function startersToInsert(existingIds: readonly string[]): StarterDeck[] {
  const present = new Set(existingIds);
  return [STEALTH_ID, WISDOM_ID].filter((id) => !present.has(id)).map((id) => starterDeck(id));
}

export type StarterSeed = "pending" | "ready" | "missing";

let seedStatus: StarterSeed = "pending";
let seedReason: string | null = null;
const seedListeners = new Set<() => void>();

function publishSeed(next: StarterSeed): void {
  if (seedStatus === next) return;
  seedStatus = next;
  for (const listener of seedListeners) listener();
}

export function starterSeedStatus(): StarterSeed {
  return seedStatus;
}

/** Why the starters are missing: the thrown message, which names the card and its collector number. Null otherwise. */
export function starterSeedReason(): string | null {
  return seedReason;
}

export function subscribeStarterSeed(listener: () => void): () => void {
  seedListeners.add(listener);
  return () => {
    seedListeners.delete(listener);
  };
}

export function markStarterSeedReady(): void {
  seedReason = null;
  publishSeed("ready");
}

export function markStarterSeedMissing(reason: string | null = null): void {
  seedReason = reason;
  publishSeed("missing");
}

/** Marks the seed ready only when the insert returns. A throw leaves the starters missing. */
export function completeStarterInsert(run: () => void): void {
  try {
    run();
  } catch (error: unknown) {
    const reason = error instanceof Error ? error : new Error("Starter decks were not inserted");
    console.warn(reason.message);
    markStarterSeedMissing(reason.message);
    return;
  }
  markStarterSeedReady();
}

export function insertStarterDecks<TRun>(user: BaseSQLiteDatabase<"sync", TRun>): void {
  const existing = user
    .select({ id: decks.id })
    .from(decks)
    .all()
    .map((row) => row.id);
  const missing = startersToInsert(existing);
  for (const deck of missing) {
    user.insert(decks).values({
      id: deck.id,
      name: deck.name,
      heroes: [...deck.heroes],
      cards: deck.cards.map((card) => ({ code: card.code, count: card.count })),
    }).run();
  }
  if (missing.length > 0) bumpDeckRevision();
}
