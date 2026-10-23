import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { decks } from "./user-schema";

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

/**
 * Printed lists. Codes were resolved against assets/catalog.db.
 * Dwarven Tomb's booklet collector is 63. The only catalog row is 01053 at position 53.
 */
export const starterPrints: readonly StarterPrint[] = [
  { deckId: STEALTH_ID, name: "Sam Gamgee", collector: 3, typeCode: "hero", count: 1, code: "141002" },
  { deckId: STEALTH_ID, name: "Merry", collector: 4, typeCode: "hero", count: 1, code: "141003" },
  { deckId: STEALTH_ID, name: "Pippin", collector: 6, typeCode: "hero", count: 1, code: "141004" },
  { deckId: STEALTH_ID, name: "Bill the Pony", collector: 8, typeCode: "ally", count: 3, code: "141006" },
  { deckId: STEALTH_ID, name: "Boromir", collector: 11, typeCode: "ally", count: 2, code: "142004" },
  { deckId: STEALTH_ID, name: "Faramir", collector: 14, typeCode: "ally", count: 2, code: "01014" },
  { deckId: STEALTH_ID, name: "Veteran Axehand", collector: 28, typeCode: "ally", count: 2, code: "01028" },
  { deckId: STEALTH_ID, name: "Beorn", collector: 31, typeCode: "ally", count: 2, code: "01031" },
  { deckId: STEALTH_ID, name: "Erebor Hammersmith", collector: 59, typeCode: "ally", count: 3, code: "01059" },
  { deckId: STEALTH_ID, name: "Henamarth Riversong", collector: 60, typeCode: "ally", count: 2, code: "01060" },
  { deckId: STEALTH_ID, name: "Gléowine", collector: 62, typeCode: "ally", count: 2, code: "01062" },
  { deckId: STEALTH_ID, name: "Gandalf", collector: 73, typeCode: "ally", count: 3, code: "01073" },
  { deckId: STEALTH_ID, name: "Hobbit Cloak", collector: 10, typeCode: "attachment", count: 3, code: "141013" },
  { deckId: STEALTH_ID, name: "Dagger of Westernesse", collector: 13, typeCode: "attachment", count: 3, code: "141014" },
  { deckId: STEALTH_ID, name: "Elf-stone", collector: 20, typeCode: "attachment", count: 3, code: "141016" },
  { deckId: STEALTH_ID, name: "Steward of Gondor", collector: 26, typeCode: "attachment", count: 1, code: "01026" },
  { deckId: STEALTH_ID, name: "Celebrían's Stone", collector: 27, typeCode: "attachment", count: 1, code: "01027" },
  { deckId: STEALTH_ID, name: "Horn of Gondor", collector: 42, typeCode: "attachment", count: 1, code: "01042" },
  { deckId: STEALTH_ID, name: "Halfling Determination", collector: 14, typeCode: "event", count: 2, code: "141009" },
  { deckId: STEALTH_ID, name: "Frodo's Intuition", collector: 26, typeCode: "event", count: 3, code: "141012" },
  { deckId: STEALTH_ID, name: "Ever Vigilant", collector: 20, typeCode: "event", count: 2, code: "01020" },
  { deckId: STEALTH_ID, name: "Common Cause", collector: 21, typeCode: "event", count: 2, code: "01021" },
  { deckId: STEALTH_ID, name: "Sneak Attack", collector: 23, typeCode: "event", count: 3, code: "01023" },
  { deckId: STEALTH_ID, name: "Feint", collector: 34, typeCode: "event", count: 3, code: "01034" },
  { deckId: STEALTH_ID, name: "Quick Strike", collector: 35, typeCode: "event", count: 2, code: "01035" },
  { deckId: WISDOM_ID, name: "Gandalf", collector: 7, typeCode: "hero", count: 1, code: "142002" },
  { deckId: WISDOM_ID, name: "Théodred", collector: 2, typeCode: "hero", count: 1, code: "01002" },
  { deckId: WISDOM_ID, name: "Éowyn", collector: 7, typeCode: "hero", count: 1, code: "01007" },
  { deckId: WISDOM_ID, name: "Galadriel", collector: 9, typeCode: "ally", count: 3, code: "142003" },
  { deckId: WISDOM_ID, name: "Bilbo Baggins", collector: 15, typeCode: "ally", count: 3, code: "142006" },
  { deckId: WISDOM_ID, name: "Faramir", collector: 14, typeCode: "ally", count: 1, code: "01014" },
  { deckId: WISDOM_ID, name: "Snowbourn Scout", collector: 16, typeCode: "ally", count: 3, code: "01016" },
  { deckId: WISDOM_ID, name: "Wandering Took", collector: 43, typeCode: "ally", count: 3, code: "01043" },
  { deckId: WISDOM_ID, name: "Northern Tracker", collector: 45, typeCode: "ally", count: 3, code: "01045" },
  { deckId: WISDOM_ID, name: "Gandalf's Staff", collector: 22, typeCode: "attachment", count: 3, code: "142008" },
  { deckId: WISDOM_ID, name: "Wizard Pipe", collector: 23, typeCode: "attachment", count: 3, code: "142009" },
  { deckId: WISDOM_ID, name: "Fellowship of the Ring", collector: 25, typeCode: "attachment", count: 2, code: "142010" },
  { deckId: WISDOM_ID, name: "Steward of Gondor", collector: 26, typeCode: "attachment", count: 2, code: "01026" },
  { deckId: WISDOM_ID, name: "Celebrían's Stone", collector: 27, typeCode: "attachment", count: 1, code: "01027" },
  { deckId: WISDOM_ID, name: "Unexpected Courage", collector: 57, typeCode: "attachment", count: 3, code: "01057" },
  { deckId: WISDOM_ID, name: "Flame of Anor", collector: 24, typeCode: "event", count: 3, code: "142007" },
  { deckId: WISDOM_ID, name: "Ever Vigilant", collector: 20, typeCode: "event", count: 1, code: "01020" },
  { deckId: WISDOM_ID, name: "Common Cause", collector: 21, typeCode: "event", count: 1, code: "01021" },
  { deckId: WISDOM_ID, name: "Valiant Sacrifice", collector: 24, typeCode: "event", count: 2, code: "01024" },
  { deckId: WISDOM_ID, name: "Grim Resolve", collector: 25, typeCode: "event", count: 1, code: "01025" },
  { deckId: WISDOM_ID, name: "The Galadhrim's Greeting", collector: 46, typeCode: "event", count: 1, code: "01046" },
  { deckId: WISDOM_ID, name: "Hasty Stroke", collector: 48, typeCode: "event", count: 3, code: "01048" },
  { deckId: WISDOM_ID, name: "A Test of Will", collector: 50, typeCode: "event", count: 3, code: "01050" },
  { deckId: WISDOM_ID, name: "Stand and Fight", collector: 51, typeCode: "event", count: 3, code: "01051" },
  { deckId: WISDOM_ID, name: "Dwarven Tomb", collector: 63, typeCode: "event", count: 2, code: "01053" },
];

const STARTER_NAMES: Record<string, string> = {
  [STEALTH_ID]: "Stealth and Steadfastness",
  [WISDOM_ID]: "Wisdom and Wizardry",
};

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
  const rows = starterPrints.filter((row) => row.deckId === id);
  const name = STARTER_NAMES[id];
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
const seedListeners = new Set<() => void>();

function publishSeed(next: StarterSeed): void {
  if (seedStatus === next) return;
  seedStatus = next;
  for (const listener of seedListeners) listener();
}

export function starterSeedStatus(): StarterSeed {
  return seedStatus;
}

export function subscribeStarterSeed(listener: () => void): () => void {
  seedListeners.add(listener);
  return () => {
    seedListeners.delete(listener);
  };
}

export function markStarterSeedReady(): void {
  publishSeed("ready");
}

export function markStarterSeedMissing(): void {
  publishSeed("missing");
}

/** Marks the seed ready only when the insert returns. A throw leaves the starters missing. */
export function completeStarterInsert(run: () => void): void {
  try {
    run();
  } catch (error: unknown) {
    const reason = error instanceof Error ? error : new Error("Starter decks were not inserted");
    console.warn(reason.message);
    markStarterSeedMissing();
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
  for (const deck of startersToInsert(existing)) {
    user.insert(decks).values({
      id: deck.id,
      name: deck.name,
      heroes: [...deck.heroes],
      cards: deck.cards.map((card) => ({ code: card.code, count: card.count })),
    }).run();
  }
}
