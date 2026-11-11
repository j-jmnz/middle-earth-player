import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";

import migrations from "../../../drizzle/migrations";
import { goingPast, pastContext, playPast, RING_BEARER } from "../../../test/scenarios/a-shadow-of-the-past/play";
import { scenario, loadWorld, type World } from "../../../test/scenarios/a-shadow-of-the-past/scene";
import type { ReduceContext, ScenarioState } from "../../play/store/store";
import { emptyLog } from "../../campaign/log";
import { ENGINE_VERSION } from "../../campaign/replay";
import { newSave, type Save } from "../../campaign/save";
import type { World as CampaignWorld } from "../../campaign/world";
import type { StandaloneGame } from "../../campaign/standalone";
import { writeSave } from "./campaign-store";
import { listRuns } from "./run-store";
import { recordCampaignRun, recordStandaloneRun } from "./run-writers";
import { writeStandalone } from "./standalone-store";

function openUser() {
  const sqlite = new Database(":memory:");
  for (const entry of migrations.journal.entries) {
    const key = `m${entry.idx.toString().padStart(4, "0")}` as keyof typeof migrations.migrations;
    for (const statement of migrations.migrations[key].split("--> statement-breakpoint")) if (statement.trim()) sqlite.exec(statement.trim());
  }
  return drizzle(sqlite);
}

// A Shadow of the Past on the seeds runs.test.ts pins: seed 2 wins, seed 1 loses.
let world: World;
const asWorld = () => world as unknown as CampaignWorld;
let ctx: ReduceContext;
let play: (seed: number) => ScenarioState;

beforeAll(async () => {
  world = await loadWorld();
  ctx = pastContext(world);
  play = (seed) => playPast(ctx, seed);
});

function openSave(seed: number, startedAt?: number): Save {
  return {
    ...newSave("save-a", "fellowship-of-the-ring", 1),
    loadout: { scenarioId: scenario.id, difficulty: "Normal", seats: [{ deckId: "d", heroes: ["scout"], deck: [] }], ringBearer: RING_BEARER, choices: [], acceptPenalty: false },
    active: { engineVersion: ENGINE_VERSION, dataHash: 1, world: null, seed, intents: [], ...(startedAt == null ? {} : { startedAt }) },
  };
}

const wonLog = (save: Save, earned: string[]) => ({ ...save, log: { ...save.log, completed: [scenario.id], earned: { [scenario.id]: earned } }, active: null, loadout: null });

describe("the campaign run writer", () => {
  it("writes a win with the reward its log newly earned, the heroes as dealt, and the start", () => {
    const user = openUser();
    const before = openSave(2, 111);
    const state = play(2);
    const run = recordCampaignRun(user, before, wonLog(before, ["141078"]), asWorld(), state, 500);
    expect(run).toMatchObject({ result: "won", reward: ["141078"], startedAt: 111, endedAt: 500, heroes: [["scout", RING_BEARER]], kind: "campaign", refId: "save-a" });
    expect(run?.id).toBe(`campaign:save-a:${scenario.id}:2:111`);
    expect(run?.activeMs).toBeNull();
    expect(listRuns(user)).toHaveLength(1);
  });

  it("writes a replayed win with no reward", () => {
    const user = openUser();
    const base = openSave(2);
    const before = { ...base, log: { ...base.log, completed: [scenario.id], earned: { [scenario.id]: ["141078"] } } };
    const run = recordCampaignRun(user, before, { ...before, active: null, loadout: null }, asWorld(), play(2));
    expect(run?.result).toBe("won");
    expect(run?.reward).toBeNull();
  });

  it("a second call for the same attempt writes nothing", () => {
    const user = openUser();
    const before = openSave(1, 7);
    const state = play(1);
    expect(state.lost).toBe(true);
    recordCampaignRun(user, before, before, asWorld(), state, 10);
    recordCampaignRun(user, before, before, asWorld(), state, 99);
    expect(listRuns(user)).toHaveLength(1);
    expect(listRuns(user)[0]?.endedAt).toBe(10);
  });

  it("a loss written when it was reached stays one run through a NavBar exit and a later deal over the save", () => {
    const user = openUser();
    const lostAt = openSave(1, 7);
    const state = play(1);
    writeSave(user, lostAt);
    recordCampaignRun(user, lostAt, lostAt, asWorld(), state, 10); // the table, at the loss
    recordCampaignRun(user, lostAt, lostAt, asWorld(), state, 20); // the Resolution effect, then "Back to path"
    const dealt = { ...openSave(5, 30) };
    writeSave(user, dealt); // Replay + Deal overwrites the lost state
    expect(listRuns(user)).toHaveLength(1);
    expect(listRuns(user)[0]).toMatchObject({ result: "lost", endedAt: 10 });
  });

  it("two attempts that share a seed are two runs when their deals differ", () => {
    const user = openUser();
    const state = play(1);
    recordCampaignRun(user, openSave(1, 100), openSave(1, 100), asWorld(), state);
    recordCampaignRun(user, openSave(1, 200), openSave(1, 200), asWorld(), state);
    expect(listRuns(user)).toHaveLength(2);
  });

  it("copies the foreground time the open scenario counted", () => {
    const user = openUser();
    const before = openSave(2, 111);
    const counted = { ...before, active: { ...before.active!, activeMs: 90000 } };
    expect(recordCampaignRun(user, counted, wonLog(counted, []), asWorld(), play(2), 500)?.activeMs).toBe(90000);
    expect(listRuns(user)[0]?.activeMs).toBe(90000);
  });

  it("writes nothing for a scenario still going or a save with none open", () => {
    const user = openUser();
    const going = goingPast(ctx, 2);
    expect(recordCampaignRun(user, openSave(2), openSave(2), asWorld(), going)).toBeNull();
    const idle = newSave("save-b", "fellowship-of-the-ring", 1);
    expect(recordCampaignRun(user, idle, idle, asWorld(), play(1))).toBeNull();
    expect(listRuns(user)).toHaveLength(0);
    expect(emptyLog(1).completed).toEqual([]);
  });
});

describe("the standalone run writer", () => {
  it("reads the start from the game's created time and writes once", () => {
    const user = openUser();
    const game: StandaloneGame = {
      id: "game-1",
      campaignId: "fellowship-of-the-ring",
      scenarioId: scenario.id,
      seatCount: 1,
      loadout: { scenarioId: scenario.id, difficulty: "Normal", seats: [{ deckId: "d", heroes: ["scout"], deck: [] }], ringBearer: RING_BEARER },
      active: null,
      result: null,
    };
    writeStandalone(user, game, 4242);
    const state = play(2);
    const run = recordStandaloneRun(user, game, asWorld(), state, 9000);
    expect(run).toMatchObject({ kind: "standalone", refId: "game-1", startedAt: 4242, endedAt: 9000, reward: null, heroes: [["scout", RING_BEARER]] });
    expect(run?.activeMs).toBeNull();
    recordStandaloneRun(user, game, asWorld(), state, 9999);
    expect(listRuns(user)).toHaveLength(1);
  });

  it("starts the run when the game was last dealt (a Restart), not when the row was first made, and says when it was continued across an update", () => {
    const user = openUser();
    const game: StandaloneGame = {
      id: "game-2",
      campaignId: "fellowship-of-the-ring",
      scenarioId: "a-shadow-of-the-past",
      seatCount: 1,
      loadout: { scenarioId: "a-shadow-of-the-past", difficulty: "Normal", seats: [{ deckId: "d", heroes: ["scout"], deck: [] }], ringBearer: RING_BEARER },
      active: { engineVersion: 1, dataHash: 1, world: null, seed: 1, intents: [], startedAt: 7000, continued: true },
      result: null,
    };
    writeStandalone(user, game, 4242);
    const run = recordStandaloneRun(user, game, asWorld(), play(2), 9000);
    expect(run).toMatchObject({ startedAt: 7000, rebased: true });
  });
});
