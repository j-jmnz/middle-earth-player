// Rules: emce.guarded-x, emce.immune, emce.treasure, emce.haldan, rr.victory, rr.travel, rr.quest-advancement, rr.surge, rr.step-3-3 (data/rules/entries.json); ledger lines 18028:A:1 to 18041:A:2, 18071:A:1 to 18073:B:2, 18077:A:1 to 18077:B:2, 12169:A:2.
// The encounter cards, the Objective-Locations, the quest stages that are written and Melanwar on the scenario's scene.
import { beforeAll, describe, expect, it } from "vitest";

import { flagged, updateCard } from "../../../rules/core/state.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { reduce } from "../../../rules/engine/reduce.ts";
import { CODES, finish, idOf, loadLostmirkWorld, lostmirkTable, resolveRecords, send, start, type LostmirkWorld, type Run } from "../../../../test/scenarios/lost-in-mirkwood/scene.ts";

let world: LostmirkWorld;
beforeAll(async () => {
  world = await loadLostmirkWorld();
}, 120_000);

const stageCode = (run: Run): string | undefined => (run.state.questStage ? run.state.cards[run.state.questStage]?.code : undefined);

describe("the Objective-Locations (18029 to 18032)", () => {
  it("are objectives that count as locations, with 4 quest points and Victory 4 (rr.victory)", () => {
    for (const code of [CODES.overgrownPath, CODES.abandonedVillage, CODES.bareHilltop, CODES.forestClearing]) {
      const printed = printedOf(world.cards, code);
      expect(printed).toMatchObject({ type: "objective", objectiveLocation: true, questPoints: 4, victory: 4 });
    }
  });

  it("18028:A:1 makes each Objective-Location and each card guarding one immune to player card effects", () => {
    const t = lostmirkTable(world, { staging: [CODES.searchingForAWayOut, CODES.overgrownPath, CODES.forestSpider, CODES.twilightHall] });
    const path = idOf(t.state, CODES.overgrownPath);
    const spider = idOf(t.state, CODES.forestSpider);
    const hall = idOf(t.state, CODES.twilightHall);
    const guarded = updateCard(t.state, spider, { host: path, guard: true });
    const synced = reduce(guarded, { type: "Pass" }, t.ctx).state;
    expect(flagged(synced, path, "immuneToPlayerCards")).toBe(true);
    expect(flagged(synced, hall, "immuneToPlayerCards")).toBe(false);
  });

  it.each([
    ["18029", "18072"],
    ["18030", "18073"],
    ["18031", "18072"],
    ["18032", "18073"],
  ])("traveling to %s advances the quest from stage 1 to %s (the next stage A or C)", (code, expected) => {
    const t = lostmirkTable(world, { stage: "18071", phase: "Travel", staging: [code], deck: ["f0", "f0", "f0"], spiders: [CODES.kingSpider], orcs: [CODES.dolGuldurOrcs] });
    const run = finish(send(start(t.state), { type: "Travel", locationId: idOf(t.state, code) }, t.ctx), t.ctx);
    expect(stageCode(run)).toBe(expected);
  });

  it("18029 and 18031 advance to the next stage A and 18030 and 18032 to the next stage C from stage 2", () => {
    const via = (stage: "18072" | "18073", code: string): string | undefined => {
      const t = lostmirkTable(world, { stage, phase: "Travel", staging: [code], deck: ["f0", "f0", "f0"] });
      return stageCode(finish(send(start(t.state), { type: "Travel", locationId: idOf(t.state, code) }, t.ctx), t.ctx));
    };
    expect(via("18072", CODES.overgrownPath)).toBe("18074");
    expect(via("18073", CODES.abandonedVillage)).toBe("18075");
  });

  it("with no stage of that letter above it the quest stays (\"if able\")", () => {
    const t = lostmirkTable(world, { stage: "18076", phase: "Travel", staging: [CODES.overgrownPath], deck: ["f0"] });
    const run = finish(send(start(t.state), { type: "Travel", locationId: idOf(t.state, CODES.overgrownPath) }, t.ctx), t.ctx);
    expect(stageCode(run)).toBe("18076");
  });
});

describe("18033 Twilight Hall", () => {
  it("gets +2 Threat for each resource on it", () => {
    const t = lostmirkTable(world, { staging: [{ code: CODES.twilightHall, resources: 2 }] });
    const hall = idOf(t.state, CODES.twilightHall);
    const threat = (t.state.modifiers.filter((m) => m.instanceId === hall && m.stat === "threat") ?? []).reduce((sum, m) => sum + m.amount, 0);
    expect(threat).toBe(4);
  });

  it("cannot be traveled to with no resources on it, and raises each player's threat by 1 for each resource when traveled to", () => {
    const none = lostmirkTable(world, { phase: "Travel", staging: [CODES.twilightHall] });
    const refused = reduce(none.state, { type: "Travel", locationId: idOf(none.state, CODES.twilightHall) }, none.ctx);
    expect(refused.ok).toBe(false);
    const two = lostmirkTable(world, { phase: "Travel", staging: [{ code: CODES.twilightHall, resources: 2 }] });
    const run = finish(send(start(two.state), { type: "Travel", locationId: idOf(two.state, CODES.twilightHall) }, two.ctx), two.ctx);
    // 28 + 2 for the 2 resources, + 1 the refresh phase raises it once the travel phase is over.
    expect(run.state.seats[0]?.threat).toBe(31);
  });
});

describe("18071 Ambushed at Night", () => {
  it("Setup brings Haldan, dealt set aside, into the first player's play area", () => {
    const t = lostmirkTable(world, { stage: "18071", setAside: [CODES.haldan] });
    const run = resolveRecords(t.state, t.ctx, "18071", "setup", idOf(t.state, "18071"));
    const haldan = run.state.cards[idOf(run.state, CODES.haldan)];
    expect(haldan).toMatchObject({ zone: "play", controller: 0 });
  });

  it("Side B raises a player's threat by 1 after an enemy engages them", () => {
    const t = lostmirkTable(world, { stage: "18071", phase: "Encounter", staging: [CODES.forestSpider] });
    const run = send(start(t.state), { type: "Engage", enemyId: idOf(t.state, CODES.forestSpider) }, t.ctx);
    expect(finish(run, t.ctx).state.seats[0]?.threat).toBe(29);
  });
});

describe("18072 Spiders of Mirkwood and 18073 Dol Guldur Orcs", () => {
  it("When Revealed shuffles the set into the encounter deck and reveals a card for each player", () => {
    const t = lostmirkTable(world, { stage: "18072", seats: 2, deck: ["f0", "f0", "f0"], spiders: [CODES.kingSpider, CODES.hummerhorns] });
    const run = resolveRecords(t.state, t.ctx, "18072", "whenRevealed", idOf(t.state, "18072"));
    expect(run.state.piles?.spidersDeck ?? []).toEqual([]);
    expect(run.state.encounterDeck.length + run.state.encounterDiscard.length + run.state.staging.length).toBeGreaterThanOrEqual(5);
  });

  it("the Orcs set joins the same way", () => {
    const t = lostmirkTable(world, { stage: "18073", deck: ["f0"], orcs: [CODES.dolGuldurOrcs] });
    const run = resolveRecords(t.state, t.ctx, "18073", "whenRevealed", idOf(t.state, "18073"));
    expect(run.state.piles?.orcsDeck ?? []).toEqual([]);
  });
});

describe("18077 Escape from Taur-nu-fuin", () => {
  it("cannot be defeated while a player is engaged with an enemy", () => {
    const t = lostmirkTable(world, { stage: "18077", progress: 15, engaged: [CODES.forestSpider] });
    expect(restricted(t.state, t.ctx, "advance")).toHaveLength(1);
    const free = lostmirkTable(world, { stage: "18077", progress: 15 });
    expect(restricted(free.state, free.ctx, "advance")).toHaveLength(0);
  });
});

describe("12169 Melanwar", () => {
  // The quest phase is played out (nobody commits, or the first hero does), and Melanwar's Response after the travel phase begins is used; the progress it placed is the result.
  const travelWith = (staging: readonly string[], commit: boolean): number => {
    const t = lostmirkTable(world, { stage: "18071", phase: "Quest", play: [CODES.melanwar], active: CODES.twilightHall, staging, deck: ["f0", "f0"] });
    let run = start(t.state);
    if (commit) run = send(run, { type: "Commit", cardIds: [t.hero] }, t.ctx);
    run = send(run, { type: "Pass" }, t.ctx);
    expect(run.state.phase).toBe("Travel");
    const melanwar = idOf(run.state, CODES.melanwar);
    const before = run.state.cards[run.state.activeLocation ?? ""]?.progress ?? 0;
    run = send(run, { type: "Trigger", cardId: melanwar, effectId: "12169:response:1" }, t.ctx);
    return (run.state.cards[run.state.activeLocation ?? ""]?.progress ?? 0) - before;
  };

  it("places 1 progress on the active location", () => {
    expect(travelWith([], false)).toBe(1);
  });

  it("places 3 progress on the active location when the quest failed this round (the questFailed condition)", () => {
    expect(travelWith(["f3"], false)).toBe(3);
  });

  it("places 1 progress when the quest succeeded", () => {
    expect(travelWith([], true)).toBe(1);
  });
});
