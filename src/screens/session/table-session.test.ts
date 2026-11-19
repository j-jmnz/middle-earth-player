import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import * as digest from "../../campaign/digest.ts";

import migrations from "../../../drizzle/migrations";
import { temporaryCatalog } from "../../../test/harness/temp-catalog.ts";
import { fixtureSave, hasFixture, type FixtureName } from "../../campaign/fixtures.ts";
import { ENGINE_CHANGES } from "../../campaign/changes.ts";
import { CATALOG_VERSION } from "../../catalog/version.ts";
import { readCheckpoint, readSave, savedAt, writeActive, writeCheckpoint, writeDealt, writeSave } from "../data/campaign-store.ts";
import { ENGINE_VERSION } from "../../campaign/replay.ts";
import { continueTable, openTable, recordUnclosedRun, restartTable, sessionStore } from "./table-open.ts";
import { writeOpenedTable } from "./write-opened.ts";
import { EFFECTS } from "../../effects/index.ts";
import { loadCampaign, loadScenario } from "../../../scripts/data/load-scenarios.ts";
import { newSave, type StoredLoadout } from "../../campaign/save.ts";
import { deal } from "../../campaign/session.ts";
import { loadWorld } from "../../campaign/world.ts";
import { checkpointOf } from "../../campaign/checkpoint.ts";
import { flushRuns } from "../data/pending-runs.ts";
import { listRuns } from "../data/run-store.ts";
import { runs } from "../data/user-schema.ts";

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
  it("a game a change reached is not written on read: it asks for a choice and the row stays", () => {
    const { user } = openUser();
    const save = fixtureSave(name, "s1", CATALOG_VERSION);
    // The save is from before the newest version whose lines include both an "all" line and one scoped to other scenarios.
    const scoped = (change: (typeof ENGINE_CHANGES)[number]) => change.scenarios !== "all" && !change.scenarios.includes("a-shadow-of-the-past");
    const from = Math.max(...ENGINE_CHANGES.filter(scoped).map((change) => change.version)) - 1;
    const old = { ...save, active: { ...save.active!, engineVersion: from } };
    writeSave(user, old);
    const before = savedAt(user).get("s1");
    // The sheet lists the lines of the missed versions that reach the fixture's scenario: the "all" lines, and none scoped to other scenarios.
    expect(old.loadout!.scenarioId).toBe("a-shadow-of-the-past");
    const missed = ENGINE_CHANGES.filter((change) => change.version > from && change.version <= ENGINE_VERSION);
    const everywhere = missed.filter((change) => change.scenarios === "all").map((change) => change.note);
    const elsewhere = missed.filter(scoped).map((change) => change.note);
    expect(everywhere.length).toBeGreaterThan(0);
    expect(elsewhere.length).toBeGreaterThan(0);
    const opened = openTable(catalog, user, "s1");
    expect(opened).toMatchObject({ ok: false, reason: "stale", write: null });
    if (opened.ok) throw new Error("fixture opened");
    expect(opened.changes).toEqual(expect.arrayContaining(everywhere));
    for (const note of elsewhere) expect(opened.changes).not.toContain(note);
    expect(readSave(user, "s1")).toEqual(old);
    expect(savedAt(user).get("s1")).toBe(before);
  });

  it("a current game saved before the world stamp opens with no message and hands back the stamped save to write once; the row is not written by the open", () => {
    const { user } = openUser();
    const save = fixtureSave(name, "s1", CATALOG_VERSION);
    expect(save.active!.world).toBeNull();
    writeSave(user, save);
    const opened = openTable(catalog, user, "s1");
    if (!opened.ok) throw new Error(opened.reason);
    expect(readSave(user, "s1")!.active!.world).toBeNull();
    expect(typeof opened.stamp?.active?.world).toBe("number");
    expect(opened.save).toBe(opened.stamp);
    writeActive(user, opened.stamp!);
    const stamped = readSave(user, "s1")!;
    expect(stamped.active).toEqual({ ...save.active, world: opened.stamp!.active!.world, checks: opened.stamp!.active!.checks });
    // Once stamped, the next open is current with nothing to write.
    expect(openTable(catalog, user, "s1")).toMatchObject({ ok: true, stamp: null });
  });

  it("a game with every check matching resumes with no message across another engine version or world, and is restamped", () => {
    const { user } = openUser();
    const save = fixtureSave(name, "s1", CATALOG_VERSION);
    writeSave(user, save);
    const first = openTable(catalog, user, "s1");
    if (!first.ok || !first.stamp?.active) throw new Error("fixture did not open");
    const { active } = first.stamp;
    expect(active.checks).toHaveLength(active.intents.length);
    for (const moved of [{ engineVersion: ENGINE_VERSION - 1 }, { world: active.world! + 1 }, { engineVersion: ENGINE_VERSION - 1, world: active.world! + 1 }]) {
      writeActive(user, { id: "s1", active: { ...active, ...moved } });
      const opened = openTable(catalog, user, "s1");
      if (!opened.ok) throw new Error(`${opened.reason} on ${JSON.stringify(moved)}`);
      expect(opened.stamp?.active).toEqual(active);
      expect(opened.game).toEqual(first.game);
    }
  });

  it("a changed check is a mismatch at that move: the sheet says how many moves Continue takes back, and Continue keeps the moves before it", () => {
    const { user } = openUser();
    writeSave(user, fixtureSave(name, "s1", CATALOG_VERSION));
    const first = openTable(catalog, user, "s1");
    if (!first.ok || !first.stamp?.active) throw new Error("fixture did not open");
    const { active } = first.stamp;
    const at = 3;
    const checks = active.checks!.map((check, index) => (index === at ? check + 1 : check));
    const tampered = { ...active, engineVersion: ENGINE_VERSION - 1, checks };
    writeActive(user, { id: "s1", active: tampered });
    expect(openTable(catalog, user, "s1")).toMatchObject({ ok: false, reason: "stale", write: null, takenBack: active.intents.length - at });
    expect(readSave(user, "s1")!.active).toEqual(tampered);
    expect(continueTable(catalog, user, "s1")).toEqual({ ok: true });
    const kept = readSave(user, "s1")!.active!;
    expect(kept.intents).toEqual(active.intents.slice(0, at));
    expect(kept.checks).toEqual(active.checks!.slice(0, at));
    expect(kept.engineVersion).toBe(ENGINE_VERSION);
    expect(openTable(catalog, user, "s1")).toMatchObject({ ok: true });
  });

  it("a game of another engine version with no checks asks for a choice; a current one gets its checks once, with a digest for each move", () => {
    const { sqlite, user } = openUser();
    const save = fixtureSave(name, "s1", CATALOG_VERSION);
    writeSave(user, { ...save, active: { ...save.active!, engineVersion: ENGINE_VERSION - 1 } });
    expect(openTable(catalog, user, "s1")).toMatchObject({ ok: false, reason: "stale", takenBack: null });
    writeSave(user, save);
    // The count of digests an open computes: the spy is restored with the test (this config shares modules across files).
    const spy = vi.spyOn(digest, "tableDigest");
    onTestFinished(() => spy.mockRestore());
    const opened = openTable(catalog, user, "s1");
    if (!opened.ok) throw new Error("fixture did not open");
    expect(spy).toHaveBeenCalledTimes(save.active!.intents.length);
    expect(opened.stamp?.active?.checks).toHaveLength(save.active!.intents.length);
    writeActive(user, opened.stamp!);
    // With its checks written, a current game replays with no digest at all.
    spy.mockClear();
    const cold = openTable(catalog, drizzle(sqlite), "s1");
    expect(cold).toMatchObject({ ok: true, stamp: null });
    expect(spy).not.toHaveBeenCalled();
  });

  it("each intent the table sends appends the digest of its table to the save, and Undo takes it off", () => {
    const { user } = openUser();
    const save = fixtureSave(name, "s1", CATALOG_VERSION);
    writeSave(user, { ...save, active: { ...save.active!, intents: save.active!.intents.slice(0, -1) } });
    const opened = openTable(catalog, user, "s1");
    if (!opened.ok) throw new Error("fixture did not open");
    const live = sessionStore(opened, user);
    const before = live.save().active!.checks!.length;
    expect(live.store.getState().dispatch(save.active!.intents.at(-1)!)).toBe(true);
    const written = readSave(user, "s1")!.active!;
    expect(written.checks).toHaveLength(before + 1);
    expect(written.checks!.at(-1)).toBe(digest.tableDigest(live.store.getState().game));
    expect(live.store.getState().undo()).toBe(true);
    expect(readSave(user, "s1")!.active!.checks).toHaveLength(before);
  });

  it("a game from before the world stamp that was dealt on other card data asks for a choice and is not written", () => {
    const { user } = openUser();
    const save = fixtureSave(name, "s1", CATALOG_VERSION + 1);
    writeSave(user, save);
    expect(openTable(catalog, user, "s1")).toMatchObject({ ok: false, reason: "stale", write: null });
    expect(readSave(user, "s1")).toEqual(save);
  });

  it("Continue keeps the accepted intents, restamped, and the table opens on them", () => {
    const { user } = openUser();
    const save = fixtureSave(name, "s1", CATALOG_VERSION);
    const total = save.active!.intents.length;
    writeSave(user, { ...save, active: { ...save.active!, engineVersion: ENGINE_VERSION - 1, dataHash: CATALOG_VERSION + 1, intents: [...save.active!.intents, { type: "NoSuchIntent" } as never] } });
    expect(continueTable(catalog, user, "s1")).toEqual({ ok: true });
    const kept = readSave(user, "s1")!;
    expect(kept.active).toMatchObject({ engineVersion: ENGINE_VERSION, dataHash: CATALOG_VERSION, seed: save.active!.seed });
    expect(typeof kept.active!.world).toBe("number");
    expect(kept.active!.intents).toEqual(save.active!.intents);
    expect(kept.active!.intents.length).toBe(total);
    expect(kept.log).toEqual(save.log);
    expect(openTable(catalog, user, "s1")).toMatchObject({ ok: true });
  });

  it("Restart deals again with the stored loadout and a new seed, keeping the log", () => {
    const { user } = openUser();
    const save = fixtureSave(name, "s1", CATALOG_VERSION);
    writeSave(user, { ...save, active: { ...save.active!, engineVersion: ENGINE_VERSION - 1 } });
    expect(restartTable(catalog, user, "s1")).toEqual({ ok: true });
    const restarted = readSave(user, "s1")!;
    expect(restarted.active).toMatchObject({ engineVersion: ENGINE_VERSION, dataHash: CATALOG_VERSION, intents: [] });
    expect(typeof restarted.active!.world).toBe("number");
    expect(restarted.loadout).toEqual(save.loadout);
    expect(restarted.log).toEqual(save.log);
    expect(openTable(catalog, user, "s1")).toMatchObject({ ok: true });
  });

  it("replays a save once and hands the same session back while the save is as it was", () => {
    const { user } = openUser();
    writeSave(user, fixtureSave(name, "s1", CATALOG_VERSION));
    const first = openTable(catalog, user, "s1");
    expect(first.ok).toBe(true);
    // The hook stamps a save from before the world stamp once; the stamped save is the one the cache holds.
    if (first.ok && first.stamp) writeActive(user, first.stamp);
    const second = openTable(catalog, user, "s1");
    expect(second.ok && second.save).toEqual(first.ok && first.save);
    expect(openTable(catalog, user, "s1")).toBe(second);
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

describe("a deal the briefing makes", () => {
  const campaign = loadCampaign();
  const scenario = loadScenario("a-shadow-of-the-past");
  const stealth = campaign.starterDecks.find((entry) => entry.id === "stealth-and-steadfastness");
  const deck = stealth?.rows.filter((row) => row.type !== "hero").flatMap((row) => Array.from({ length: row.count }, () => row.code)) ?? [];
  const loadout: StoredLoadout = { scenarioId: scenario.id, difficulty: "Normal", seats: [{ deckId: "deck", heroes: ["141002", "141003", "141004"], deck }], ringBearer: "141001", choices: [], acceptPenalty: false };
  const mine = ["141001", "141002", "141003", "141004", ...deck];
  // The briefing loads the heroes and cards of every saved deck, not only the one dealt.
  const others = campaign.starterDecks.filter((entry) => entry.id !== stealth?.id).flatMap((entry) => entry.rows.map((row) => row.code));

  it("opens current on the table, whatever else the briefing's world carried (the stamp and the open hash the same cards)", () => {
    for (const extra of [[], others]) {
      const { user } = openUser();
      const world = loadWorld(catalog, campaign, scenario, EFFECTS, [...mine, ...extra]);
      const dealt = deal(newSave("s9", campaign.id, 1), world, loadout, 4, 100);
      if (!dealt.ok) throw new Error("not dealt");
      writeDealt(user, dealt.save);
      expect(openTable(catalog, user, "s9")).toMatchObject({ ok: true, stamp: null });
    }
    expect(others.length).toBeGreaterThan(0);
  });

  it("clears the checkpoint of the game it replaces, in the same statement, even with the same seed", () => {
    const { user } = openUser();
    const world = loadWorld(catalog, campaign, scenario, EFFECTS, mine);
    const first = deal(newSave("s9", campaign.id, 1), world, loadout, 4, 100);
    if (!first.ok) throw new Error("not dealt");
    writeDealt(user, first.save);
    const opened = openTable(catalog, user, "s9");
    if (!opened.ok) throw new Error("not open");
    writeCheckpoint(user, "s9", checkpointOf(opened.game, first.save.active!));
    expect(readCheckpoint(user, "s9")).not.toBeNull();
    // A plain write of the save (the log, the loadout) keeps it; a deal does not.
    writeSave(user, first.save);
    expect(readCheckpoint(user, "s9")).not.toBeNull();
    const again = deal(first.save, world, loadout, 4, 200);
    if (!again.ok) throw new Error("not dealt");
    writeDealt(user, again.save);
    expect(readCheckpoint(user, "s9")).toBeNull();
  });
});

describe("the write an open makes", () => {
  it("is made once for a session: the effect running again (a hidden table shown again) never writes the open's save over the moves played since", () => {
    const { user } = openUser();
    const save = fixtureSave(name, "s1", CATALOG_VERSION);
    const intents = save.active!.intents;
    writeSave(user, { ...save, active: { ...save.active!, intents: intents.slice(0, -1) } });
    const opened = openTable(catalog, user, "s1");
    if (!opened.ok || !opened.stamp) throw new Error("fixture did not open with a stamp");
    writeOpenedTable(user, opened);
    expect(readSave(user, "s1")!.active!.intents).toHaveLength(intents.length - 1);
    const live = sessionStore(opened, user);
    expect(live.store.getState().dispatch(intents.at(-1)!)).toBe(true);
    expect(readSave(user, "s1")!.active!.intents).toHaveLength(intents.length);
    // The effect runs again for the same session.
    writeOpenedTable(user, opened);
    expect(readSave(user, "s1")!.active!.intents).toHaveLength(intents.length);
  });

  it("a session the cache hands to the Resolution after moves carries no stamp, so its open writes nothing", () => {
    const { user } = openUser();
    const save = fixtureSave(name, "s1", CATALOG_VERSION);
    writeSave(user, { ...save, active: { ...save.active!, intents: save.active!.intents.slice(0, -1) } });
    const opened = openTable(catalog, user, "s1");
    if (!opened.ok || !opened.stamp) throw new Error("fixture did not open with a stamp");
    const live = sessionStore(opened, user);
    expect(live.store.getState().dispatch(save.active!.intents.at(-1)!)).toBe(true);
    const later = openTable(catalog, user, "s1");
    expect(later).toMatchObject({ ok: true, stamp: null });
    writeOpenedTable(user, later);
    expect(readSave(user, "s1")!.active!.intents).toHaveLength(save.active!.intents.length);
  });

  it("leaves a game whose scenario is not in this build as it is: it reads as not open, and nothing is dropped", () => {
    const { user } = openUser();
    const save = fixtureSave(name, "s1", CATALOG_VERSION);
    const gone = { ...save, loadout: { ...save.loadout!, scenarioId: "a-scenario-from-a-later-build" } };
    writeSave(user, gone);
    const opened = openTable(catalog, user, "s1");
    expect(opened).toMatchObject({ ok: false, reason: "none", write: null });
    writeOpenedTable(user, opened);
    expect(readSave(user, "s1")).toEqual(gone);
  });
});
