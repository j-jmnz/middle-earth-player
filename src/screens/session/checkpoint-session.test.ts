// Rules: brief, Persistence and shipping (docs/brief.md). The checkpoint of an open game: written at a phase boundary and on a pause, never per intent;
// Continue rebases onto it when the rules changed and it passes the check, and replays from the last matching move when it does not.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import migrations from "../../../drizzle/migrations";
import { loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { temporaryCatalog } from "../../../test/harness/temp-catalog.ts";
import { checkpointOf, restoredState, STATE_VERSION, storedState } from "../../campaign/checkpoint.ts";
import { fixtureSave } from "../../campaign/fixtures.ts";
import { ENGINE_VERSION } from "../../campaign/replay.ts";
import { resume } from "../../campaign/session.ts";
import { dealStandalone, type StandaloneLoadout } from "../../campaign/standalone.ts";
import { loadWorld } from "../../campaign/world.ts";
import { CATALOG_VERSION } from "../../catalog/version.ts";
import { EFFECTS } from "../../effects/index.ts";
import type { ScenarioState } from "../../play/store/store.ts";
import { readCheckpoint, readSave, writeActive, writeCheckpoint, writeSave, writeUndone } from "../data/campaign-store.ts";
import { campaignOf, scenarioOf } from "../data/campaign-data";
import { listRuns } from "../data/run-store.ts";
import { recordCampaignRun } from "../data/run-writers.ts";
import { readStandalone, readStandaloneCheckpoint, writeStandalone, writeStandaloneActive } from "../data/standalone-store.ts";
import { CANNOT_CONTINUE } from "./stale-words.ts";
import { standaloneStore, continueStandaloneGame, openStandalone } from "./standalone-open.ts";
import { continueTable, openTable, sessionStore } from "./table-open.ts";

function openUser() {
  const sqlite = new Database(":memory:");
  for (const entry of migrations.journal.entries) {
    const key = `m${entry.idx.toString().padStart(4, "0")}` as keyof typeof migrations.migrations;
    for (const statement of migrations.migrations[key].split("--> statement-breakpoint")) if (statement.trim()) sqlite.exec(statement.trim());
  }
  return { sqlite, user: drizzle(sqlite) };
}

const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
// The scenario 1 game that is lost: 39 intents, the phase boundaries after the 1st, 2nd, 3rd, 24th, 26th and 28th.
const NAME = "lost";

// The game written to a row, current, with its checks, and the state after each intent.
function openedGame() {
  const { sqlite, user } = openUser();
  const save = fixtureSave(NAME, "s1", CATALOG_VERSION);
  writeSave(user, save);
  const opened = openTable(catalog, user, "s1");
  if (!opened.ok || !opened.stamp?.active) throw new Error("fixture did not open");
  writeActive(user, opened.stamp);
  const states: ScenarioState[] = [];
  resume(opened.stamp, opened.world, (_before, after) => states.push(after));
  return { sqlite, user, save, opened, active: opened.stamp.active, states };
}

// Another engine version, with the check of move `at` changed: the first move the new rules play differently.
function moved(game: ReturnType<typeof openedGame>, at: number) {
  const { active } = game;
  writeActive(game.user, { id: "s1", active: { ...active, engineVersion: ENGINE_VERSION - 1, checks: active.checks!.map((check, index) => (index === at ? check + 1 : check)) } });
}

describe("the checkpoint is written at a phase boundary and on a pause, never per intent", () => {
  it("writes none on a plain move, one at a boundary, keeps it through a move and an Undo, and drops it when Undo goes back past it", () => {
    const { user } = openUser();
    const save = fixtureSave(NAME, "s1", CATALOG_VERSION);
    const intents = save.active!.intents;
    writeSave(user, { ...save, active: { ...save.active!, intents: intents.slice(0, 3) } });
    const opened = openTable(catalog, user, "s1");
    if (!opened.ok) throw new Error("fixture did not open");
    const live = sessionStore(opened, user);
    const { dispatch, undo } = live.store.getState();
    for (let at = 3; at < 23; at += 1) {
      expect(dispatch(intents[at]!)).toBe(true);
      expect(readCheckpoint(user, "s1")).toBeNull();
    }
    expect(dispatch(intents[23]!)).toBe(true);
    const boundary = readCheckpoint(user, "s1")!;
    expect(boundary).toMatchObject({ stateVersion: STATE_VERSION, intentCount: 24, seed: save.active!.seed });
    expect(restoredState(boundary.state)).toEqual(live.store.getState().game);
    expect(dispatch(intents[24]!)).toBe(true);
    expect(readCheckpoint(user, "s1")!.intentCount).toBe(24);
    expect(undo()).toBe(true);
    expect(readCheckpoint(user, "s1")!.intentCount).toBe(24);
    expect(undo()).toBe(true);
    expect(readSave(user, "s1")!.active!.intents).toHaveLength(23);
    expect(readCheckpoint(user, "s1")).toBeNull();
  });

  it("writes the table on a pause, once for the moves it counts", () => {
    const { user } = openUser();
    const save = fixtureSave(NAME, "s1", CATALOG_VERSION);
    const intents = save.active!.intents;
    writeSave(user, { ...save, active: { ...save.active!, intents: intents.slice(0, 4) } });
    const opened = openTable(catalog, user, "s1");
    if (!opened.ok) throw new Error("fixture did not open");
    const live = sessionStore(opened, user);
    expect(live.store.getState().dispatch(intents[4]!)).toBe(true);
    expect(readCheckpoint(user, "s1")).toBeNull();
    live.clock.resume();
    live.clock.pause();
    const written = readCheckpoint(user, "s1")!;
    expect(written.intentCount).toBe(5);
    expect(written.state).toEqual(storedState(live.store.getState().game));
    // The pause adds nothing while the game stands where the checkpoint is.
    writeCheckpoint(user, "s1", { ...written, intentCount: 5, seed: written.seed });
    live.clock.pause();
    expect(readCheckpoint(user, "s1")).toEqual(written);
  });
});

describe("Continue after the rules changed", () => {
  it("rebases onto a checkpoint that passes the check, and a later open replays from the rebase to the same table, with Undo stopping at it", () => {
    const game = openedGame();
    const { user, sqlite, save, active, states } = game;
    const cp = checkpointOf(states[24]!, { intents: active.intents.slice(0, 25), seed: active.seed });
    writeCheckpoint(user, "s1", cp);
    moved(game, 27);
    const sheet = openTable(catalog, user, "s1");
    expect(sheet).toMatchObject({ ok: false, reason: "stale", write: null, takenBack: 39 - 27, fromCheckpoint: true });
    expect(continueTable(catalog, user, "s1")).toEqual({ ok: true });
    const row = readSave(user, "s1")!.active!;
    expect(row.from).toEqual({ stateVersion: STATE_VERSION, state: cp.state });
    expect(row.intents).toEqual(active.intents.slice(25, 27));
    expect(row.checks).toEqual(active.checks!.slice(25, 27));
    expect(row).toMatchObject({ engineVersion: ENGINE_VERSION, seed: active.seed });
    expect(readCheckpoint(user, "s1")).toBeNull();
    // The base has a column of its own: the active scenario column that every intent rewrites does not carry it.
    const raw = sqlite.prepare("select active_scenario as active, rebase from saves where id = 's1'").get() as { active: string; rebase: string };
    expect(JSON.parse(raw.active)).not.toHaveProperty("from");
    expect(JSON.parse(raw.rebase)).toMatchObject({ stateVersion: STATE_VERSION });
    expect(readSave(user, "s1")!.log).toEqual(save.log);

    const again = openTable(catalog, user, "s1");
    if (!again.ok) throw new Error(again.reason);
    expect(again.stamp).toBeNull();
    expect(storedState(again.game)).toEqual(storedState(states[26]!));
    // A move after the rebase writes only the intent; the base stays where it was.
    const live = sessionStore(again, user);
    expect(live.store.getState().dispatch(active.intents[27]!)).toBe(true);
    expect(readSave(user, "s1")!.active!.from).toEqual(row.from);
    let undone = 0;
    while (live.store.getState().undo()) undone += 1;
    // Every move since the rebase comes back, and then there is nothing to undo: the table is the checkpoint's.
    expect(undone).toBe(3);
    expect(live.store.getState().undo()).toBe(false);
    expect(readSave(user, "s1")!.active!.intents).toEqual([]);
    expect(readSave(user, "s1")!.active!.from).toEqual(row.from);
    expect(storedState(live.store.getState().game)).toEqual(cp.state);
  });

  it("continues from the last matching move when the checkpoint fails the check, or is another deal's", () => {
    const game = openedGame();
    const { user, active, states } = game;
    const [id] = Object.keys(states[24]!.cards);
    const broken = { ...states[24]!, cards: { ...states[24]!.cards, [id!]: { ...states[24]!.cards[id!]!, code: "no-such-card" } } };
    for (const cp of [checkpointOf(broken, { intents: active.intents.slice(0, 25), seed: active.seed }), checkpointOf(states[24]!, { intents: active.intents.slice(0, 25), seed: active.seed + 1 })]) {
      writeCheckpoint(user, "s1", cp);
      moved(game, 27);
      expect(openTable(catalog, user, "s1")).toMatchObject({ ok: false, reason: "stale", takenBack: 39 - 27, fromCheckpoint: false });
      expect(continueTable(catalog, user, "s1")).toEqual({ ok: true });
      const row = readSave(user, "s1")!.active!;
      expect(row.from).toBeUndefined();
      expect(row.intents).toEqual(active.intents.slice(0, 27));
      expect(readCheckpoint(user, "s1")).toBeNull();
    }
  });

  it("a rebased game whose base the engine can no longer play asks for a choice and cannot continue; Restart is offered", () => {
    const game = openedGame();
    const { user, active, states } = game;
    writeCheckpoint(user, "s1", checkpointOf(states[24]!, { intents: active.intents.slice(0, 25), seed: active.seed }));
    moved(game, 27);
    expect(continueTable(catalog, user, "s1")).toEqual({ ok: true });
    const rebased = readSave(user, "s1")!;
    const [id] = Object.keys(rebased.active!.from!.state.cards);
    const from = { ...rebased.active!.from!, state: { ...rebased.active!.from!.state, cards: { ...rebased.active!.from!.state.cards, [id!]: { ...rebased.active!.from!.state.cards[id!]!, code: "no-such-card" } } } };
    writeSave(user, { ...rebased, active: { ...rebased.active!, from, engineVersion: ENGINE_VERSION - 1 } });
    expect(openTable(catalog, user, "s1")).toMatchObject({ ok: false, reason: "stale", write: null });
    expect(continueTable(catalog, user, "s1")).toEqual({ ok: false, message: CANNOT_CONTINUE });
  });
});

describe("an Undo is one statement", () => {
  it("writes the shorter game and clears a checkpoint that counted more intents, and keeps one that did not", () => {
    const game = openedGame();
    const { user, active, states } = game;
    const cp = checkpointOf(states[24]!, { intents: active.intents.slice(0, 25), seed: active.seed });
    writeCheckpoint(user, "s1", cp);
    writeUndone(user, { id: "s1", active: { ...active, intents: active.intents.slice(0, 30), checks: active.checks!.slice(0, 30) } });
    expect(readSave(user, "s1")!.active!.intents).toHaveLength(30);
    expect(readCheckpoint(user, "s1")).toEqual(cp);
    writeUndone(user, { id: "s1", active: { ...active, intents: active.intents.slice(0, 24), checks: active.checks!.slice(0, 24) } });
    expect(readSave(user, "s1")!.active!.intents).toHaveLength(24);
    expect(readCheckpoint(user, "s1")).toBeNull();
  });
});

describe("Continue marks the game as finished across an update", () => {
  it("a Continue that cut moves back sets the flag, so the run it ends says so; a silent resume does not", () => {
    const game = openedGame();
    const { user, active } = game;
    moved(game, 27);
    expect(continueTable(catalog, user, "s1")).toEqual({ ok: true });
    const row = readSave(user, "s1")!;
    expect(row.active).toMatchObject({ continued: true });
    expect(row.active!.from).toBeUndefined();
    // The run reads the game's open scenario and the table it ended on (the fixture's own lost table stands in for the one the player reached).
    recordCampaignRun(user, row, row, game.opened.world, game.opened.game);
    expect(listRuns(user).find((run) => run.refId === "s1")?.rebased).toBe(true);
    // The same game untouched by an update carries no flag.
    expect(active.continued).toBeUndefined();
  });
});

describe("a run that finished after a rebase", () => {
  it("carries the rebased flag", () => {
    const { user, opened, active } = openedGame();
    const lost = opened.game;
    expect(lost.lost).toBe(true);
    const from = { stateVersion: STATE_VERSION, state: storedState(lost) };
    const plain = { ...opened.save, id: "s2" };
    recordCampaignRun(user, plain, plain, opened.world, lost);
    const rebased = { ...opened.save, id: "s3", active: { ...active, from } };
    recordCampaignRun(user, rebased, rebased, opened.world, lost);
    const runs = listRuns(user);
    expect(runs.find((run) => run.refId === "s2")?.rebased).toBe(false);
    expect(runs.find((run) => run.refId === "s3")?.rebased).toBe(true);
  });
});

describe("a standalone game", () => {
  const stealth = loadCampaign().starterDecks.find((entry) => entry.id === "stealth-and-steadfastness");
  const deck = stealth?.rows.filter((row) => row.type !== "hero").flatMap((row) => Array.from({ length: row.count }, () => row.code)) ?? [];
  const loadout: StandaloneLoadout = { scenarioId: "a-shadow-of-the-past", difficulty: "Normal", seats: [{ deckId: "deck", heroes: ["141002", "141003", "141004"], deck }], ringBearer: "141001" };
  const world = loadWorld(catalog, campaignOf("fellowship-of-the-ring")!, scenarioOf("a-shadow-of-the-past")!, EFFECTS, ["141001", "141002", "141003", "141004", ...deck]);
  const dealt = dealStandalone("game-1", world, 1, loadout, 1);
  if (!dealt.ok) throw new Error("not dealt");

  it("writes its checkpoint at the boundary the first move crosses, and Continue rebases onto it", () => {
    const { user } = openUser();
    writeStandalone(user, dealt.game);
    const opened = openStandalone(catalog, user, "game-1");
    if (!opened.ok) throw new Error(opened.reason);
    const live = standaloneStore(opened, user);
    expect(readStandaloneCheckpoint(user, "game-1")).toBeNull();
    expect(live.store.getState().dispatch({ type: "Keep" })).toBe(true);
    const cp = readStandaloneCheckpoint(user, "game-1")!;
    expect(cp).toMatchObject({ intentCount: 1, seed: 1 });
    const stored = readStandalone(user, "game-1")!.game.active!;
    writeStandaloneActive(user, { id: "game-1", active: { ...stored, engineVersion: ENGINE_VERSION - 1, checks: [stored.checks![0]! + 1] } });
    expect(openStandalone(catalog, user, "game-1")).toMatchObject({ ok: false, reason: "stale", takenBack: 1, fromCheckpoint: true });
    expect(continueStandaloneGame(catalog, user, "game-1")).toEqual({ ok: true });
    const row = readStandalone(user, "game-1")!.game.active!;
    expect(row.from).toEqual({ stateVersion: STATE_VERSION, state: cp.state });
    expect(row.intents).toEqual([]);
    expect(readStandaloneCheckpoint(user, "game-1")).toBeNull();
    const again = openStandalone(catalog, user, "game-1");
    expect(again).toMatchObject({ ok: true });
    expect(again.ok && storedState(again.game)).toEqual(cp.state);
  });
});
