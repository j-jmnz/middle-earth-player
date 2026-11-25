// Rules: rr.forced, rr.travel, rr.then, rr.cannot, rr.engaged, hrd.side-quests, hrd.current-quest (data/rules/entries.json); ledger lines of Escape from Umbar (data/printed/haradrim.json).
import { describe, expect, it } from "vitest";

import type { ScenarioState } from "../../../rules/core/state.ts";
import { asCurrentQuest } from "../../../rules/families/sidequests/fixture.ts";
import { engagedCodes, idOf, opened, resolveRecords, run as runInstruction, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

// Multi-step moments of Escape from Umbar that a spec row cannot hold: the main quest while a side quest is current, a travel that searches, the locks of the Champion, the loss of the main quest and the hand limit.
// The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; every seat starts at threat 28.
const table = (layout: Layout = {}) => tableFromLayout("escape-from-umbar", { seats: 1, ...layout });
const MAIN = "16066";
const SIDE_QUEST = "16045";
const progress = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.progress ?? 0;
const withSideCurrent = (made: ReturnType<typeof table>): ScenarioState => asCurrentQuest(opened(made).state, idOf(made.state, SIDE_QUEST));

describe("The progress that the Forced effects remove comes off the main quest, also while a side quest is the current quest", () => {
  it("16015:A:2 Umbar Sentry: the option progress takes 1 off the main quest and none off the current side quest", () => {
    const made = table({ stage: MAIN, progress: 4, staging: [{ code: SIDE_QUEST, progress: 3 }, "16015"] });
    const done = resolveRecords(withSideCurrent(made), made.ctx, "16015", "forced", undefined, () => "progress");
    expect(progress(done.state, MAIN)).toBe(3);
    expect(progress(done.state, SIDE_QUEST)).toBe(3);
  });

  it("16042:A:1 Southron Soldier: the option progress takes 2 off the main quest and none off the current side quest", () => {
    const made = table({ stage: MAIN, progress: 4, staging: [{ code: SIDE_QUEST, progress: 3 }, "16042"] });
    const done = resolveRecords(withSideCurrent(made), made.ctx, "16042", "forced", undefined, () => "progress");
    expect(progress(done.state, MAIN)).toBe(2);
    expect(progress(done.state, SIDE_QUEST)).toBe(3);
  });

  it("16043:A:2 Southron Archer: the option progress takes 2 off the main quest and none off the current side quest", () => {
    const made = table({ stage: MAIN, progress: 4, staging: [{ code: SIDE_QUEST, progress: 3 }, "16043"] });
    const done = resolveRecords(withSideCurrent(made), made.ctx, "16043", "forced", undefined, () => "progress");
    expect(progress(done.state, MAIN)).toBe(2);
    expect(progress(done.state, SIDE_QUEST)).toBe(3);
  });

  it("16015:A:2 Umbar Sentry: the option progress is not offered while the main quest holds none, though the current side quest holds some", () => {
    const made = table({ stage: MAIN, progress: 0, staging: [{ code: SIDE_QUEST, progress: 3 }, "16015"] });
    const offered: string[] = [];
    const done = resolveRecords(withSideCurrent(made), made.ctx, "16015", "forced", undefined, (state) => {
      offered.push(...(state.window?.kind === "choose" ? state.window.options : []));
      return state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "";
    });
    expect(offered).not.toContain("progress");
    expect(progress(done.state, SIDE_QUEST)).toBe(3);
  });
});

describe("16020:A:2 Haradrim Estate travel", () => {
  it("a Harad enemy found in the deck engages the first player, 1 progress goes on the main quest and the deck is shuffled", () => {
    const made = table({ stage: MAIN, staging: ["16020"], deck: ["f0", "16041"] });
    const done = resolveRecords(opened(made).state, made.ctx, "16020", "travel");
    expect(engagedCodes(done.state)).toEqual(["16041"]);
    expect(progress(done.state, MAIN)).toBe(1);
  });

  it("with no Harad enemy to find, the cost is paid and no progress goes on the main quest (rr.then)", () => {
    const made = table({ stage: MAIN, staging: ["16020"], deck: ["f0"] });
    const done = resolveRecords(opened(made).state, made.ctx, "16020", "travel");
    expect(engagedCodes(done.state)).toEqual([]);
    expect(progress(done.state, MAIN)).toBe(0);
  });

  it("the Soldier put into play engaged by the search engages the player, so its Forced effect opens its choice", () => {
    const made = table({ stage: MAIN, progress: 3, staging: ["16020"], deck: ["16042"] });
    const done = resolveRecords(opened(made).state, made.ctx, "16020", "travel", undefined, () => "progress", false);
    expect(progress(done.state, MAIN)).toBe(2);
  });
});

describe("16040:A:1 the main quest stage cannot be defeated while the Champion is in play", () => {
  const ADD = { verb: "AddStageProgress", amount: 1 } as const;
  it("the main quest stage that takes its last progress waits while the side quest 16040 and the Champion are in play", () => {
    const made = table({ stage: MAIN, progress: 14, staging: ["16040", { code: "16041", resources: 1 }] });
    const stays = runInstruction(made, opened(made).state, ADD);
    expect(progress(stays, MAIN)).toBe(15);
    expect(stays.questStage).toBe(idOf(stays, MAIN));
  });

  it("the main quest stage advances once the Champion is out of play", () => {
    const made = table({ stage: MAIN, progress: 14, staging: ["16040"] });
    const moved = runInstruction(made, opened(made).state, ADD);
    expect(moved.questStage).toBe(idOf(moved, "16067"));
  });

  it("the main quest stage advances when the side quest 16040 is not in play, whatever enemy holds a resource token", () => {
    const made = table({ stage: MAIN, progress: 14, staging: [{ code: "16041", resources: 1 }] });
    const moved = runInstruction(made, opened(made).state, ADD);
    expect(moved.questStage).toBe(idOf(moved, "16067"));
  });
});
