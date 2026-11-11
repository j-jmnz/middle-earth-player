import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { parseSeatCount } from "../../campaign/save";
import { parseCheckpoint, type Checkpoint } from "../../campaign/checkpoint";
import { markedIfStale, parseStandaloneActive, parseStandaloneLoadout, parseStandaloneResult, type ListedStandalone, type StandaloneGame } from "../../campaign/standalone";
import { activeJson, rebaseOf, stored } from "./campaign-store";
import { standaloneGames } from "./user-schema";

// user.db `standalone_games`, read and written whole. The rules stay in src/campaign/standalone.ts.
type UserDb<TRun> = BaseSQLiteDatabase<"sync", TRun>;

// A game as read, and whether an open game was stored but did not read, so the player is told it is gone.
export type ReadStandalone = { game: StandaloneGame; unreadable: boolean };

function parseRow(row: typeof standaloneGames.$inferSelect): ReadStandalone {
  // The open game is only a cache of the intents: when it or the loadout does not read, it is dropped and the row stays.
  const loadout = parseStandaloneLoadout(row.loadout);
  const rebase = rebaseOf(row.rebase);
  const parsed = rebase.unreadable ? null : parseStandaloneActive(row.activeScenario);
  const read = loadout && parsed && rebase.from ? { ...parsed, from: rebase.from } : parsed;
  const active = loadout ? read : null;
  const unreadable = row.activeScenario != null && active == null;
  return {
    game: { id: row.id, campaignId: row.campaignId, scenarioId: row.scenarioId, seatCount: parseSeatCount(row.seatCount), loadout, active, result: parseStandaloneResult(row.result) },
    unreadable,
  };
}

// The columns a list row reads. The open game is read as its engine version, data hash and world stamp (what tells a stale one without a world: the table compares the world when it opens), never its intents.
const listed = {
  id: standaloneGames.id,
  campaignId: standaloneGames.campaignId,
  scenarioId: standaloneGames.scenarioId,
  seatCount: standaloneGames.seatCount,
  loadout: standaloneGames.loadout,
  result: standaloneGames.result,
  engineVersion: sql<number | null>`json_extract(${standaloneGames.activeScenario}, '$.engineVersion')`,
  dataHash: sql<number | null>`json_extract(${standaloneGames.activeScenario}, '$.dataHash')`,
  world: sql<number | null>`json_extract(${standaloneGames.activeScenario}, '$.world')`,
};

function listedRow(row: { id: string; campaignId: string; scenarioId: string; seatCount: number; loadout: unknown; result: unknown; engineVersion: number | null; dataHash: number | null; world: number | null }): ListedStandalone {
  const loadout = parseStandaloneLoadout(row.loadout);
  const open = loadout && typeof row.engineVersion === "number" && typeof row.dataHash === "number";
  return {
    id: row.id,
    campaignId: row.campaignId,
    scenarioId: row.scenarioId,
    seatCount: parseSeatCount(row.seatCount),
    loadout,
    active: open ? { engineVersion: row.engineVersion as number, dataHash: row.dataHash as number, world: typeof row.world === "number" ? row.world : null } : null,
    result: parseStandaloneResult(row.result),
  };
}

// The open games, the newest first. An archived game is listed by listArchivedStandalone.
export function listStandalone<TRun>(user: UserDb<TRun>): ListedStandalone[] {
  return user.select(listed).from(standaloneGames).where(isNull(standaloneGames.archivedAt)).orderBy(desc(standaloneGames.createdAt)).all().map(listedRow);
}

// The open games as a screen shows them: a game in progress from another engine version or against other card data is marked as
// needing a choice (the table asks to continue or restart it). Nothing is written: the row stays as it was stored.
export function listStandaloneMarked<TRun>(user: UserDb<TRun>): ListedStandalone[] {
  return listStandalone(user).map((game) => markedIfStale(game));
}

// The archived games, the last one put away first.
export function listArchivedStandalone<TRun>(user: UserDb<TRun>): ListedStandalone[] {
  return user.select(listed).from(standaloneGames).where(isNotNull(standaloneGames.archivedAt)).orderBy(desc(standaloneGames.archivedAt)).all().map(listedRow);
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
    activeScenario: game.active ? activeJson(game.active) : null,
    result: game.result ? stored(game.result) : null,
    // A game with no open scenario has no checkpoint either; one with an open scenario keeps its (campaign-store.ts, writeSave).
    ...(game.active ? {} : { checkpoint: null }),
    rebase: game.active?.from ? stored(game.active.from) : null,
  };
  user
    .insert(standaloneGames)
    .values({ id: game.id, createdAt: now, ...values })
    .onConflictDoUpdate({ target: standaloneGames.id, set: values })
    .run();
}

// An intent or an Undo changes only the open game: the loadout and the result are not serialized again, and the row keeps its
// time and its archive mark, as writeStandalone leaves them.
export function writeStandaloneActive<TRun>(user: UserDb<TRun>, game: Pick<StandaloneGame, "id" | "active">): void {
  user
    .update(standaloneGames)
    .set({ activeScenario: game.active ? activeJson(game.active) : null })
    .where(eq(standaloneGames.id, game.id))
    .run();
}

// The open game replaced whole: Continue and Restart (campaign-store.ts, writeReplaced).
export function writeStandaloneReplaced<TRun>(user: UserDb<TRun>, game: Pick<StandaloneGame, "id" | "active">): void {
  user
    .update(standaloneGames)
    .set({ activeScenario: game.active ? activeJson(game.active) : null, rebase: game.active?.from ? stored(game.active.from) : null, checkpoint: null })
    .where(eq(standaloneGames.id, game.id))
    .run();
}

// The open game's checkpoint (campaign-store.ts, writeCheckpoint); null clears it.
export function writeStandaloneCheckpoint<TRun>(user: UserDb<TRun>, id: string, checkpoint: Checkpoint | null): void {
  user.update(standaloneGames).set({ checkpoint: checkpoint ? stored(checkpoint) : null }).where(eq(standaloneGames.id, id)).run();
}

// An Undo past the checkpoint clears it (campaign-store.ts, clearCheckpointPast).
export function clearStandaloneCheckpointPast<TRun>(user: UserDb<TRun>, id: string, intents: number): void {
  user
    .update(standaloneGames)
    .set({ checkpoint: null })
    .where(and(eq(standaloneGames.id, id), sql`json_extract(${standaloneGames.checkpoint}, '$.intentCount') > ${intents}`))
    .run();
}

/** The checkpoint stored for the open game, or null when there is none or it does not read. */
export function readStandaloneCheckpoint<TRun>(user: UserDb<TRun>, id: string): Checkpoint | null {
  const row = user.select({ checkpoint: standaloneGames.checkpoint }).from(standaloneGames).where(eq(standaloneGames.id, id)).get();
  return row ? parseCheckpoint(row.checkpoint) : null;
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
