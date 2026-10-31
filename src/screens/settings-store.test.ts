// The table's settings in user.db (src/screens/settings-store.ts): read once, every change written back, and a row that
// cannot be read neither stops the app nor swallows the next change.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import migrations from "../../drizzle/migrations";
import { DEFAULT_SETTINGS, parseSettings, restoreDefaults, tableSettings } from "../play/table-settings";
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
    tableSettings.getState().update({ guide: false, animationSpeed: "quick", spotlight: false });
    expect(readTableSettings(user)).toMatchObject({ stopsOn: true, guide: false, animationSpeed: "quick", spotlight: false });
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

  it("gives an old row that lacks the new keys their defaults", () => {
    const { sqlite, user } = openUser();
    sqlite.exec(`INSERT INTO settings (key, value) VALUES ('table', '{"guide":false,"animationSpeed":"quick","spotlight":false}')`);
    const stop = bindTableSettings(user, () => {});
    expect(tableSettings.getState().settings).toEqual({ ...DEFAULT_SETTINGS, guide: false, animationSpeed: "quick", spotlight: false });
    stop();
  });

  it("round-trips the uiScale, haptics, reduceMotion, keepAwake and theme keys", () => {
    const { user } = openUser();
    const stop = bindTableSettings(user, () => {});
    tableSettings.getState().update({ uiScale: "large", haptics: false, reduceMotion: "always", keepAwake: false, theme: "system" });
    expect(readTableSettings(user)).toMatchObject({ uiScale: "large", haptics: false, reduceMotion: "always", keepAwake: false, theme: "system" });
    stop();
  });
});

describe("parseSettings", () => {
  it("replaces a wrong type or an unknown option with the default", () => {
    expect(parseSettings({ uiScale: "huge", haptics: "yes", reduceMotion: 1, keepAwake: null, theme: "sepia" })).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ uiScale: 2, haptics: 0, reduceMotion: "never", keepAwake: "no", theme: true })).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps a valid value for each new key", () => {
    expect(parseSettings({ uiScale: "small", haptics: false, reduceMotion: "always", keepAwake: false, theme: "light" })).toMatchObject({ uiScale: "small", haptics: false, reduceMotion: "always", keepAwake: false, theme: "light" });
  });
});

describe("parseSettings card pictures and moving fog", () => {
  it("defaults a missing or invalid cardQuality to high and a missing or invalid fogDrift to true", () => {
    expect(parseSettings({}).cardQuality).toBe("high");
    expect(parseSettings({ cardQuality: "ultra" }).cardQuality).toBe("high");
    expect(parseSettings({ cardQuality: 2 }).cardQuality).toBe("high");
    expect(parseSettings({}).fogDrift).toBe(true);
    expect(parseSettings({ fogDrift: "no" }).fogDrift).toBe(true);
  });

  it("round-trips low and false", () => {
    const stored = JSON.parse(JSON.stringify({ ...DEFAULT_SETTINGS, cardQuality: "low", fogDrift: false }));
    expect(parseSettings(stored)).toMatchObject({ cardQuality: "low", fogDrift: false });
  });
});

describe("restoreDefaults", () => {
  it("returns the defaults and keeps what the guide has explained", () => {
    const changed = { ...DEFAULT_SETTINGS, uiScale: "large" as const, theme: "light" as const, stopsOn: true, guide: false, guideSeen: { "3.3": 2 } };
    expect(restoreDefaults(changed)).toEqual({ ...DEFAULT_SETTINGS, guideSeen: { "3.3": 2 } });
  });
});
