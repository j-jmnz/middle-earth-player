// The fixtures of the Mirkwood Paths and The Dark of Mirkwood parts (src/campaign/fixtures/*.json): each game replays to its moment and the Resolution it parks on, from the log the earlier part's won game writes. When this fails, run scripts/e2e/fixtures.ts again (src/campaign/fixtures.test.ts says how the fixtures are made).
import { describe, expect, it } from "vitest";

import { CATALOG_VERSION } from "../catalog/version.ts";
import { worldFor } from "../../test/harness/fixture-world.ts";

import { fixture, fixtureSave } from "./fixtures.ts";
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
    // Beorn's Path (stage 3B 01122), which the sentence and log rows name.
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
  it("start from the log Passage Through Mirkwood's won game writes, in a Mirkwood Paths save with no Ring-bearer", () => {
    const past = fixture("mirkwood-won");
    const world = worldFor("mirkwood-won");
    const passageSave = fixtureSave("mirkwood-won", "s", CATALOG_VERSION);
    const resumed = resume(passageSave, world);
    if (!resumed.ok) throw new Error(resumed.reason);
    const written = finish(passageSave, world, resumed.state).log;
    for (const name of ["anduin-lost"] as const) {
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

  it("anduin-lost replays to a loss, and finishing it leaves the log as it was", () => {
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
});
