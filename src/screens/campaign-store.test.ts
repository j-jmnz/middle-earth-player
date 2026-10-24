import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import migrations from "../../drizzle/migrations";
import { emptyLog } from "../campaign/log";
import { newSave } from "../campaign/save";
import { ENGINE_VERSION } from "../campaign/replay";
import { drop } from "../campaign/session";
import { createSave, listSaves, readBooklet, readSave, writeBooklet, writeLastPage, writeSave } from "./campaign-store";
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
    const first = createSave(user, "fellowship-of-the-ring", 2, 1000);
    const second = createSave(user, "fellowship-of-the-ring", 1, 1000);
    expect(first.id).not.toBe(second.id);
    expect(readSave(user, first.id)).toEqual(first);
    expect(readSave(user, first.id)?.seatCount).toBe(2);
    expect(readSave(user, first.id)?.log.heroesBySeat).toHaveLength(2);
    expect(listSaves(user).map((save) => save.id).sort()).toEqual([first.id, second.id].sort());
  });

  it("keeps the log, the open scenario and the loadout across a write and a read", () => {
    const user = openUser();
    const save = {
      ...newSave("save-a", "fellowship-of-the-ring", 1),
      log: { ...emptyLog(1), notes: "Frodo's burden", completed: ["a-shadow-of-the-past"], earned: { "a-shadow-of-the-past": ["141078"] } },
      active: { engineVersion: ENGINE_VERSION, dataHash: 7, seed: 3, intents: [{ type: "Keep" as const }, { type: "Pass" as const }] },
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
  });

  it("a dropped scenario written back leaves the log, and no deck or image row is touched", () => {
    const user = openUser();
    const active = { engineVersion: ENGINE_VERSION - 1, dataHash: 1, seed: 1, intents: [] };
    const loadout = { scenarioId: "a-shadow-of-the-past", difficulty: "Normal" as const, seats: [], ringBearer: null, choices: [], acceptPenalty: false };
    const save = { ...newSave("save-c", "fellowship-of-the-ring", 1), log: { ...emptyLog(1), notes: "kept" }, active, loadout };
    writeSave(user, save);
    writeSave(user, drop(save));
    expect(readSave(user, "save-c")).toEqual({ ...save, active: null, loadout: null });
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
