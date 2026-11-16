// An in-memory better-sqlite3 database wearing expo-sqlite's async surface, for the tests of code written against SQLiteDatabase (the web backup and restore,
// src/screens/settings/web/backup-db.ts). `raw` is the better-sqlite3 handle the tests and the drizzle mock use.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

type Param = string | number | null;

export class AsyncSqlite {
  readonly raw: Database.Database;
  constructor(raw: Database.Database) {
    this.raw = raw;
  }
  async getAllAsync<T>(sql: string, params: readonly Param[] = []): Promise<T[]> {
    return this.raw.prepare(sql).all(...params) as T[];
  }
  async getFirstAsync<T>(sql: string, params: readonly Param[] = []): Promise<T | null> {
    return (this.raw.prepare(sql).get(...params) as T | undefined) ?? null;
  }
  async execAsync(sql: string): Promise<void> {
    this.raw.exec(sql);
  }
  async runAsync(sql: string, params: readonly Param[] = []): Promise<void> {
    this.raw.prepare(sql).run(...params);
  }
  async serializeAsync(): Promise<Uint8Array> {
    return new Uint8Array(this.raw.serialize());
  }
  async closeAsync(): Promise<void> {
    this.raw.close();
  }
}

/** expo-sqlite's deserializeDatabaseAsync: a writable in-memory copy of a database file's bytes. */
export async function deserializeDatabaseAsync(bytes: Uint8Array): Promise<AsyncSqlite> {
  return new AsyncSqlite(new Database(Buffer.from(bytes)));
}

/** The drizzle that stands in for drizzle-orm/expo-sqlite's: the same query API over the better-sqlite3 handle. `$client` is how backup-db.ts reaches the connection. */
export function drizzleOf(client: AsyncSqlite) {
  return Object.assign(drizzle(client.raw), { $client: client });
}

export const openMemory = (): AsyncSqlite => new AsyncSqlite(new Database(":memory:"));
