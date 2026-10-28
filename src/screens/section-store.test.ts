// Which sections the viewer folded survives in user.db `settings` (key "sections"); an unchanged section follows its default.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import migrations from "../../drizzle/migrations";
import { foldWords, isFolded, parseSections, withFolded } from "./fold-state";
import { readSections, writeSection } from "./section-store";

function openUser() {
  const sqlite = new Database(":memory:");
  for (const entry of migrations.journal.entries) {
    const key = `m${entry.idx.toString().padStart(4, "0")}` as keyof typeof migrations.migrations;
    for (const statement of migrations.migrations[key].split("--> statement-breakpoint")) if (statement.trim()) sqlite.exec(statement.trim());
  }
  return { sqlite, user: drizzle(sqlite) };
}

describe("fold state", () => {
  it("defaults to open, and to folded for the archived lists, until the viewer changes it", () => {
    const sections = readSections(openUser().user);
    expect(isFolded(sections, "others", false)).toBe(false);
    expect(isFolded(sections, "archived", true)).toBe(true);
  });

  it("round-trips through settings", () => {
    const { user } = openUser();
    writeSection(user, "others", true, false);
    writeSection(user, "archived", false, true);
    const back = readSections(user);
    expect(isFolded(back, "others", false)).toBe(true);
    expect(isFolded(back, "archived", true)).toBe(false);
    expect(isFolded(back, "start", false)).toBe(false);
  });

  it("drops a section set back to its default", () => {
    const { user } = openUser();
    writeSection(user, "others", true, false);
    expect(writeSection(user, "others", false, false)).toEqual({});
  });

  it("reads a value that is not a map as no entries", () => {
    expect(parseSections("x")).toEqual({});
    expect(parseSections([true])).toEqual({});
    expect(parseSections({ a: true, b: "no", c: false })).toEqual({ a: true, c: false });
    const { sqlite, user } = openUser();
    sqlite.exec(`INSERT INTO settings (key, value) VALUES ('sections', '[1]')`);
    expect(readSections(user)).toEqual({});
    expect(withFolded({}, "a", true, false)).toEqual({ a: true });
  });

  it("says its count and whether it is folded", () => {
    expect(foldWords("Archived", true, 3)).toBe("Archived, 3, folded");
    expect(foldWords("Other journeys", false, 2)).toBe("Other journeys, 2");
    expect(foldWords("Games", false, null)).toBe("Games");
    expect(foldWords("Archived", true, "3 playthroughs")).toBe("Archived, 3 playthroughs, folded");
  });
});
