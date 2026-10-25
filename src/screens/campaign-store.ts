import { asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { parseActive, parseLoadout, parseLog, parseSeatCount, newSave, type Save } from "../campaign/save";
import { booklets, saves, type StoredJson } from "./user-schema";

// user.db `saves` and `booklets`, read and written whole. The screens call these; the rules stay in src/campaign.
type UserDb<TRun> = BaseSQLiteDatabase<"sync", TRun>;

// The stored JSON is plain data. The campaign types are readonly views of it.
export function stored(value: unknown): StoredJson {
  return JSON.parse(JSON.stringify(value)) as StoredJson;
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

// The open playthroughs, the one written last first; rows never written since 0003 follow in the order they were made. An
// archived save is listed by listArchivedSaves.
export function listSaves<TRun>(user: UserDb<TRun>): Save[] {
  return user
    .select()
    .from(saves)
    .where(isNull(saves.archivedAt))
    .orderBy(desc(saves.updatedAt), asc(sql`rowid`))
    .all()
    .map((row) => parseRow(row).save);
}

// The archived playthroughs, the last one put away first.
export function listArchivedSaves<TRun>(user: UserDb<TRun>): Save[] {
  return user.select().from(saves).where(isNotNull(saves.archivedAt)).orderBy(desc(saves.archivedAt)).all().map((row) => parseRow(row).save);
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
export function createSave<TRun>(user: UserDb<TRun>, campaignId: string, seatCount: 1 | 2, now: number = Date.now()): Save {
  created += 1;
  const save = newSave(`save-${now.toString(36)}${created > 1 ? `-${created}` : ""}`, campaignId, seatCount);
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
