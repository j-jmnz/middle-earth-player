import Database from "better-sqlite3";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import migrations from "../../../drizzle/migrations";
import { emptyLog } from "../../campaign/log";
import { newSave, type Save } from "../../campaign/save";
import { CATALOG_VERSION } from "../../catalog/version";
import { ENGINE_VERSION } from "../../campaign/replay";
import { drop } from "../../campaign/session";
import { archiveSave, createSave, deleteSave, listArchivedSaves, listSaves, readBooklet, restoreSave, readSave, readSaveChecked, writeActive, writeBooklet, writeLastPage, writeSave } from "./campaign-store";
import { saves } from "./user-schema";

function openUser() {
  const sqlite = new Database(":memory:");
  for (const entry of migrations.journal.entries) {
    const key = `m${entry.idx.toString().padStart(4, "0")}` as keyof typeof migrations.migrations;
    for (const statement of migrations.migrations[key].split("--> statement-breakpoint")) if (statement.trim()) sqlite.exec(statement.trim());
  }
  return drizzle(sqlite);
}

describe("campaign store", () => {
  it("creates a save with its own id and a seat count that is stored once", () => {
    const user = openUser();
    const first = createSave(user, "fellowship-of-the-ring", 2, { now: 1000 });
    const second = createSave(user, "fellowship-of-the-ring", 1, { now: 1000 });
    expect(first.id).not.toBe(second.id);
    expect(readSave(user, first.id)).toEqual(first);
    expect(readSave(user, first.id)?.seatCount).toBe(2);
    expect(readSave(user, first.id)?.log.heroesBySeat).toHaveLength(2);
    expect(listSaves(user).map((save) => save.id).sort()).toEqual([first.id, second.id].sort());
  });

  it("writeActive writes the open scenario and the time like writeSave and leaves the rest of the row", () => {
    const user = openUser();
    const save = {
      ...newSave("save-w", "fellowship-of-the-ring", 1),
      log: { ...emptyLog(1), notes: "kept" },
      active: { engineVersion: ENGINE_VERSION, dataHash: 7, world: null, seed: 3, intents: [{ type: "Keep" as const }] },
      loadout: { scenarioId: "a-knife-in-the-dark", difficulty: "Easy" as const, seats: [{ deckId: "d", heroes: ["141002"], deck: ["01040"] }], ringBearer: "141001", choices: [], acceptPenalty: false },
    };
    writeSave(user, save, 1000);
    const next = { ...save, active: { ...save.active, intents: [...save.active.intents, { type: "Pass" as const }] } };
    writeActive(user, next, 2000);
    const whole = openUser();
    writeSave(whole, next, 2000);
    const row = (db: typeof user) => db.select().from(saves).where(inArray(saves.id, ["save-w"])).get();
    expect(row(user)).toEqual(row(whole));
    expect(readSave(user, "save-w")).toEqual(next);
    writeActive(user, { ...next, active: null }, 3000);
    expect(readSave(user, "save-w")?.active).toBeNull();
    expect(row(user)?.loadout).toEqual(save.loadout);
    expect(listSaves(user)[0]).toMatchObject({ id: "save-w", active: false });
  });

  it("a list row says whether a scenario is open without reading its intents", () => {
    const user = openUser();
    const save = {
      ...newSave("save-l1", "fellowship-of-the-ring", 1),
      active: { engineVersion: ENGINE_VERSION, dataHash: 7, world: null, seed: 3, intents: [{ type: "Keep" as const }] },
      loadout: { scenarioId: "a-knife-in-the-dark", difficulty: "Easy" as const, seats: [{ deckId: "d", heroes: ["141002"], deck: ["01040"] }], ringBearer: "141001", choices: [], acceptPenalty: false },
    };
    writeSave(user, save);
    // Another data hash with no digests to compare: opening it will ask for a choice, which the list says without a world.
    expect(listSaves(user)).toEqual([{ id: "save-l1", campaignId: save.campaignId, seatCount: 1, log: save.log, loadout: save.loadout, active: true, needsChoice: true }]);
  });

  it("a list row marks only a scenario that will ask for a choice: not a current one, nor another version with a digest for every move", () => {
    const user = openUser();
    const loadout = { scenarioId: "a-knife-in-the-dark", difficulty: "Easy" as const, seats: [{ deckId: "d", heroes: ["141002"], deck: ["01040"] }], ringBearer: "141001", choices: [], acceptPenalty: false };
    const open = (id: string, active: NonNullable<Save["active"]>) => writeSave(user, { ...newSave(id, "fellowship-of-the-ring", 1), active, loadout });
    const keep = { type: "Keep" as const };
    open("current", { engineVersion: ENGINE_VERSION, dataHash: CATALOG_VERSION, world: 5, seed: 3, intents: [keep] });
    open("checked", { engineVersion: ENGINE_VERSION - 1, dataHash: CATALOG_VERSION, world: 5, seed: 3, intents: [keep], checks: [1] });
    open("unchecked", { engineVersion: ENGINE_VERSION - 1, dataHash: CATALOG_VERSION, world: 5, seed: 3, intents: [keep] });
    open("fresh", { engineVersion: ENGINE_VERSION - 1, dataHash: CATALOG_VERSION, world: 5, seed: 3, intents: [] });
    const marked = new Map(listSaves(user).map((row) => [row.id, row.needsChoice === true]));
    expect(Object.fromEntries(marked)).toEqual({ current: false, checked: false, unchecked: true, fresh: true });
  });

  it("a new playthrough stores the carry-over it took in, and an older stored log reads with the facts' defaults", () => {
    const user = openUser();
    const carried = [{ code: "01135", back: "encounter" as const, burdenSet: null, attachedTo: null, seat: null }];
    const next = createSave(user, "mirkwood-paths", 1, { now: 3000, carried });
    expect(readSave(user, next.id)?.log.carryIn).toEqual(carried);
    expect(createSave(user, "the-dark-of-mirkwood", 1, { now: 4000 }).log).toEqual(emptyLog(1));
    const { prisoner: _p, usedOnce: _u, counters: _c, carryOver: _o, carryIn: _i, ...old } = emptyLog(1);
    writeSave(user, { ...next, log: old as unknown as typeof next.log }, 3000);
    expect(readSave(user, next.id)?.log).toEqual(emptyLog(1));
  });

  it("keeps the log, the open scenario and the loadout across a write and a read", () => {
    const user = openUser();
    const save = {
      ...newSave("save-a", "fellowship-of-the-ring", 1),
      log: { ...emptyLog(1), notes: "Frodo's burden", completed: ["a-shadow-of-the-past"], earned: { "a-shadow-of-the-past": ["141078"] } },
      active: { engineVersion: ENGINE_VERSION, dataHash: 7, world: null, seed: 3, intents: [{ type: "Keep" as const }, { type: "Pass" as const }] },
      loadout: { scenarioId: "a-knife-in-the-dark", difficulty: "Easy" as const, seats: [{ deckId: "d", heroes: ["141002"], deck: ["01040"] }], ringBearer: "141001", choices: [], acceptPenalty: false },
    };
    writeSave(user, save);
    expect(readSave(user, "save-a")).toEqual(save);
    writeSave(user, { ...save, log: { ...save.log, notes: "later" } });
    expect(readSave(user, "save-a")?.log.notes).toBe("later");
    expect(listSaves(user)).toHaveLength(1);
  });

  it("drops an open scenario that does not read and keeps the log", () => {
    const user = openUser();
    const save = { ...newSave("save-b", "fellowship-of-the-ring", 1), log: { ...emptyLog(1), notes: "kept" } };
    writeSave(user, save);
    user.update(saves).set({ activeScenario: { engineVersion: "old" }, loadout: null }).run();
    const read = readSave(user, "save-b");
    expect(read?.active).toBeNull();
    expect(read?.log.notes).toBe("kept");
    // The player is told: the read says the stored scenario did not read.
    expect(readSaveChecked(user, "save-b")?.unreadable).toBe(true);
  });

  it("does not report a save with no open scenario as unreadable", () => {
    const user = openUser();
    writeSave(user, newSave("save-c", "fellowship-of-the-ring", 1));
    expect(readSaveChecked(user, "save-c")?.unreadable).toBe(false);
  });

  it("a dropped scenario written back leaves the log, and no deck or image row is touched", () => {
    const user = openUser();
    const active = { engineVersion: ENGINE_VERSION - 1, dataHash: 1, world: null, seed: 1, intents: [] };
    const loadout = { scenarioId: "a-shadow-of-the-past", difficulty: "Normal" as const, seats: [], ringBearer: null, choices: [], acceptPenalty: false };
    const save = { ...newSave("save-c", "fellowship-of-the-ring", 1), log: { ...emptyLog(1), notes: "kept" }, active, loadout };
    writeSave(user, save);
    writeSave(user, drop(save));
    expect(readSave(user, "save-c")).toEqual({ ...save, active: null, loadout: null });
  });

  it("archives a save out of the open list and restores it whole, and a later write keeps it archived", () => {
    const user = openUser();
    const active = { engineVersion: ENGINE_VERSION, dataHash: 7, world: null, seed: 3, intents: [{ type: "Keep" as const }] };
    const loadout = { scenarioId: "a-shadow-of-the-past", difficulty: "Normal" as const, seats: [], ringBearer: null, choices: [], acceptPenalty: false };
    const kept = { ...newSave("save-d", "fellowship-of-the-ring", 1), log: { ...emptyLog(1), notes: "kept" }, active, loadout };
    const other = createSave(user, "fellowship-of-the-ring", 2, { now: 2000 });
    const later = newSave("save-e", "fellowship-of-the-ring", 1);
    writeSave(user, kept);
    writeSave(user, later);
    archiveSave(user, "save-d", 10);
    archiveSave(user, "save-e", 20);
    expect(listSaves(user).map((save) => save.id)).toEqual([other.id]);
    // The last one put away comes first.
    expect(listArchivedSaves(user).map((save) => save.id)).toEqual(["save-e", "save-d"]);
    writeSave(user, { ...kept, log: { ...kept.log, notes: "still archived" } });
    expect(listArchivedSaves(user).map((save) => save.id)).toContain("save-d");
    restoreSave(user, "save-d");
    expect(listSaves(user).map((save) => save.id).sort()).toEqual([other.id, "save-d"].sort());
    expect(readSave(user, "save-d")).toEqual({ ...kept, log: { ...kept.log, notes: "still archived" } });
  });

  it("lists the save written last first, and a restore does not move it ahead", () => {
    const user = openUser();
    writeSave(user, newSave("save-h", "fellowship-of-the-ring", 1), 100);
    writeSave(user, newSave("save-i", "fellowship-of-the-ring", 2), 200);
    expect(listSaves(user).map((save) => save.id)).toEqual(["save-i", "save-h"]);
    writeSave(user, newSave("save-h", "fellowship-of-the-ring", 1), 300);
    expect(listSaves(user).map((save) => save.id)).toEqual(["save-h", "save-i"]);
    archiveSave(user, "save-i", 400);
    restoreSave(user, "save-i");
    expect(listSaves(user).map((save) => save.id)).toEqual(["save-h", "save-i"]);
  });

  it("keeps rows never written since the order column in the order they were made, after the written ones", () => {
    const user = openUser();
    writeSave(user, newSave("save-j", "fellowship-of-the-ring", 1));
    writeSave(user, newSave("save-k", "fellowship-of-the-ring", 1));
    writeSave(user, newSave("save-l", "fellowship-of-the-ring", 1), 50);
    user.update(saves).set({ updatedAt: null }).where(inArray(saves.id, ["save-j", "save-k"])).run();
    expect(listSaves(user).map((save) => save.id)).toEqual(["save-l", "save-j", "save-k"]);
  });

  it("deletes one save and leaves the others", () => {
    const user = openUser();
    writeSave(user, newSave("save-f", "fellowship-of-the-ring", 1));
    writeSave(user, newSave("save-g", "fellowship-of-the-ring", 1));
    archiveSave(user, "save-g");
    deleteSave(user, "save-f");
    expect(readSave(user, "save-f")).toBeNull();
    expect(listSaves(user)).toEqual([]);
    deleteSave(user, "save-g");
    expect(listArchivedSaves(user)).toEqual([]);
  });

  it("stores one booklet row per book and writes the last page", () => {
    const user = openUser();
    expect(readBooklet(user, "fellowship-of-the-ring")).toBeNull();
    const row = { id: "fellowship-of-the-ring", path: "booklets/fellowship-of-the-ring.pdf", originalFilename: "MEC109.pdf", byteSize: 42, sha256: "abc", pageCount: 60, lastPage: 1 };
    writeBooklet(user, row);
    writeBooklet(user, { ...row, byteSize: 43 });
    expect(readBooklet(user, row.id)?.byteSize).toBe(43);
    writeLastPage(user, row.id, 12);
    expect(readBooklet(user, row.id)?.lastPage).toBe(12);
    writeLastPage(user, row.id, 0);
    expect(readBooklet(user, row.id)?.lastPage).toBe(1);
  });
});
