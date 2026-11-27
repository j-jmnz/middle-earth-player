// Rules: brief, Rules engine, Undo; brief, Screens (Standalone outcome). A standalone game that is over is final only when the player leaves its outcome:
// Undo from the over state writes no result and no run, settling writes one result and one run (dated to the move that ended the game), a second settle writes
// nothing more, and a relaunch before it opens the same over game with Undo offered. History reads such a game by its result, and delete records its run first.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";

import migrations from "../../../drizzle/migrations";
import { temporaryCatalog } from "../../../test/harness/temp-catalog.ts";
import { fixtureStandalone } from "../../campaign/fixtures.ts";
import { unsettledOutcome } from "../../campaign/standalone.ts";
import { CATALOG_VERSION } from "../../catalog/version.ts";
import { listRuns } from "../data/run-store.ts";
import { listStandalone, readStandalone, writeStandalone } from "../data/standalone-store.ts";
import { gameDestination, gameWords } from "../history/entries.ts";
import { openStandalone, recordUnsettledGame, settleStandalone, standaloneStore } from "./standalone-open.ts";

function openUser() {
  const sqlite = new Database(":memory:");
  for (const entry of migrations.journal.entries) {
    const key = `m${entry.idx.toString().padStart(4, "0")}` as keyof typeof migrations.migrations;
    for (const statement of migrations.migrations[key].split("--> statement-breakpoint")) if (statement.trim()) sqlite.exec(statement.trim());
  }
  return drizzle(sqlite);
}

const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));

function opened(fixture: "carrock-lost" | "deadmarshes-won") {
  const user = openUser();
  writeStandalone(user, fixtureStandalone(fixture, "g1", CATALOG_VERSION), 5);
  const session = openStandalone(catalog, user, "g1");
  if (!session.ok) throw new Error("fixture did not open");
  return { user, session };
}

afterEach(() => vi.useRealTimers());

describe("the outcome of a standalone game that is over", () => {
  it("offers Undo on a reopened game, and Undo writes no result and no run and takes the move off the save", () => {
    const { user, session } = opened("carrock-lost");
    expect(session.game.lost).toBe(true);
    expect(session.history.length).toBeGreaterThan(0);
    const moves = readStandalone(user, "g1")!.game.active!.intents.length;
    const { store } = standaloneStore(session, user);
    expect(store.getState().undo()).toBe(true);
    expect(store.getState().game.lost).toBe(false);
    expect(readStandalone(user, "g1")!.game).toMatchObject({ result: null, active: { intents: expect.any(Array) } });
    expect(readStandalone(user, "g1")!.game.active!.intents).toHaveLength(moves - 1);
    expect(listRuns(user)).toHaveLength(0);
  });

  it("settles into one result and one run, and a second settle writes nothing more", () => {
    const { user, session } = opened("carrock-lost");
    expect(readStandalone(user, "g1")!.game.result).toBeNull();
    const finished = settleStandalone(user, session, 9000);
    expect(finished?.result?.outcome).toBe("lost");
    expect(readStandalone(user, "g1")!.game).toMatchObject({ active: null, result: { outcome: "lost" } });
    const [run] = listRuns(user);
    expect(listRuns(user)).toHaveLength(1);
    expect(run).toMatchObject({ kind: "standalone", refId: "g1", result: "lost", endedAt: 9000 });
    const before = readStandalone(user, "g1")!.game;
    expect(settleStandalone(user, session, 12_000)).not.toBeNull();
    expect(listRuns(user)).toEqual([run]);
    expect(readStandalone(user, "g1")!.game).toEqual(before);
  });

  it("settles a win with its score, and a game still on writes nothing", () => {
    const { user, session } = opened("deadmarshes-won");
    expect(settleStandalone(user, session, 7)?.result).toMatchObject({ outcome: "won" });
    expect(listRuns(user)).toMatchObject([{ result: "won", endedAt: 7 }]);
    const on = openStandalone(catalog, user, "g1");
    expect(on.ok).toBe(false);
    const { user: other, session: lost } = opened("carrock-lost");
    const { store } = standaloneStore(lost, other);
    store.getState().undo();
    expect(settleStandalone(other, { ...lost, game: store.getState().game }, 8)).toBeNull();
    expect(listRuns(other)).toHaveLength(0);
  });

  it("dates the run to the move that ended the game, not to the time the player leaves", () => {
    const { user, session } = opened("carrock-lost");
    const { store } = standaloneStore(session, user);
    const last = store.getState().history.at(-1)!;
    store.getState().undo();
    expect(readStandalone(user, "g1")!.game.active!.ended).toBeUndefined();
    vi.useFakeTimers();
    vi.setSystemTime(4_000_000);
    expect(store.getState().dispatch(last.intent)).toBe(true);
    expect(readStandalone(user, "g1")!.game.active!.ended).toEqual({ at: 4_000_000, outcome: "lost" });
    // A relaunch an hour later: the row still says when the game ended.
    vi.setSystemTime(4_000_000 + 3_600_000);
    const again = openStandalone(catalog, user, "g1");
    if (!again.ok) throw new Error("relaunch did not open");
    settleStandalone(user, again);
    expect(listRuns(user)).toMatchObject([{ endedAt: 4_000_000 }]);
    // An Undo takes the stamp off with the move.
    const { user: second, session: reopened } = opened("carrock-lost");
    const table = standaloneStore(reopened, second).store;
    table.getState().undo();
    expect(readStandalone(second, "g1")!.game.active!.ended).toBeUndefined();
  });

  it("opens the same over game with Undo offered after a relaunch before it is settled", () => {
    const { user, session } = opened("carrock-lost");
    const { store } = standaloneStore(session, user);
    const last = store.getState().history.at(-1)!;
    store.getState().undo();
    expect(store.getState().dispatch(last.intent)).toBe(true);
    const relaunched = openUser();
    writeStandalone(relaunched, readStandalone(user, "g1")!.game, 5);
    const again = openStandalone(catalog, relaunched, "g1");
    if (!again.ok) throw new Error("relaunch did not open");
    expect(again.game.lost).toBe(true);
    expect(again.history.at(-1)?.intent).toEqual(last.intent);
    expect(listRuns(relaunched)).toHaveLength(0);
  });
});

describe("History reads a game that is over and was never left", () => {
  it("by its result, with its outcome as the place it opens, and records its run when it is deleted", () => {
    const { user, session } = opened("carrock-lost");
    const { store } = standaloneStore(session, user);
    const last = store.getState().history.at(-1)!;
    store.getState().undo();
    vi.useFakeTimers();
    vi.setSystemTime(6_000_000);
    store.getState().dispatch(last.intent);
    const [game] = listStandalone(user);
    expect(game).toBeDefined();
    expect(unsettledOutcome(game!)).toBe("lost");
    expect(gameDestination(game!, false)).toMatchObject({ to: "outcome" });
    expect(gameWords(game!, null, "See the outcome", false, (code) => code).chip).toEqual({ label: "Lost", tone: "danger" });
    // A game still on is "In progress", and a settled one reads by its result alone.
    store.getState().undo();
    expect(unsettledOutcome(listStandalone(user)[0]!)).toBeNull();
    store.getState().dispatch(last.intent);
    vi.setSystemTime(6_500_000);
    recordUnsettledGame(catalog, user, "g1");
    expect(listRuns(user)).toMatchObject([{ refId: "g1", result: "lost", endedAt: 6_000_000 }]);
  });
});
