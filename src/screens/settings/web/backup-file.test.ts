import { describe, expect, test } from "vitest";

import { backupFileName, hasForeignSchema, hasSqliteHeader, REFUSALS, restoredTables, schemaVerdict } from "./backup-file";

describe("backup file parts", () => {
  test("the file name carries the local date", () => {
    expect(backupFileName(new Date(2026, 10, 6, 23, 59))).toBe("middle-earth-player-2026-11-06.backup");
    expect(backupFileName(new Date(2027, 0, 31))).toBe("middle-earth-player-2027-01-31.backup");
  });

  test("a SQLite header is told from text", () => {
    const header = new TextEncoder().encode("SQLite format 3\u0000rest of the page");
    expect(hasSqliteHeader(header)).toBe(true);
    expect(hasSqliteHeader(new TextEncoder().encode("hello, this is not a database"))).toBe(false);
    expect(hasSqliteHeader(new Uint8Array(4))).toBe(false);
  });

  test("migration history: newer, current, older", () => {
    const known = [10, 20, 30];
    expect(schemaVerdict([10, 20, 30], known)).toBe("current");
    expect(schemaVerdict([10, 20], known)).toBe("older");
    expect(schemaVerdict([], known)).toBe("older");
    expect(schemaVerdict([10, 20, 30, 40], known)).toBe("newer");
    expect(schemaVerdict([10, 20, 99], known)).toBe("newer");
    // An unknown migration is newer even when the count matches or it is older than the rest: the sets differ.
    expect(schemaVerdict([10, 20, 25], known)).toBe("newer");
    expect(schemaVerdict([5, 10, 20, 30], known)).toBe("newer");
    expect(schemaVerdict([30, 20, 10], known)).toBe("current");
  });

  test("a restore replaces the games and keeps what describes this computer's files", () => {
    const live = ["__drizzle_migrations", "booklets", "decks", "image_files", "meta", "runs", "saves", "settings", "standalone_games", "sqlite_sequence"];
    expect(restoredTables(live)).toEqual(["decks", "runs", "saves", "settings", "standalone_games"]);
  });

  test("every refusal is a plain sentence", () => {
    for (const sentence of Object.values(REFUSALS)) expect(sentence).toMatch(/^[A-Z].*\.$/);
  });

  test("a schema of tables and indexes is the app's own; anything else is foreign", () => {
    const table = { type: "table", name: "saves", rootpage: 2, sql: "CREATE TABLE `saves` (`id` text PRIMARY KEY NOT NULL)" };
    const auto = { type: "index", name: "sqlite_autoindex_saves_1", rootpage: 3, sql: null };
    const index = { type: "index", name: "i", rootpage: 4, sql: "CREATE UNIQUE INDEX i ON saves (id)" };
    expect(hasForeignSchema([table, auto, index])).toBe(false);
    expect(hasForeignSchema([table, { type: "trigger", name: "t", rootpage: 0, sql: "CREATE TRIGGER t AFTER INSERT ON saves BEGIN SELECT 1; END" }])).toBe(true);
    expect(hasForeignSchema([{ type: "view", name: "v", rootpage: 0, sql: "CREATE VIEW v AS SELECT 1" }])).toBe(true);
    expect(hasForeignSchema([{ type: "table", name: "f", rootpage: 0, sql: "CREATE VIRTUAL TABLE f USING fts5(body)" }])).toBe(true);
    // A row that calls a view a table is still a view: it has no page and its SQL creates no table.
    expect(hasForeignSchema([{ type: "table", name: "v", rootpage: 5, sql: "CREATE VIEW v AS SELECT 1" }])).toBe(true);
    expect(hasForeignSchema([{ type: "table", name: "x", rootpage: 5, sql: null }])).toBe(true);
  });
});
