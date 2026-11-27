// A move that ends the game can be taken back (docs/architecture.md, State): the lost game's run goes with it, the save drops
// the intent, and a relaunch on the result keeps Undo.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import migrations from "../../../drizzle/migrations";
import { temporaryCatalog } from "../../../test/harness/temp-catalog.ts";
import { fixtureSave } from "../../campaign/fixtures.ts";
import { CATALOG_VERSION } from "../../catalog/version.ts";
import { readSave, writeSave } from "../data/campaign-store.ts";
import { listRuns } from "../data/run-store.ts";
import { openTable, sessionStore } from "./table-open.ts";

function openUser() {
  const sqlite = new Database(":memory:");
  for (const entry of migrations.journal.entries) {
    const key = `m${entry.idx.toString().padStart(4, "0")}` as keyof typeof migrations.migrations;
    for (const statement of migrations.migrations[key].split("--> statement-breakpoint")) if (statement.trim()) sqlite.exec(statement.trim());
  }
  return drizzle(sqlite);
}

const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));

describe("Undo of the move that lost the game", () => {
  it("goes back to the table, takes the run back and leaves a save that replays to the move before; the same move loses again with one run", () => {
    const user = openUser();
    writeSave(user, fixtureSave("lost", "s1", CATALOG_VERSION));
    const opened = openTable(catalog, user, "s1");
    if (!opened.ok) throw new Error("fixture did not open");
    // The reopened lost game still offers Undo: the end is not final until the player leaves it.
    expect(opened.game.lost).toBe(true);
    expect(opened.history.length).toBeGreaterThan(0);
    const last = opened.history[opened.history.length - 1]!;
    const intents = readSave(user, "s1")!.active!.intents.length;

    const { store } = sessionStore(opened, user);
    // Back to the table: the table's Undo is the one the result screens call.
    expect(store.getState().undo()).toBe(true);
    expect(store.getState().game.lost).toBe(false);
    expect(store.getState().game).toBe(last.before);
    expect(readSave(user, "s1")!.active!.intents.length).toBe(intents - 1);

    // The move again: the loss writes its run once; taking the move back takes the run back.
    expect(store.getState().dispatch(last.intent)).toBe(true);
    expect(store.getState().game.lost).toBe(true);
    expect(listRuns(user)).toHaveLength(1);
    expect(store.getState().undo()).toBe(true);
    expect(store.getState().game.lost).toBe(false);
    expect(listRuns(user)).toHaveLength(0);
    expect(store.getState().dispatch(last.intent)).toBe(true);
    expect(listRuns(user)).toHaveLength(1);

    // A relaunch on the result: a replay of the row on a new database reaches the same lost game with Undo still offered.
    const relaunched = openUser();
    writeSave(relaunched, readSave(user, "s1")!);
    const again = openTable(catalog, relaunched, "s1");
    if (!again.ok) throw new Error("relaunch did not open");
    expect(again.game.lost).toBe(true);
    expect(again.history.map((entry) => entry.intent)).toEqual(opened.history.map((entry) => entry.intent));
  });
});
