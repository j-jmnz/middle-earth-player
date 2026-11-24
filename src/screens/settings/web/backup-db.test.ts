// The restore's whole path (src/screens/settings/web/backup-db.ts) over in-memory databases: a file is checked on a copy, an older one is migrated there, and only a
// file that passes every check replaces the live games, in one transaction (docs/brief.md, Persistence and shipping).
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { describe, expect, it, vi } from "vitest";

import migrations from "../../../../drizzle/migrations";
import { AsyncSqlite, deserializeDatabaseAsync, drizzleOf, openMemory } from "../../../../test/harness/sqlite-async";
import { newSave } from "../../../campaign/save";
import { createSave } from "../../data/campaign-store";
import { checkCopy, restoreBackup, exportBackup } from "./backup-db";

vi.mock("expo-sqlite", async () => ({ deserializeDatabaseAsync: (await import("../../../../test/harness/sqlite-async")).deserializeDatabaseAsync }));
vi.mock("drizzle-orm/expo-sqlite", async () => ({ drizzle: (await import("../../../../test/harness/sqlite-async")).drizzleOf }));

type Db = ReturnType<typeof drizzleOf>;

// A database at the first `count` migrations (all of them by default), through the same migrator the app runs.
async function openAt(count: number = migrations.journal.entries.length): Promise<{ client: AsyncSqlite; db: Db }> {
  const client = openMemory();
  const db = drizzleOf(client);
  await migrate(db as never, { ...migrations, journal: { ...migrations.journal, entries: migrations.journal.entries.slice(0, count) } } as never);
  return { client, db };
}

const ids = (client: AsyncSqlite, table: string): string[] => (client.raw.prepare(`SELECT id FROM ${table} ORDER BY id`).all() as { id: string }[]).map((row) => row.id);
const settings = (client: AsyncSqlite) => client.raw.prepare("SELECT key, value FROM settings ORDER BY key").all();

// A live database with one save, a deck, a setting and the catalog stamp.
async function live() {
  const opened = await openAt();
  const save = createSave(opened.db as never, "fellowship-of-the-ring", 1, { now: 1000 });
  opened.client.raw.exec("INSERT INTO decks (id, name, heroes, cards) VALUES ('live-deck', 'Live', '[]', '[]'); INSERT INTO settings (key, value) VALUES ('live', '1'); INSERT INTO meta (id, applied_catalog_version) VALUES (1, 42)");
  return { ...opened, saveId: save.id };
}

// A backup file with one save of its own, as bytes.
async function backupWith(edit: (client: AsyncSqlite, db: Db) => void = () => undefined, count?: number): Promise<Uint8Array> {
  const { client, db } = await openAt(count);
  if (count === undefined) createSave(db as never, "fellowship-of-the-ring", 2, { now: 5000 });
  else client.raw.exec(`INSERT INTO saves (id, campaign_id, seat_count, log, pool) VALUES ('old-save', 'fellowship-of-the-ring', 1, '${JSON.stringify(newSave("x", "fellowship-of-the-ring", 1).log)}', '[]')`);
  client.raw.exec("INSERT INTO decks (id, name, heroes, cards) VALUES ('file-deck', 'File', '[]', '[]')");
  edit(client, db);
  return client.serializeAsync();
}

const snapshot = (client: AsyncSqlite) => ({ saves: ids(client, "saves"), decks: ids(client, "decks"), settings: settings(client) });

describe("restoreBackup", () => {
  it("replaces the games, decks and settings with the file's and keeps the catalog stamp", async () => {
    const target = await live();
    const result = await restoreBackup(target.db as never, await backupWith());
    expect(result).toEqual({ ok: true });
    expect(ids(target.client, "saves")).toHaveLength(1);
    expect(ids(target.client, "saves")).not.toContain(target.saveId);
    expect(ids(target.client, "decks")).toEqual(["file-deck"]);
    expect(settings(target.client)).toEqual([]);
    expect(target.client.raw.prepare("SELECT applied_catalog_version AS v FROM meta").get()).toEqual({ v: 42 });
  });

  it("round-trips: a backup of one database restored into another gives the first one's games", async () => {
    const source = await live();
    const bytes = await exportBackup(source.db as never);
    const target = await openAt();
    expect(await restoreBackup(target.db as never, bytes)).toEqual({ ok: true });
    expect(snapshot(target.client)).toEqual(snapshot(source.client));
  });

  it("refuses a file that is not a database, and one made by a newer schema, changing nothing", async () => {
    const target = await live();
    const before = snapshot(target.client);
    expect(await restoreBackup(target.db as never, new TextEncoder().encode("this is plainly not a SQLite file"))).toEqual({ ok: false, reason: "notDatabase" });
    const newer = await backupWith((client) => client.raw.exec("INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('x', 99999999999999)"));
    expect(await restoreBackup(target.db as never, newer)).toEqual({ ok: false, reason: "newer" });
    expect(snapshot(target.client)).toEqual(before);
  });

  it("refuses a file with a save that does not read, and leaves the live rows as they were", async () => {
    const target = await live();
    const before = snapshot(target.client);
    const unreadable = await backupWith((client) => client.raw.exec("INSERT INTO saves (id, campaign_id, seat_count, log, pool) VALUES ('broken', 'fellowship-of-the-ring', 1, 'not json at all', '[]')"));
    expect(await restoreBackup(target.db as never, unreadable)).toEqual({ ok: false, reason: "unreadable" });
    const badGame = await backupWith((client) => client.raw.exec("INSERT INTO standalone_games (id, campaign_id, scenario_id, seat_count, loadout, created_at) VALUES ('g', 'fellowship-of-the-ring', 's', 7, '{}', 1)"));
    expect(await restoreBackup(target.db as never, badGame)).toEqual({ ok: false, reason: "unreadable" });
    expect(snapshot(target.client)).toEqual(before);
  });

  it("refuses a file with a deck, a run or a setting that does not read, and leaves the live rows as they were", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const target = await live();
    const before = snapshot(target.client);
    const run = (heroes: string, result = "won") =>
      `INSERT INTO runs (id, kind, ref_id, box, scenario_id, result, seat_count, heroes) VALUES ('r', 'campaign', 's', 'b', 'x', '${result}', 1, '${heroes}')`;
    const crafted = [
      "INSERT INTO decks (id, name, heroes, cards) VALUES ('d', 'Bad', 'not json', '[]')",
      "INSERT INTO decks (id, name, heroes, cards) VALUES ('d', 'Bad', '{}', '[]')",
      `INSERT INTO decks (id, name, heroes, cards) VALUES ('d', 'Bad', '[]', '[{"code":7,"count":1}]')`,
      `INSERT INTO decks (id, name, heroes, cards, side) VALUES ('d', 'Bad', '[]', '[]', '[{"code":"01001","count":"many"}]')`,
      "INSERT INTO decks (id, name, heroes, cards, position) VALUES ('d', 'Bad', '[]', '[]', 'first')",
      run("not json"),
      run('["01001"]'),
      run("[]", "drawn"),
      "INSERT INTO settings (key, value) VALUES ('table', '{broken')",
    ];
    for (const statement of crafted) {
      const bytes = await backupWith((client) => client.raw.exec(statement));
      expect(await restoreBackup(target.db as never, bytes), statement).toEqual({ ok: false, reason: "unreadable" });
    }
    expect(snapshot(target.client)).toEqual(before);
    // The same rows, well formed, restore.
    const good = await backupWith((client) => client.raw.exec(`${run('[["01001"]]')}; INSERT INTO settings (key, value) VALUES ('table', '{"stops":true}'); INSERT INTO decks (id, name, heroes, cards, position) VALUES ('d', 'Good', '["01001"]', '[{"code":"01073","count":3}]', 0)`));
    expect(await restoreBackup(target.db as never, good)).toEqual({ ok: true });
    expect(ids(target.client, "decks")).toEqual(["d", "file-deck"]);
  });

  it("refuses a file whose schema holds a trigger, a view or a virtual table", async () => {
    const target = await live();
    const before = snapshot(target.client);
    const foreign = [
      "CREATE TRIGGER t AFTER INSERT ON saves BEGIN DELETE FROM decks; END",
      "CREATE VIEW v AS SELECT * FROM saves",
      "CREATE VIRTUAL TABLE f USING fts5(body)",
    ];
    for (const statement of foreign) {
      const bytes = await backupWith((client) => client.raw.exec(statement));
      expect(await restoreBackup(target.db as never, bytes), statement).toEqual({ ok: false, reason: "notDatabase" });
    }
    expect(snapshot(target.client)).toEqual(before);
  });

  it("tells SQLite the file's copy is not trusted before it reads it", async () => {
    const copy = await deserializeDatabaseAsync(await backupWith());
    expect(copy.raw.pragma("trusted_schema", { simple: true })).toBe(1);
    expect(await checkCopy(copy as never)).toBeNull();
    expect(copy.raw.pragma("trusted_schema", { simple: true })).toBe(0);
    expect(copy.raw.pragma("cell_size_check", { simple: true })).toBe(1);
  });

  it("migrates an older file on the copy and then restores it, with the tables it lacked now present and empty", async () => {
    const target = await live();
    const older = await backupWith(() => undefined, 4);
    expect(await restoreBackup(target.db as never, older)).toEqual({ ok: true });
    expect(ids(target.client, "saves")).toEqual(["old-save"]);
    expect(ids(target.client, "standalone_games")).toEqual([]);
    expect(ids(target.client, "decks")).toEqual(["file-deck"]);
  });

  it("rolls the whole restore back when a row cannot be inserted", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const target = await live();
    const before = snapshot(target.client);
    // `settings` is created after `saves` and `decks`, which are already replaced when its insert fails.
    const bad = await backupWith((client) => client.raw.exec("ALTER TABLE settings ADD COLUMN junk TEXT; INSERT INTO settings (key, value, junk) VALUES ('a', '1', 'c')"));
    expect(await restoreBackup(target.db as never, bad)).toEqual({ ok: false, reason: "failed" });
    expect(snapshot(target.client)).toEqual(before);
    expect(target.client.raw.inTransaction).toBe(false);
  });
});
