import { asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import type { PoolCard } from "../campaign/log";
import { parseActive, parseLoadout, parseLog, parseSeatCount, newSave, type Save } from "../campaign/save";
import { booklets, saves, type StoredJson } from "./user-schema";

// user.db `saves` and `booklets`, read and written whole. The screens call these; the rules stay in src/campaign.
type UserDb<TRun> = BaseSQLiteDatabase<"sync", TRun>;

// The stored JSON is plain data. The campaign types are readonly views of it. The json columns serialize with JSON.stringify
// on the write, so no copy is made here: this only changes the type.
export function stored(value: unknown): StoredJson {
  return value as StoredJson;
}

// A save as read, and whether an open scenario was stored but did not read, so the player is told it is gone.
export type ReadSave = { save: Save; unreadable: boolean };

function parseRow(row: typeof saves.$inferSelect): ReadSave {
  // A log that does not parse is a failure the player must see. The open scenario is only a cache of the intents: when
  // it does not parse it is dropped and the log stays.
  const log = parseLog(row.log);
  let active = null;
  let loadout = null;
  try {
    active = parseActive(row.activeScenario);
    loadout = parseLoadout(row.loadout);
  } catch {
    active = null;
    loadout = null;
  }
  const stored = row.activeScenario != null || row.loadout != null;
  const unreadable = stored && (!active || !loadout);
  if (!active || !loadout) {
    active = null;
    loadout = null;
  }
  return { save: { id: row.id, campaignId: row.campaignId, seatCount: parseSeatCount(row.seatCount), log, active, loadout }, unreadable };
}

// A save as the lists show it: the open scenario is whether one is stored, never its intents (a long game is not parsed to draw a row).
export type ListedSave = Omit<Save, "active"> & { active: boolean };

// The columns a list row reads. The open scenario is only tested for, so its json is neither read nor parsed.
const listed = {
  id: saves.id,
  campaignId: saves.campaignId,
  seatCount: saves.seatCount,
  log: saves.log,
  loadout: saves.loadout,
  hasActive: sql<number>`${saves.activeScenario} is not null`,
};

function listedRow(row: { id: string; campaignId: string; seatCount: number; log: unknown; loadout: unknown; hasActive: number }): ListedSave {
  const log = parseLog(row.log);
  let loadout = null;
  try {
    loadout = parseLoadout(row.loadout);
  } catch {
    loadout = null;
  }
  // As parseRow: the loadout reads only with an open scenario, and an open scenario only with a loadout that reads.
  const open = row.hasActive === 1 && loadout != null;
  return { id: row.id, campaignId: row.campaignId, seatCount: parseSeatCount(row.seatCount), log, active: open, loadout: open ? loadout : null };
}

// The open playthroughs, the one written last first; rows never written since 0003 follow in the order they were made. An
// archived save is listed by listArchivedSaves.
export function listSaves<TRun>(user: UserDb<TRun>): ListedSave[] {
  return user
    .select(listed)
    .from(saves)
    .where(isNull(saves.archivedAt))
    .orderBy(desc(saves.updatedAt), asc(sql`rowid`))
    .all()
    .map(listedRow);
}

// The archived playthroughs, the last one put away first.
export function listArchivedSaves<TRun>(user: UserDb<TRun>): ListedSave[] {
  return user.select(listed).from(saves).where(isNotNull(saves.archivedAt)).orderBy(desc(saves.archivedAt)).all().map(listedRow);
}

export function readSave<TRun>(user: UserDb<TRun>, id: string): Save | null {
  return readSaveChecked(user, id)?.save ?? null;
}

export function readSaveChecked<TRun>(user: UserDb<TRun>, id: string): ReadSave | null {
  const row = user.select().from(saves).where(eq(saves.id, id)).get();
  return row ? parseRow(row) : null;
}

export function writeSave<TRun>(user: UserDb<TRun>, save: Save, now: number = Date.now()): void {
  const values = {
    id: save.id,
    campaignId: save.campaignId,
    seatCount: save.seatCount,
    log: stored(save.log),
    // The pool is the log's pool; the column is kept for the sheet's reader and written from the same value.
    pool: stored(save.log.campaignPool),
    activeScenario: save.active ? stored(save.active) : null,
    loadout: save.loadout ? stored(save.loadout) : null,
    updatedAt: now,
  };
  user
    .insert(saves)
    .values(values)
    .onConflictDoUpdate({ target: saves.id, set: values })
    .run();
}

// An intent or an Undo changes only the open scenario, so only it (and the time) is written: the log, the pool and the loadout
// are not serialized again. The same values writeSave would write for these two columns. Nothing is inserted: the row exists.
export function writeActive<TRun>(user: UserDb<TRun>, save: Pick<Save, "id" | "active">, now: number = Date.now()): void {
  user
    .update(saves)
    .set({ activeScenario: save.active ? stored(save.active) : null, updatedAt: now })
    .where(eq(saves.id, save.id))
    .run();
}

// Archiving keeps the whole row: the log, the open scenario and the loadout come back as they were on restore.
export function archiveSave<TRun>(user: UserDb<TRun>, id: string, now: number = Date.now()): void {
  user.update(saves).set({ archivedAt: now }).where(eq(saves.id, id)).run();
}

export function restoreSave<TRun>(user: UserDb<TRun>, id: string): void {
  user.update(saves).set({ archivedAt: null }).where(eq(saves.id, id)).run();
}

// Deleting removes the playthrough for good: its log, its open scenario and its loadout. Decks are not part of a save.
// writeSave inserts a missing row, so no save screen may stay open under the list after a delete: today path, briefing,
// table, log and resolution are all pushed above the list and gone while it shows.
export function deleteSave<TRun>(user: UserDb<TRun>, id: string): void {
  user.delete(saves).where(eq(saves.id, id)).run();
}

let created = 0;

// A new playthrough. The seat count is chosen here and never changes.
// `carried` is the carry-over of a finished playthrough (carryOffers): its cards go on the new log's carryIn, and `carriedFrom` (its save id) keeps the offer from being made twice.
export function createSave<TRun>(user: UserDb<TRun>, campaignId: string, seatCount: 1 | 2, now: number = Date.now(), carried: readonly PoolCard[] = [], carriedFrom: string | null = null): Save {
  created += 1;
  const save = newSave(`save-${now.toString(36)}${created > 1 ? `-${created}` : ""}`, campaignId, seatCount, carried, carriedFrom);
  writeSave(user, save, now);
  return save;
}

export type BookletRow = typeof booklets.$inferSelect;

export function readBooklet<TRun>(user: UserDb<TRun>, id: string): BookletRow | null {
  return user.select().from(booklets).where(eq(booklets.id, id)).get() ?? null;
}

export function writeBooklet<TRun>(user: UserDb<TRun>, row: BookletRow): void {
  user
    .insert(booklets)
    .values(row)
    .onConflictDoUpdate({ target: booklets.id, set: row })
    .run();
}

export function writeLastPage<TRun>(user: UserDb<TRun>, id: string, page: number): void {
  user.update(booklets).set({ lastPage: Math.max(1, Math.floor(page)) }).where(eq(booklets.id, id)).run();
}

// When each playthrough was last written (the win that finished it is the last write of a finished one), by save id: what the
// carry-over offers date a finished playthrough by.
export function savedAt<TRun>(user: UserDb<TRun>): Map<string, number> {
  return new Map(user.select({ id: saves.id, updatedAt: saves.updatedAt }).from(saves).all().flatMap((row) => (row.updatedAt == null ? [] : [[row.id, row.updatedAt] as const])));
}
