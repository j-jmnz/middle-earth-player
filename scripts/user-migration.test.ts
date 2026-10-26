import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import migrations from "../drizzle/migrations.ts";
import { CATALOG_VERSION } from "../src/catalog/version.ts";
import { writeAppliedCatalogVersion } from "../src/screens/applied-catalog-version.ts";

// Same key as drizzle-orm/expo-sqlite/migrator: journal idx 0 is `m0000`.
function migrationSql(entry: { idx: number; tag: string }): string {
  const key = `m${entry.idx.toString().padStart(4, "0")}`;
  const sql = migrations.migrations[key as keyof typeof migrations.migrations];
  if (typeof sql !== "string" || sql.trim().length === 0) {
    throw new Error(`Missing migration: ${entry.tag}`);
  }
  return sql;
}

describe("user migration", () => {
  it("keeps a deck row when the applied catalog version is stored", () => {
    const database = new DatabaseSync(":memory:");
    for (const entry of migrations.journal.entries) {
      const sql = migrationSql(entry);
      for (const statement of sql.split("--> statement-breakpoint")) {
        const trimmed = statement.trim();
        if (trimmed.length === 0) continue;
        database.exec(trimmed);
      }
    }

    database.exec(
      `INSERT INTO decks (id, name, heroes, cards) VALUES ('deck-1', 'Fellowship', '["141001"]', '[{"code":"141001","count":1}]')`,
    );
    writeAppliedCatalogVersion((statement) => {
      database.exec(statement);
    }, CATALOG_VERSION);

    const deck = database.prepare("SELECT id, name, heroes, cards FROM decks WHERE id = ?").get("deck-1") as
      | { id: string; name: string; heroes: string; cards: string }
      | undefined;
    const stored = database
      .prepare("SELECT applied_catalog_version FROM meta WHERE id = 1")
      .get() as { applied_catalog_version: number } | undefined;

    expect(deck).toEqual({
      id: "deck-1",
      name: "Fellowship",
      heroes: '["141001"]',
      cards: '[{"code":"141001","count":1}]',
    });
    expect(stored?.applied_catalog_version).toBe(CATALOG_VERSION);
  });

  it("dates each journal entry after the one before, or the phone's migrator skips it", () => {
    // drizzle-orm's migrator applies an entry only when its `when` is later than the last one user.db recorded.
    const whens = migrations.journal.entries.map((entry) => entry.when);
    for (let index = 1; index < whens.length; index += 1) expect(whens[index]).toBeGreaterThan(whens[index - 1]!);
    expect(migrations.journal.entries.map((entry) => entry.idx)).toEqual(migrations.journal.entries.map((_, index) => index));
  });

  it("adds the booklets table, the save loadout, the archive mark, the write time, the standalone games and the settings without touching a save row", () => {
    const database = new DatabaseSync(":memory:");
    const [first, ...rest] = migrations.journal.entries;
    if (!first) throw new Error("No migrations");
    for (const statement of migrationSql(first).split("--> statement-breakpoint")) if (statement.trim()) database.exec(statement.trim());
    database.exec(`INSERT INTO saves (id, campaign_id, seat_count, log, pool) VALUES ('save-1', 'fellowship-of-the-ring', 1, '{}', '[]')`);
    for (const entry of rest) {
      for (const statement of migrationSql(entry).split("--> statement-breakpoint")) if (statement.trim()) database.exec(statement.trim());
    }
    const save = database.prepare("SELECT id, loadout, archived_at, updated_at FROM saves WHERE id = 'save-1'").get();
    expect(save).toEqual({ id: "save-1", loadout: null, archived_at: null, updated_at: null });
    database.exec(
      `INSERT INTO booklets (id, path, original_filename, byte_size, sha256, page_count) VALUES ('learn-to-play', 'booklets/learn-to-play.pdf', 'ltp.pdf', 10, 'abc', 4)`,
    );
    const booklet = database.prepare("SELECT page_count, last_page FROM booklets WHERE id = 'learn-to-play'").get();
    expect(booklet).toEqual({ page_count: 4, last_page: 1 });
    const saveCount = database.prepare("SELECT count(*) AS n FROM saves").get();
    expect(saveCount).toEqual({ n: 1 });
    database.exec(
      `INSERT INTO standalone_games (id, campaign_id, scenario_id, seat_count, loadout, created_at) VALUES ('game-1', 'fellowship-of-the-ring', 'a-shadow-of-the-past', 1, '{}', 5)`,
    );
    const game = database.prepare("SELECT id, active_scenario, result, archived_at FROM standalone_games").get();
    expect(game).toEqual({ id: "game-1", active_scenario: null, result: null, archived_at: null });
    // 0006: the table's settings, one JSON row per key (src/screens/settings-store.ts).
    database.exec(`INSERT INTO settings (key, value) VALUES ('table', '{"stopsOn":true}')`);
    expect(database.prepare("SELECT key, value FROM settings").get()).toEqual({ key: "table", value: '{"stopsOn":true}' });
  });
});
