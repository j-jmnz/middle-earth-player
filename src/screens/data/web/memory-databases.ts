// How the web app opens its databases (docs/architecture.md, Persistence; user decision, 2026-11-23). On the desktop and in Chromium, user.db is a file in the origin's
// private file storage that expo-sqlite's worker writes while the page waits for it (worker-channel.ts). Safari's engine, which every browser on an iPhone and an iPad
// uses, cannot do that: a worker that grows a file there waits on the page, the page is waiting on the worker, and the call ends as "Sync operation timeout".
// So here both databases live in the worker's memory, where no call touches storage, and user.db is copied to storage after each write by a second worker
// (flusher.ts, snapshot-store.ts). A move is in storage a moment after it is accepted (a quarter of a second, then the copy's own time), not before the next line runs: a page the system ends in between loses that move
// and nothing else. catalog.db is read from the bundle at each launch, so it is always this build's.
import { drizzle } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { backupDatabaseAsync, deserializeDatabaseAsync, openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

import migrations from "../../../../drizzle/migrations";
import { CATALOG_VERSION } from "../../../catalog/version";
import { writeAppliedCatalogVersion } from "../applied-catalog-version";
import { boxOf } from "../campaign-data";
import { catalogAssetModule } from "../catalog-asset";
import type { AppDatabases } from "../open-databases";
import { backfillRunTable } from "../run-store";
import { meta } from "../user-schema";
import { createFlusher } from "./flusher";
import { registerFlush } from "./saved";
import { holdOnlyPage, readNewest, snapshotWriter, type SnapshotWriter } from "./snapshot-store";
import { span } from "../../../ui/web/meter-span";

/** What the open fails with in a second tab or window; the database error screen shows it. */
export const OPEN_ELSEWHERE = "The app is open in another tab or window. Close this one, or close the other and reload.";

// How long after a write its copy starts. One action writes several times (the move, the checkpoint, a run), and each copy serializes the whole database in the
// worker the page waits on for its next call: so the writes of one action share one copy, begun once the action's own work is done.
const COPY_AFTER_MS = 250;

// A copy's time, from the database's serializing to the file written, and its size, for the web app's test meter (src/ui/web/meter-span.ts).
function timedCopy(serialize: () => Promise<Uint8Array>, persist: SnapshotWriter): { serialize: () => Promise<Uint8Array>; persist: SnapshotWriter } {
  let started = 0;
  return {
    serialize: () => {
      started = performance.now();
      return serialize();
    },
    persist: async (data, generation, slot) => {
      const bytes = data.byteLength;
      await persist(data, generation, slot);
      span("save", performance.now() - started, bytes);
    },
  };
}

// How often the copy is asked for with no write seen: a write that went past the query log (a raw statement) is still copied.
const SWEEP_MS = 5000;

async function catalogBytes(): Promise<Uint8Array> {
  const asset = catalogAssetModule(require("../../../../assets/catalog.db"));
  const uri = typeof asset === "object" ? asset.uri : String(asset);
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`The card catalog did not load (${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}

// A new connection each time: expo-sqlite hands out one shared connection for a path, and ":memory:" is the path of every database here.
function openEmpty(): Promise<SQLiteDatabase> {
  return openDatabaseAsync(":memory:", { useNewConnection: true });
}

/**
 * An ordinary in-memory database with the rows of a serialized one. The bytes are not opened in place and written to: a database SQLite deserialized
 * keeps its pages in one block it must grow on a write, and writing a game into one ended in a WebAssembly memory fault (Chromium's page crashed, Safari said
 * "Out of bounds memory access"). So the bytes are opened only to be copied, page by page, into a database SQLite made itself, and closed.
 */
async function openFromBytes(bytes: Uint8Array): Promise<SQLiteDatabase> {
  const source = await deserializeDatabaseAsync(bytes);
  try {
    const database = await openEmpty();
    await backupDatabaseAsync({ sourceDatabase: source, destDatabase: database });
    return database;
  } finally {
    await source.closeAsync();
  }
}

export async function openInMemory(): Promise<AppDatabases> {
  if (!(await holdOnlyPage())) throw new Error(OPEN_ELSEWHERE);
  const stored = await readNewest();
  const userSqlite = stored ? await openFromBytes(stored.data) : await openEmpty();
  const flusher = createFlusher({
    changes: async () => (await userSqlite.getFirstAsync<{ n: number }>("SELECT total_changes() AS n"))?.n ?? 0,
    ...timedCopy(() => userSqlite.serializeAsync(), snapshotWriter()),
    start: { generation: stored?.generation ?? 0, slot: stored?.slot ?? null, changes: 0 },
    soon: (task) => setTimeout(task, COPY_AFTER_MS),
    onError: (error) => console.warn(`The game was not copied to storage (${error instanceof Error ? error.message : "unknown error"}); it is tried again at the next move`),
  });
  registerFlush(flusher.flush);
  // Every statement drizzle runs passes its log, so a write asks for a copy at once; a read does not.
  const user = drizzle(userSqlite, { logger: { logQuery: (query) => (/^\s*(select|pragma)\b/i.test(query) ? undefined : flusher.note()) } });
  await migrate(user, migrations);
  try {
    backfillRunTable(user, (id) => boxOf(id)?.id ?? null);
  } catch (error: unknown) {
    console.warn(`Run history was not back-filled (${error instanceof Error ? error.message : "unknown error"}); it is tried again at the next launch`);
  }

  const catalogSqlite = await openFromBytes(await catalogBytes());
  await catalogSqlite.execAsync("PRAGMA query_only = ON");
  const applied = user.select({ appliedCatalogVersion: meta.appliedCatalogVersion }).from(meta).get()?.appliedCatalogVersion ?? null;
  if (applied !== CATALOG_VERSION) {
    writeAppliedCatalogVersion((statement) => {
      userSqlite.execSync(statement);
    }, CATALOG_VERSION);
  }

  flusher.note();
  setInterval(flusher.note, SWEEP_MS);
  // Leaving the page (another app, the Home Screen, a closed tab) asks for a copy without the timeout's wait.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flusher.flush();
  });
  return { catalog: drizzle(catalogSqlite), user };
}
