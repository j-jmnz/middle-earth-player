import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it, vi } from "vitest";

import migrations from "../../drizzle/migrations";
import { temporaryCatalog } from "../../scripts/temp-catalog.ts";
import { fixtureSave, hasFixture, type FixtureName } from "../campaign/fixtures.ts";
import { CATALOG_VERSION } from "../catalog/version.ts";
import { readSave, savedAt, writeSave } from "./campaign-store.ts";
import { openTable, recordUnclosedRun, sessionStore } from "./table-open.ts";
import { flushRuns } from "./pending-runs.ts";
import { listRuns } from "./run-store.ts";
import { runs } from "./user-schema.ts";

function openUser() {
  const sqlite = new Database(":memory:");
  for (const entry of migrations.journal.entries) {
    const key = `m${entry.idx.toString().padStart(4, "0")}` as keyof typeof migrations.migrations;
    for (const statement of migrations.migrations[key].split("--> statement-breakpoint")) if (statement.trim()) sqlite.exec(statement.trim());
  }
  return { sqlite, user: drizzle(sqlite) };
}

const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
const name: FixtureName = hasFixture("duo") ? "duo" : "lost";

describe("opening the table", () => {
  it("replays a save once and hands the same session back while the save is as it was", () => {
    const { user } = openUser();
    writeSave(user, fixtureSave(name, "s1", CATALOG_VERSION));
    const first = openTable(catalog, user, "s1");
    expect(first.ok).toBe(true);
    expect(openTable(catalog, user, "s1")).toBe(first);
  });

  it("does not hand it back once the save changed under it (a new deal on the same id, an intent more)", () => {
    const { user } = openUser();
    const save = fixtureSave(name, "s1", CATALOG_VERSION);
    writeSave(user, save);
    const first = openTable(catalog, user, "s1");
    const shorter = { ...save, active: { ...save.active!, intents: save.active!.intents.slice(0, -1) } };
    writeSave(user, shorter);
    const second = openTable(catalog, user, "s1");
    expect(second).not.toBe(first);
    expect(second.ok && second.save.active?.intents.length).toBe(save.active!.intents.length - 1);
    // The first save written back replays to the same game (one session is kept for an id).
    writeSave(user, save);
    expect(openTable(catalog, user, "s1")).toEqual(first);
  });

  it("lets the Resolution take the game the table left: after intents and after an Undo, equal to a replay from the save", () => {
    const { sqlite, user } = openUser();
    const save = fixtureSave(name, "s1", CATALOG_VERSION);
    const shorter = { ...save, active: { ...save.active!, intents: save.active!.intents.slice(0, -2) } };
    writeSave(user, shorter);
    const opened = openTable(catalog, user, "s1");
    if (!opened.ok) throw new Error("fixture did not open");
    const live = sessionStore(opened, user);
    // Play the two intents the fixture ends with, through the store, as the table would.
    for (const intent of save.active!.intents.slice(-2)) expect(live.store.getState().dispatch(intent)).toBe(true);
    const after = openTable(catalog, user, "s1");
    if (!after.ok) throw new Error("save did not reopen");
    expect(after.save.active?.intents.length).toBe(save.active!.intents.length);
    expect(after.game).toBe(live.store.getState().game);
    // A cold replay (another handle, so nothing cached) reaches the same game.
    const cold = openTable(catalog, drizzle(sqlite), "s1");
    if (!cold.ok) throw new Error("cold replay failed");
    expect(cold.game).toEqual(after.game);
    expect(cold.history.length).toBe(after.history.length);
    expect(cold.roundSteps).toEqual(after.roundSteps);

    // Undo takes the last intent off the save and the game back; a new intent after it is a different save at the same count.
    if (live.store.getState().undo()) {
      const undone = openTable(catalog, user, "s1");
      if (!undone.ok) throw new Error("save did not reopen after Undo");
      expect(undone.save.active?.intents.length).toBe(save.active!.intents.length - 1);
      expect(undone.game).toBe(live.store.getState().game);
      expect(openTable(catalog, drizzle(sqlite), "s1")).toMatchObject({ ok: true, game: undone.game });
    }
  });

  it("folds the clock's foreground time into the save with each intent and on a pause", () => {
    const { user } = openUser();
    const save = fixtureSave(name, "s1", CATALOG_VERSION);
    writeSave(user, { ...save, active: { ...save.active!, intents: save.active!.intents.slice(0, -2) } });
    const opened = openTable(catalog, user, "s1");
    if (!opened.ok) throw new Error("fixture did not open");
    const live = sessionStore(opened, user);
    const [first, second] = save.active!.intents.slice(-2);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1000);
      live.clock.resume();
      vi.setSystemTime(4000);
      expect(live.store.getState().dispatch(first!)).toBe(true);
      expect(live.save().active?.activeMs).toBe(3000);
      expect(readSave(user, "s1")?.active?.activeMs).toBe(3000);
      vi.setSystemTime(5000);
      live.clock.pause();
      expect(readSave(user, "s1")?.active?.activeMs).toBe(4000);
      // Paused: the time away is not counted, and a second pause writes nothing more.
      vi.setSystemTime(9000);
      const written = savedAt(user).get("s1");
      vi.setSystemTime(9100);
      live.clock.pause();
      expect(savedAt(user).get("s1")).toBe(written);
      expect(readSave(user, "s1")?.active?.activeMs).toBe(4000);
      live.clock.resume();
      vi.setSystemTime(9600);
      expect(live.store.getState().dispatch(second!)).toBe(true);
      expect(readSave(user, "s1")?.active?.activeMs).toBe(4500);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(["lost", "mirkwood-won"] as const)("writes nothing on a pause once the game is over (%s)", (fixtureName) => {
    if (!hasFixture(fixtureName)) return;
    const { user } = openUser();
    writeSave(user, fixtureSave(fixtureName, "s1", CATALOG_VERSION));
    const opened = openTable(catalog, user, "s1");
    if (!opened.ok) throw new Error("fixture did not open");
    const live = sessionStore(opened, user);
    const before = savedAt(user).get("s1");
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1000);
      live.clock.resume();
      vi.setSystemTime(8000);
      live.clock.pause();
      expect(readSave(user, "s1")?.active?.activeMs).toBe(opened.save.active?.activeMs);
      expect(savedAt(user).get("s1")).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it("writes an over scenario's run once, after the call returns, and before History reads the runs", () => {
    const { user } = openUser();
    writeSave(user, fixtureSave("lost", "s1", CATALOG_VERSION));
    const later: (() => void)[] = [];
    recordUnclosedRun(catalog, user, "s1", (work) => later.push(work));
    // Nothing is written in the call itself; the save is overwritten right away, as a new deal does, and the run is of the save as it was read.
    expect(user.select().from(runs).all()).toHaveLength(0);
    writeSave(user, { ...readSave(user, "s1")!, active: null, loadout: null });
    // History reading the runs first flushes the queue, so it never lacks the run; the scheduled flush after it finds nothing to do.
    expect(listRuns(user).filter((run) => run.refId === "s1")).toHaveLength(1);
    for (const work of later) work();
    flushRuns();
    expect(listRuns(user).filter((run) => run.refId === "s1")).toHaveLength(1);
  });
});
