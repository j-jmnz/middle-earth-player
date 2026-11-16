import { describe, expect, test } from "vitest";

import { backupFileName, hasSqliteHeader, REFUSALS, restoredTables, schemaVerdict } from "./backup-file";

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
  });

  test("a restore replaces the games and keeps what describes this computer's files", () => {
    const live = ["__drizzle_migrations", "booklets", "decks", "image_files", "meta", "runs", "saves", "settings", "standalone_games", "sqlite_sequence"];
    expect(restoredTables(live)).toEqual(["decks", "runs", "saves", "settings", "standalone_games"]);
  });

  test("every refusal is a plain sentence", () => {
    for (const sentence of Object.values(REFUSALS)) expect(sentence).toMatch(/^[A-Z].*\.$/);
  });
});
