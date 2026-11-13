// The fixtures of the Mirkwood Paths and The Dark of Mirkwood parts (src/campaign/fixtures/*.json): each game replays to its moment and the Resolution it parks on, from the log the earlier part's won game writes. When this fails, run scripts/e2e/fixtures.ts again (src/campaign/fixtures.test.ts says how the fixtures are made).
import { describe, expect, it } from "vitest";

import { CATALOG_VERSION } from "../catalog/version.ts";
import { worldFor } from "../../test/harness/fixture-world.ts";

import { fixture, fixtureSave, hasFixture } from "./fixtures.ts";
import { emptyLog } from "./log.ts";
import { campaignPath } from "./path.ts";
import { settledSentence, resolutionView } from "./resolution-view.ts";
import { finish, resume } from "./session.ts";

describe("Passage Through Mirkwood (Mirkwood Paths part 1, phase 29)", () => {
  it("are two-handed games of two decklists from an empty Mirkwood Paths log, with no Ring-bearer", () => {
    for (const name of ["mirkwood-won", "mirkwood-lost"] as const) {
      const found = fixture(name);
      expect(found.campaignId, name).toBe("mirkwood-paths");
      expect(found.seatCount, name).toBe(2);
      expect(found.loadout.scenarioId, name).toBe("passage-through-mirkwood");
      expect(found.loadout.ringBearer, name).toBeNull();
      expect(found.log.completed, name).toEqual([]);
      expect(fixtureSave(name, "s", CATALOG_VERSION).campaignId, name).toBe("mirkwood-paths");
    }
  });

  it("mirkwood-won replays to a win with nothing to answer, and confirming it writes the Resolution and unlocks Journey Along the Anduin", () => {
    const world = worldFor("mirkwood-won");
    const save = fixtureSave("mirkwood-won", "s", CATALOG_VERSION);
    const resumed = resume(save, world);
    expect(resumed.ok && resumed.state.stageCleared && !resumed.state.lost).toBe(true);
    if (!resumed.ok) return;
    const view = resolutionView(resumed.state, world);
    expect(view.kind).toBe("settled");
    // Beorn's Path (stage 3B 01122), which the Maestro flow's sentence and log rows name.
    expect(resumed.state.stagesReached).toEqual(["01120", "01122"]);
    if (view.kind === "settled") expect(settledSentence(view, world, "Journey Along the Anduin")).toBe("Confirming records 2 copies of Mendor's Support and the burden Ungoliant's Swarm in the campaign and unlocks Journey Along the Anduin.");
    const after = finish(save, world, resumed.state);
    expect(after.log.completed).toEqual(["passage-through-mirkwood"]);
    expect(after.log.campaignPool.filter((card) => card.code === "01132")).toHaveLength(2);
    expect(campaignPath(world.campaign, {}, after.log).map((node) => node.status).slice(0, 3)).toEqual(["completed", "current", "locked"]);
  });

  it("mirkwood-lost replays to a loss when Mendor leaves play, and finishing it leaves the log as it was", () => {
    const world = worldFor("mirkwood-lost");
    const save = fixtureSave("mirkwood-lost", "s", CATALOG_VERSION);
    const resumed = resume(save, world);
    expect(resumed.ok && resumed.state.lost).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.state.lossReason).toBe("Mendor left play");
    expect(resolutionView(resumed.state, world)).toEqual({ kind: "lost", reason: "Mendor left play" });
    const after = finish(save, world, resumed.state);
    expect(after.log).toEqual(save.log);
    expect(campaignPath(world.campaign, {}, after.log).map((node) => node.status)[0]).toBe("current");
  });
});

describe("Journey Along the Anduin (Mirkwood Paths part 2, phase 30)", () => {
  const ANDUIN_LOST = hasFixture("anduin-lost");
  const ANDUIN_WON = hasFixture("anduin-won");

  it.skipIf(!ANDUIN_LOST && !ANDUIN_WON)("start from the log Passage Through Mirkwood's won game writes, in a Mirkwood Paths save with no Ring-bearer", () => {
    const past = fixture("mirkwood-won");
    const world = worldFor("mirkwood-won");
    const passageSave = fixtureSave("mirkwood-won", "s", CATALOG_VERSION);
    const resumed = resume(passageSave, world);
    if (!resumed.ok) throw new Error(resumed.reason);
    const written = finish(passageSave, world, resumed.state).log;
    for (const name of ["anduin-won", "anduin-lost"] as const) {
      if (!hasFixture(name)) continue;
      const found = fixture(name);
      expect(found.campaignId, name).toBe("mirkwood-paths");
      expect(found.seatCount, name).toBe(2);
      expect(found.loadout.scenarioId, name).toBe("journey-along-the-anduin");
      expect(found.loadout.ringBearer, name).toBeNull();
      expect(found.past?.fixture, name).toBe("mirkwood-won");
      expect(found.log, name).toEqual(written);
      expect(found.log.completed, name).toEqual(["passage-through-mirkwood"]);
      expect(past.seatCount, name).toBe(2);
    }
  });

  it.skipIf(!ANDUIN_LOST)("anduin-lost replays to a loss, and finishing it leaves the log as it was", () => {
    const world = worldFor("anduin-lost");
    const save = fixtureSave("anduin-lost", "s", CATALOG_VERSION);
    const resumed = resume(save, world);
    expect(resumed.ok && resumed.state.lost).toBe(true);
    if (!resumed.ok) return;
    expect(resolutionView(resumed.state, world)).toEqual({ kind: "lost", reason: resumed.state.lossReason });
    const after = finish(save, world, resumed.state);
    expect(after.log).toEqual(save.log);
    expect(campaignPath(world.campaign, {}, after.log).map((node) => node.status).slice(0, 3)).toEqual(["completed", "current", "locked"]);
  });

  it.skipIf(!ANDUIN_WON)("anduin-won replays to a win with nothing to answer, and confirming it writes the prisoner and unlocks Escape from Dol Guldur", () => {
    const world = worldFor("anduin-won");
    const save = fixtureSave("anduin-won", "s", CATALOG_VERSION);
    const resumed = resume(save, world);
    expect(resumed.ok && resumed.state.stageCleared && !resumed.state.lost).toBe(true);
    if (!resumed.ok) return;
    const view = resolutionView(resumed.state, world);
    expect(view.kind).toBe("settled");
    if (view.kind === "settled") {
      expect(view.prisoner).toBeTruthy();
      expect(settledSentence(view, world, "Escape from Dol Guldur")).toMatch(/ and unlocks Escape from Dol Guldur\. .+, the hero with the most damage, is taken prisoner\.$/);
    }
    const after = finish(save, world, resumed.state);
    expect(after.log.completed).toEqual(["passage-through-mirkwood", "journey-along-the-anduin"]);
    expect(after.log.prisoner).toBe(view.kind === "settled" ? view.prisoner : null);
    expect(campaignPath(world.campaign, {}, after.log).map((node) => node.status).slice(0, 3)).toEqual(["completed", "completed", "current"]);
  });
});

describe("Escape from Dol Guldur (Mirkwood Paths part 3, phase 31)", () => {
  const LOST = hasFixture("dol-guldur-lost");

  it.skipIf(!LOST)("dol-guldur-lost replays to a loss, and finishing it writes nothing", () => {
    const world = worldFor("dol-guldur-lost");
    const save = fixtureSave("dol-guldur-lost", "s", CATALOG_VERSION);
    expect(save.log.prisoner).toBeTruthy();
    const resumed = resume(save, world);
    expect(resumed.ok && resumed.state.lost).toBe(true);
    if (!resumed.ok) return;
    expect(resolutionView(resumed.state, world)).toEqual({ kind: "lost", reason: resumed.state.lossReason });
    const after = finish(save, world, resumed.state);
    expect(after.log).toEqual(save.log);
    expect(campaignPath(world.campaign, {}, after.log).map((node) => node.status).slice(0, 4)).toEqual(["completed", "completed", "current", "locked"]);
  });
});

describe("The Oath (The Dark of Mirkwood part 1, phase 32)", () => {
  it("are two-handed games of two decklists from the blank log a new The Dark of Mirkwood playthrough starts on, each seat's Adaptation chosen", () => {
    for (const name of ["oath-won", "oath-lost"] as const) {
      const found = fixture(name);
      expect(found.campaignId, name).toBe("the-dark-of-mirkwood");
      expect(found.seatCount, name).toBe(2);
      expect(found.loadout.scenarioId, name).toBe("the-oath");
      expect(found.loadout.ringBearer, name).toBeNull();
      expect(found.log, name).toEqual(emptyLog(2));
      expect(found.past, name).toBeNull();
      expect(found.loadout.choices.map((choice) => choice.split(">")[0]), name).toEqual(["41044", "41045"]);
    }
  });

  it("oath-won replays to a win with nothing to answer, and confirming it writes the used Adaptation and the pool, and unlocks The Caves of Nibin-Dûm", () => {
    const world = worldFor("oath-won");
    const save = fixtureSave("oath-won", "s", CATALOG_VERSION);
    const resumed = resume(save, world);
    expect(resumed.ok && resumed.state.stageCleared && !resumed.state.lost).toBe(true);
    if (!resumed.ok) return;
    const view = resolutionView(resumed.state, world);
    expect(view.kind).toBe("settled");
    // Goblin Troop was brought into play (stage 3's When Revealed) and defeated: it is not set aside (rr.quest-advancement).
    expect(Object.values(resumed.state.cards).filter((card) => card.code === "41019").map((card) => card.zone)).not.toContain("setAside");
    if (view.kind === "settled") expect(settledSentence(view, world, "The Caves of Nibin-Dûm")).toMatch(/^Confirming records .* and unlocks The Caves of Nibin-Dûm\. .* recorded as used this campaign\./);
    const tokens = Object.values(resumed.state.cards).find((card) => card.code === "41050")?.resources ?? -1;
    expect(tokens).toBeGreaterThanOrEqual(0);
    const after = finish(save, world, resumed.state);
    expect(after.log.completed).toEqual(["the-oath"]);
    expect(after.log.counters).toEqual({});
    expect(after.log.usedOnce.length).toBeGreaterThan(0);
    // The Adaptations the seats chose and Stalking Goblin are in the pool; Guilty Conscience with 6 or more tokens.
    const pool = after.log.campaignPool.map((card) => card.code);
    expect(pool).toEqual(expect.arrayContaining(["41044", "41045", "41041"]));
    expect(pool.includes("41043")).toBe(tokens >= 6);
    expect(campaignPath(world.campaign, {}, after.log).map((node) => node.status)).toEqual(["completed", "current"]);
  });

  it("oath-lost replays to a loss, and finishing it writes nothing", () => {
    const world = worldFor("oath-lost");
    const save = fixtureSave("oath-lost", "s", CATALOG_VERSION);
    const resumed = resume(save, world);
    expect(resumed.ok && resumed.state.lost).toBe(true);
    if (!resumed.ok) return;
    expect(resolutionView(resumed.state, world)).toEqual({ kind: "lost", reason: resumed.state.lossReason });
    const after = finish(save, world, resumed.state);
    expect(after.log).toEqual(save.log);
    expect(after.log.usedOnce).toEqual([]);
    expect(campaignPath(world.campaign, {}, after.log).map((node) => node.status)).toEqual(["current", "locked"]);
  });
});

describe("The Caves of Nibin-Dûm (The Dark of Mirkwood part 2, phase 33)", () => {
  const WON = hasFixture("nibin-dum-won");

  it("start from the log a real oath-won game writes when it is confirmed, in a The Dark of Mirkwood save, each seat's cards from the pool", () => {
    const oathSave = fixtureSave("oath-won", "s", CATALOG_VERSION);
    const resumed = resume(oathSave, worldFor("oath-won"));
    if (!resumed.ok) throw new Error(resumed.reason);
    const written = finish(oathSave, worldFor("oath-won"), resumed.state).log;
    for (const name of ["nibin-dum-won", "nibin-dum-lost"] as const) {
      if (!hasFixture(name)) continue;
      const found = fixture(name);
      expect(found.campaignId, name).toBe("the-dark-of-mirkwood");
      expect(found.seatCount, name).toBe(2);
      expect(found.loadout.scenarioId, name).toBe("the-caves-of-nibin-dum");
      expect(found.loadout.ringBearer, name).toBeNull();
      expect(found.log, name).toEqual(written);
      expect(found.log.completed, name).toEqual(["the-oath"]);
      expect(found.past?.fixture, name).toBe("oath-won");
    }
  });

  it("nibin-dum-lost replays to a loss, and finishing it writes nothing: The Caves of Nibin-Dûm stays current and nothing is carried over", () => {
    const world = worldFor("nibin-dum-lost");
    const save = fixtureSave("nibin-dum-lost", "s", CATALOG_VERSION);
    const resumed = resume(save, world);
    expect(resumed.ok && resumed.state.lost).toBe(true);
    if (!resumed.ok) return;
    expect(resolutionView(resumed.state, world)).toEqual({ kind: "lost", reason: resumed.state.lossReason });
    const after = finish(save, world, resumed.state);
    expect(after.log).toEqual(save.log);
    expect(after.log.carryOver).toEqual([]);
    expect(campaignPath(world.campaign, {}, after.log).map((node) => node.status)).toEqual(["completed", "current"]);
  });

  it.skipIf(!WON)("nibin-dum-won replays to a win with nothing to answer, and confirming it completes the campaign and writes the Ranger Sense carry-over", () => {
    const world = worldFor("nibin-dum-won");
    const save = fixtureSave("nibin-dum-won", "s", CATALOG_VERSION);
    const resumed = resume(save, world);
    expect(resumed.ok && resumed.state.stageCleared && !resumed.state.lost).toBe(true);
    if (!resumed.ok) return;
    const view = resolutionView(resumed.state, world);
    expect(view.kind).toBe("settled");
    const after = finish(save, world, resumed.state);
    expect(after.log.completed).toEqual(["the-oath", "the-caves-of-nibin-dum"]);
    expect(campaignPath(world.campaign, {}, after.log).map((node) => node.status)).toEqual(["completed", "completed"]);
    const highest = Math.max(...resumed.state.seats.slice(0, resumed.state.seatCount).map((seat) => seat.threat));
    expect(after.log.carryOver.map((card) => card.code)).toEqual(highest < 40 ? ["41049"] : []);
  });
});
