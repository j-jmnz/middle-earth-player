import { desc, eq, isNotNull, isNull } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { parseSeatCount } from "../campaign/save";
import { parseStandaloneActive, parseStandaloneLoadout, parseStandaloneResult, type StandaloneGame } from "../campaign/standalone";
import { stored } from "./campaign-store";
import { standaloneGames } from "./user-schema";

// user.db `standalone_games`, read and written whole. The rules stay in src/campaign/standalone.ts.
type UserDb<TRun> = BaseSQLiteDatabase<"sync", TRun>;

// A game as read, and whether an open game was stored but did not read, so the player is told it is gone.
export type ReadStandalone = { game: StandaloneGame; unreadable: boolean };

function parseRow(row: typeof standaloneGames.$inferSelect): ReadStandalone {
  // The open game is only a cache of the intents: when it or the loadout does not read, it is dropped and the row stays.
  const loadout = parseStandaloneLoadout(row.loadout);
  const parsed = parseStandaloneActive(row.activeScenario);
  const active = loadout ? parsed : null;
  const unreadable = row.activeScenario != null && active == null;
  return {
    game: { id: row.id, campaignId: row.campaignId, scenarioId: row.scenarioId, seatCount: parseSeatCount(row.seatCount), loadout, active, result: parseStandaloneResult(row.result) },
    unreadable,
  };
}

// The open games, the newest first. An archived game is listed by listArchivedStandalone.
export function listStandalone<TRun>(user: UserDb<TRun>): StandaloneGame[] {
  return user.select().from(standaloneGames).where(isNull(standaloneGames.archivedAt)).orderBy(desc(standaloneGames.createdAt)).all().map((row) => parseRow(row).game);
}

// The archived games, the last one put away first.
export function listArchivedStandalone<TRun>(user: UserDb<TRun>): StandaloneGame[] {
  return user.select().from(standaloneGames).where(isNotNull(standaloneGames.archivedAt)).orderBy(desc(standaloneGames.archivedAt)).all().map((row) => parseRow(row).game);
}

export function readStandalone<TRun>(user: UserDb<TRun>, id: string): ReadStandalone | null {
  const row = user.select().from(standaloneGames).where(eq(standaloneGames.id, id)).get();
  return row ? parseRow(row) : null;
}

// Writes the game. A new row is stamped with `now`; an existing one keeps its time and its archive mark.
export function writeStandalone<TRun>(user: UserDb<TRun>, game: StandaloneGame, now: number = Date.now()): void {
  const values = {
    campaignId: game.campaignId,
    scenarioId: game.scenarioId,
    seatCount: game.seatCount,
    // A loadout that no longer read stays unreadable: `{}` reads back as none.
    loadout: stored(game.loadout ?? {}),
    activeScenario: game.active ? stored(game.active) : null,
    result: game.result ? stored(game.result) : null,
  };
  user
    .insert(standaloneGames)
    .values({ id: game.id, createdAt: now, ...values })
    .onConflictDoUpdate({ target: standaloneGames.id, set: values })
    .run();
}

export function archiveStandalone<TRun>(user: UserDb<TRun>, id: string, now: number = Date.now()): void {
  user.update(standaloneGames).set({ archivedAt: now }).where(eq(standaloneGames.id, id)).run();
}

export function restoreStandalone<TRun>(user: UserDb<TRun>, id: string): void {
  user.update(standaloneGames).set({ archivedAt: null }).where(eq(standaloneGames.id, id)).run();
}

// Deleting removes the game for good. Decks are not part of it.
export function deleteStandalone<TRun>(user: UserDb<TRun>, id: string): void {
  user.delete(standaloneGames).where(eq(standaloneGames.id, id)).run();
}

let made = 0;

// An id for a new game; the deal writes the row.
export function newStandaloneId(now: number = Date.now()): string {
  made += 1;
  return `game-${now.toString(36)}-${made.toString(36)}`;
}
