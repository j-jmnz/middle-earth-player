// Back up and restore user.db on the web and the desktop (docs/brief.md, Persistence and shipping). The backup is the whole file as SQLite serializes it.
// A restore never touches the open database until the file has passed every check on a copy held in memory: the copy is migrated up to this build's schema
// (a file from a newer one is refused), every save, deck, run and setting in it is read the way the app reads it, and only then are the games, decks, runs and settings of the
// live database replaced, in one transaction. A transaction that is cut short (the tab closes) rolls back at the next open, so a restore is whole or not at all.
// Booklet and picture rows, and the catalog stamp, describe files stored on this computer and stay as they are (backup-file.ts, KEPT_TABLES).
import { drizzle, type ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { deserializeDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

import migrations from "../../../../drizzle/migrations";
import { readSaveChecked } from "../../data/campaign-store";
import { readStandalone } from "../../data/standalone-store";
import { hasForeignSchema, hasSqliteHeader, restoredTables, schemaVerdict, type Refusal, type SchemaRow } from "./backup-file";
import { deckRowReads, runRowReads, settingRowReads } from "./backup-rows";

// drizzle keeps the connection it was given on `$client`; AppDatabases types the database without it.
function clientOf(user: ExpoSQLiteDatabase): SQLiteDatabase {
  if ("$client" in user && user.$client instanceof Object) return user.$client as SQLiteDatabase;
  throw new Error("The user database has no connection to serialize");
}

export type RestoreResult = { ok: true } | { ok: false; reason: Refusal };

/** The open user.db as one file. */
export function exportBackup(user: ExpoSQLiteDatabase): Promise<Uint8Array> {
  return clientOf(user).serializeAsync();
}

const quoted = (name: string) => `"${name.replaceAll('"', '""')}"`;

async function tableNames(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'");
  return rows.map((row) => row.name);
}

// The rows of `table` that `reads` refuses throw, so the file is refused as one that does not read.
async function checkRows(copy: SQLiteDatabase, table: string, select: string, reads: (row: Record<string, unknown>) => boolean): Promise<void> {
  for (const row of await copy.getAllAsync<Record<string, unknown>>(select)) {
    if (!reads(row)) throw new Error(`A row of ${table} does not read`);
  }
}

// The copy's check, or the reason it is refused. The file is not trusted: SQLite is told so before the first read (no function or virtual table of the schema's
// runs, and a damaged cell is an error), and a schema with a trigger, a view or a virtual table is refused. An older file is migrated in place (on the copy).
// Every save, standalone game, deck, run and setting is read the way the app reads it.
export async function checkCopy(copy: SQLiteDatabase): Promise<Refusal | null> {
  await copy.execAsync("PRAGMA trusted_schema = OFF; PRAGMA cell_size_check = ON");
  if (hasForeignSchema(await copy.getAllAsync<SchemaRow>("SELECT type, name, rootpage, sql FROM sqlite_master"))) return "notDatabase";
  const check = await copy.getFirstAsync<{ quick_check: string }>("PRAGMA quick_check");
  if (check?.quick_check !== "ok") return "damaged";
  const names = await tableNames(copy);
  if (!names.includes("__drizzle_migrations")) return "notDatabase";
  if (!names.includes("saves")) return "noSaves";
  const applied = (await copy.getAllAsync<{ created_at: number }>("SELECT created_at FROM __drizzle_migrations")).map((row) => Number(row.created_at));
  const verdict = schemaVerdict(applied, migrations.journal.entries.map((entry) => entry.when));
  if (verdict === "newer") return "newer";
  const db = drizzle(copy);
  if (verdict === "older") await migrate(db, migrations);
  for (const row of await copy.getAllAsync<{ id: string }>("SELECT id FROM saves")) readSaveChecked(db, row.id);
  for (const row of await copy.getAllAsync<{ id: string }>("SELECT id FROM standalone_games")) readStandalone(db, row.id);
  // The migration made the tables an older file lacked.
  const tables = new Set(await tableNames(copy));
  if (tables.has("decks")) await checkRows(copy, "decks", "SELECT id, name, heroes, cards, side, updated_at AS updatedAt, position FROM decks", deckRowReads);
  if (tables.has("runs")) await checkRows(copy, "runs", "SELECT * FROM runs", runRowReads);
  if (tables.has("settings")) await checkRows(copy, "settings", "SELECT key, value FROM settings", settingRowReads);
  return null;
}

// The games, decks, runs and settings of `copy` put over the live ones in one transaction.
export async function replaceFrom(live: SQLiteDatabase, copy: SQLiteDatabase): Promise<void> {
  const copied = new Set(await tableNames(copy));
  const tables = restoredTables(await tableNames(live)).filter((name) => copied.has(name));
  await live.execAsync("BEGIN IMMEDIATE");
  try {
    for (const table of tables) {
      await live.execAsync(`DELETE FROM ${quoted(table)}`);
      for (const row of await copy.getAllAsync<Record<string, string | number | null>>(`SELECT * FROM ${quoted(table)}`)) {
        const columns = Object.keys(row);
        await live.runAsync(`INSERT INTO ${quoted(table)} (${columns.map(quoted).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`, columns.map((column) => row[column] ?? null));
      }
    }
    await live.execAsync("COMMIT");
  } catch (error: unknown) {
    await live.execAsync("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function openCopy(bytes: Uint8Array): Promise<SQLiteDatabase | null> {
  try {
    return await deserializeDatabaseAsync(bytes);
  } catch {
    return null;
  }
}

async function checked(copy: SQLiteDatabase): Promise<Refusal | null> {
  try {
    return await checkCopy(copy);
  } catch (error: unknown) {
    console.warn(`A backup did not read: ${error instanceof Error ? error.message : "unknown error"}`);
    return "unreadable";
  }
}

/** Put the backup's games over the open ones, or say why it is refused. The page is reloaded by the caller after an `ok`. */
export async function restoreBackup(user: ExpoSQLiteDatabase, bytes: Uint8Array): Promise<RestoreResult> {
  if (!hasSqliteHeader(bytes)) return { ok: false, reason: "notDatabase" };
  const copy = await openCopy(bytes);
  if (!copy) return { ok: false, reason: "damaged" };
  try {
    const refusal = await checked(copy);
    if (refusal) return { ok: false, reason: refusal };
    await replaceFrom(clientOf(user), copy);
    return { ok: true };
  } catch (error: unknown) {
    console.warn(`A restore did not finish: ${error instanceof Error ? error.message : "unknown error"}`);
    return { ok: false, reason: "failed" };
  } finally {
    await copy.closeAsync().catch(() => undefined);
  }
}
