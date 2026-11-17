// The collection in user.db (src/screens/collection/store.ts): no row is everything owned, each change is written back, and a row
// that cannot be read neither stops the app nor swallows the next change.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import migrations from "../../../drizzle/migrations";
import { DEFAULT_SETTINGS, restoreDefaults, tableSettings } from "../../ui/table-settings";
import { bindTableSettings } from "../settings/store";
import { bindCollection, collectionStore, readCollection } from "./store";

function openUser() {
  const sqlite = new Database(":memory:");
  for (const entry of migrations.journal.entries) {
    const key = `m${entry.idx.toString().padStart(4, "0")}` as keyof typeof migrations.migrations;
    for (const statement of migrations.migrations[key].split("--> statement-breakpoint")) if (statement.trim()) sqlite.exec(statement.trim());
  }
  return { sqlite, user: drizzle(sqlite) };
}

afterEach(() => {
  collectionStore.getState().hydrate([]);
  tableSettings.getState().hydrate(DEFAULT_SETTINGS);
});

describe("collection in user.db", () => {
  it("owns everything with no row, and writes each change back", () => {
    const { user } = openUser();
    const warnings: string[] = [];
    const stop = bindCollection(user, (message) => warnings.push(message));
    expect(collectionStore.getState().notOwned).toEqual([]);
    collectionStore.getState().switchPacks(["WoE", "TLR"], false);
    expect(readCollection(user)).toEqual(["TLR", "WoE"]);
    collectionStore.getState().switchPacks(["TLR"], true);
    expect(readCollection(user)).toEqual(["WoE"]);
    stop();
    expect(warnings).toEqual([]);
  });

  it("loads a stored row", () => {
    const { sqlite, user } = openUser();
    sqlite.exec(`INSERT INTO settings (key, value) VALUES ('collection', '{"notOwned":["Core"]}')`);
    const stop = bindCollection(user, () => {});
    expect(collectionStore.getState().notOwned).toEqual(["Core"]);
    stop();
  });

  it("owns everything when the row cannot be read, says so, and saves the next change over it", () => {
    const { sqlite, user } = openUser();
    sqlite.exec(`INSERT INTO settings (key, value) VALUES ('collection', 'not json')`);
    const warnings: string[] = [];
    const stop = bindCollection(user, (message) => warnings.push(message));
    expect(collectionStore.getState().notOwned).toEqual([]);
    collectionStore.getState().switchPacks(["Core"], false);
    expect(readCollection(user)).toEqual(["Core"]);
    stop();
    expect(warnings).toHaveLength(1);
  });

  it("is left alone by Restore defaults", () => {
    const { user } = openUser();
    const stopCollection = bindCollection(user, () => {});
    const stopSettings = bindTableSettings(user, () => {});
    collectionStore.getState().switchPacks(["Core"], false);
    tableSettings.getState().update(restoreDefaults(tableSettings.getState().settings));
    expect(readCollection(user)).toEqual(["Core"]);
    stopSettings();
    stopCollection();
  });
});
