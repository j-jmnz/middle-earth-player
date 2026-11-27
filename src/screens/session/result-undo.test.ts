// A move that ends the game can be taken back (docs/architecture.md, State): the lost game's run goes with it, the save drops
// the intent, and a relaunch on the result keeps Undo. A won game writes nothing before Confirm (the Resolution's `close`), so Undo over a win leaves nothing.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import migrations from "../../../drizzle/migrations";
import { temporaryCatalog } from "../../../test/harness/temp-catalog.ts";
import { fixtureSave, type FixtureName } from "../../campaign/fixtures.ts";
import { isWon } from "../../campaign/session.ts";
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
  it("the store's Undo restores the state before the losing move, takes its run and its intent off, and the same move loses again with one run; a relaunch keeps Undo", () => {
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
    // The result screens call the store's Undo (the screen's own step, the way back to the table, is a route change).
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

describe("Undo of the move that won the game", () => {
  // A win writes no run and no log before Confirm: the Resolution's close writes both, so Undo over the win has nothing to take back.
  it.each<FixtureName>(["mirkwood-won", "opens-won"])("%s: nothing durable is written while the win waits for Confirm, and Undo over it leaves nothing", (name) => {
    const user = openUser();
    const save = fixtureSave(name, "s1", CATALOG_VERSION);
    writeSave(user, save);
    const opened = openTable(catalog, user, "s1");
    if (!opened.ok) throw new Error("fixture did not open");
    expect(isWon(opened.game)).toBe(true);
    expect(opened.history.length).toBeGreaterThan(0);
    const scenarioId = opened.game.scenarioId;
    const intents = readSave(user, "s1")!.active!.intents.length;
    // The win is on the table only: no run, and the scenario is not on the log.
    expect(listRuns(user)).toHaveLength(0);
    expect(readSave(user, "s1")!.log).toEqual(save.log);
    expect(readSave(user, "s1")!.log.completed).not.toContain(scenarioId);

    const { store } = sessionStore(opened, user);
    expect(store.getState().undo()).toBe(true);
    expect(isWon(store.getState().game)).toBe(false);
    expect(readSave(user, "s1")!.active!.intents).toHaveLength(intents - 1);
    expect(readSave(user, "s1")!.log).toEqual(save.log);
    expect(listRuns(user)).toHaveLength(0);
  });
});
