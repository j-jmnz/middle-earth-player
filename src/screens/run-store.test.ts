import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import migrations from "../../drizzle/migrations";
import { emptyLog } from "../campaign/log";
import { newSave } from "../campaign/save";
import type { RunRecord } from "../campaign/runs";
import type { StandaloneGame } from "../campaign/standalone";
import { createSave, deleteSave, writeSave } from "./campaign-store";
import { backfillRunTable, listRuns, writeRun } from "./run-store";
import { deleteStandalone, writeStandalone } from "./standalone-store";

function openUser() {
  const sqlite = new Database(":memory:");
  for (const entry of migrations.journal.entries) {
    const key = `m${entry.idx.toString().padStart(4, "0")}` as keyof typeof migrations.migrations;
    for (const statement of migrations.migrations[key].split("--> statement-breakpoint")) if (statement.trim()) sqlite.exec(statement.trim());
  }
  return drizzle(sqlite);
}

const boxOf = (id: string) => (id === "a-shadow-of-the-past" || id === "a-knife-in-the-dark" ? "fellowship-of-the-ring" : null);

function run(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: "campaign:save-a:a-shadow-of-the-past:7",
    kind: "campaign",
    refId: "save-a",
    campaignId: "fellowship-of-the-ring",
    box: "fellowship-of-the-ring",
    scenarioId: "a-shadow-of-the-past",
    result: "lost",
    lossCause: "Threat reached 50",
    seatCount: 1,
    heroes: [["141002"]],
    rounds: 4,
    threats: [50],
    victoryPoints: null,
    score: null,
    reward: null,
    startedAt: 10,
    endedAt: 20,
    engineVersion: 6,
    backfilled: false,
    ...overrides,
  };
}

describe("run store", () => {
  it("writes a run once and never rewrites it", () => {
    const user = openUser();
    writeRun(user, run());
    writeRun(user, run({ result: "won", score: 5, lossCause: null }));
    expect(listRuns(user)).toEqual([run()]);
  });

  it("keeps a run when its save or game is deleted", () => {
    const user = openUser();
    const save = createSave(user, "fellowship-of-the-ring", 1, { now: 1000 });
    writeRun(user, run({ refId: save.id, id: `campaign:${save.id}:x:1` }));
    deleteSave(user, save.id);
    expect(listRuns(user)).toHaveLength(1);
    const game: StandaloneGame = { id: "game-1", campaignId: "fellowship-of-the-ring", scenarioId: "a-shadow-of-the-past", seatCount: 1, loadout: null, active: null, result: { outcome: "lost", reason: "Threat reached 50", rounds: 2 } };
    writeStandalone(user, game, 5);
    writeRun(user, run({ id: "standalone:game-1", kind: "standalone", refId: "game-1", campaignId: null }));
    deleteStandalone(user, "game-1");
    expect(listRuns(user)).toHaveLength(2);
  });

  it("back-fills each won scenario of a save and each finished standalone game, once", () => {
    const user = openUser();
    const save = {
      ...newSave("save-a", "fellowship-of-the-ring", 1),
      log: {
        ...emptyLog(1),
        heroesBySeat: [["141002"]],
        completed: ["a-shadow-of-the-past", "a-knife-in-the-dark"],
        earned: { "a-shadow-of-the-past": ["141078"] },
        scenarios: { "a-shadow-of-the-past": { rounds: 5, victoryPoints: 2, score: 40 }, "a-knife-in-the-dark": { rounds: 6, victoryPoints: 0, score: 51 } },
      },
    };
    writeSave(user, save, 100);
    const loadout = { scenarioId: "a-shadow-of-the-past", difficulty: "Normal" as const, seats: [{ deckId: null, heroes: ["141002", "141003"], deck: [] }], ringBearer: null };
    writeStandalone(user, { id: "game-w", campaignId: "fellowship-of-the-ring", scenarioId: "a-shadow-of-the-past", seatCount: 1, loadout, active: null, result: { outcome: "won", score: { rounds: 3, victoryPoints: 1, score: 33 } } }, 200);
    writeStandalone(user, { id: "game-l", campaignId: "fellowship-of-the-ring", scenarioId: "a-knife-in-the-dark", seatCount: 1, loadout, active: null, result: { outcome: "lost", reason: "All heroes died", rounds: 2 } }, 300);
    writeStandalone(user, { id: "game-open", campaignId: "fellowship-of-the-ring", scenarioId: "a-knife-in-the-dark", seatCount: 1, loadout, active: null, result: null }, 400);

    expect(backfillRunTable(user, boxOf)).toBe(4);
    expect(backfillRunTable(user, boxOf)).toBe(0);
    const rows = listRuns(user);
    expect(rows.map((row) => row.id)).toEqual(["campaign:save-a:a-shadow-of-the-past", "campaign:save-a:a-knife-in-the-dark", "standalone:game-w", "standalone:game-l"]);
    const first = rows[0];
    expect(first).toMatchObject({ kind: "campaign", result: "won", score: 40, rounds: 5, victoryPoints: 2, reward: ["141078"], heroes: [["141002"]], threats: null, endedAt: null, engineVersion: null, backfilled: true, box: "fellowship-of-the-ring" });
    // A campaign loss is never invented: every back-filled campaign run is a win.
    expect(rows.filter((row) => row.kind === "campaign").every((row) => row.result === "won")).toBe(true);
    expect(rows[3]).toMatchObject({ result: "lost", lossCause: "All heroes died", rounds: 2, startedAt: 300, score: null, heroes: [["141002", "141003"]] });
  });

  it("back-fill keeps its fixed id: a row with it stays, and a live row of another attempt does not hide the log's win", () => {
    const user = openUser();
    const save = { ...newSave("save-a", "fellowship-of-the-ring", 1), log: { ...emptyLog(1), completed: ["a-shadow-of-the-past"], scenarios: { "a-shadow-of-the-past": { rounds: 5, victoryPoints: 2, score: 40 } } } };
    writeSave(user, save, 100);
    writeRun(user, run({ result: "won", lossCause: null, score: 40, refId: "save-a" }));
    expect(backfillRunTable(user, boxOf)).toBe(1);
    expect(listRuns(user)).toHaveLength(2);
    expect(listRuns(user)[1]?.id).toBe("campaign:save-a:a-shadow-of-the-past");
  });
});
