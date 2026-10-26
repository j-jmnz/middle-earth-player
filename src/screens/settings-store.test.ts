// The table's settings in user.db (src/screens/settings-store.ts): read once, every change written back, and a row that
// cannot be read neither stops the app nor swallows the next change.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import migrations from "../../drizzle/migrations";
import { DEFAULT_SETTINGS, tableSettings } from "../play/table-settings";
import { bindTableSettings, readTableSettings } from "./settings-store.ts";

function openUser() {
  const sqlite = new Database(":memory:");
  for (const entry of migrations.journal.entries) {
    const key = `m${entry.idx.toString().padStart(4, "0")}` as keyof typeof migrations.migrations;
    for (const statement of migrations.migrations[key].split("--> statement-breakpoint")) if (statement.trim()) sqlite.exec(statement.trim());
  }
  return { sqlite, user: drizzle(sqlite) };
}

afterEach(() => tableSettings.getState().hydrate(DEFAULT_SETTINGS));

describe("table settings in user.db", () => {
  it("loads the stored row and writes each change back", () => {
    const { sqlite, user } = openUser();
    sqlite.exec(`INSERT INTO settings (key, value) VALUES ('table', '{"stopsOn":true}')`);
    const warnings: string[] = [];
    const stop = bindTableSettings(user, (message) => warnings.push(message));
    expect(tableSettings.getState().settings.stopsOn).toBe(true);
    tableSettings.getState().update({ guide: false, animationSpeed: "quick" });
    expect(readTableSettings(user)).toMatchObject({ stopsOn: true, guide: false, animationSpeed: "quick" });
    stop();
    expect(warnings).toEqual([]);
  });

  it("keeps the defaults when the row cannot be read, says so, and saves the next change over it", () => {
    const { sqlite, user } = openUser();
    sqlite.exec(`INSERT INTO settings (key, value) VALUES ('table', 'not json')`);
    const warnings: string[] = [];
    const stop = bindTableSettings(user, (message) => warnings.push(message));
    expect(tableSettings.getState().settings).toEqual(DEFAULT_SETTINGS);
    expect(warnings).toHaveLength(1);
    tableSettings.getState().update({ stopsOn: true });
    expect(readTableSettings(user).stopsOn).toBe(true);
    stop();
  });
});
