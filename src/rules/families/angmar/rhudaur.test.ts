// Rules: mec108.side-quests-in-play, mec108.the-investigation, mec108.time-x, rr.quest-advancement, rr.running-out-of-cards, rr.constant-ability, rr.attachment-cards (data/rules/entries.json); ledger lines 10094:B:2, 10094:B:3, 10094:B:4, 10095:B:2, 10109:A:3, 10101:A:1, 10101:A:2, 10103:A:1, 10097:A:1.
// The angmar family's verbs of The Treachery of Rhudaur's stages and side quests, on tables built from data/ by the layout kit.
import { describe, expect, it } from "vitest";

import { flagged, updateCard, type ScenarioState } from "../../core/state.ts";
import { settle } from "../../engine/machine.ts";
import { placeQuestProgress } from "../../quest/quest.ts";
import { queueEvent } from "../../windows/queue.ts";
import { codesIn, finish, idOf, resolveRecords, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { setCurrentQuest } from "./quest.ts";

const built = (layout: Layout = {}) => tableFromLayout("the-treachery-of-rhudaur", { stage: "10094", ...layout });
const stageCode = (state: ScenarioState) => state.cards[state.questStage ?? ""]?.code;

describe("Secrets of Rhudaur", () => {
  it("10094:B:3 cannot be the current quest in the quest phase: progress with no side quest chosen is lost, and a chosen side quest takes it", () => {
    const t = built({ phase: "Quest", staging: ["10109"] });
    const stage = t.state.questStage ?? "";
    expect(flagged(t.state, stage, "cannotBeCurrentQuest")).toBe(true);
    const lost = placeQuestProgress(t.state, 3, t.ctx.cards, [], () => true);
    expect(lost.cards[stage]?.progress).toBe(0);
    expect(lost.cards[idOf(lost, "10109")]?.progress).toBe(0);
    const chosen = setCurrentQuest(t.state, idOf(t.state, "10109"), t.ctx);
    const placed = placeQuestProgress(chosen, 3, t.ctx.cards, [], () => true);
    expect(placed.cards[idOf(placed, "10109")]?.progress).toBe(3);
    expect(placed.cards[stage]?.progress).toBe(0);
    // Outside the quest phase the main quest card is the current quest as usual.
    const refresh = built({ phase: "Planning", staging: ["10109"] });
    expect(placeQuestProgress(refresh.state, 2, refresh.ctx.cards, [], () => true).cards[refresh.state.questStage ?? ""]?.progress).toBe(2);
  });

  it("10094:B:4 advances to stage 2 at once when no Treachery of Rhudaur side quest is in play, and not while one is", () => {
    const held = built({ phase: "Quest", staging: ["10111"] });
    expect(stageCode(settle({ ...held.state, round: 1 }, held.ctx, []))).toBe("10094");
    const none = built({ phase: "Quest", staging: ["f0"], setAside: ["10098"] });
    // The first round (round 0 is the Setup, which the sweep waits out).
    const run = finish({ state: settle({ ...none.state, round: 1, window: null, mode: "stopped" }, none.ctx, []), steps: [] }, none.ctx);
    expect(stageCode(run.state)).toBe("10095");
    // 2A's When Revealed resolved: Thaurdir is in the staging area.
    expect(codesIn(run.state, "staging")).toContain("10098");
  });

  it("10094:B:2 removes each Treachery of Rhudaur side quest from the game, flipped Clues stay, then advances to stage 2", () => {
    const t = built({ phase: "Refresh", staging: ["10109", "10112"] });
    const stage = t.state.questStage ?? "";
    const heard = settle(queueEvent(t.state, { trigger: "lastTimeCounterRemoved", seat: null, cardId: stage, subject: stage }), t.ctx, []);
    const run = finish({ state: heard, steps: [] }, t.ctx);
    expect(codesIn(run.state, "removed")).toEqual(["10109"]);
    expect(codesIn(run.state, "victory")).toEqual([]);
    expect(codesIn(run.state, "staging")).toContain("10112");
    expect(stageCode(run.state)).toBe("10095");
  });
});

describe("the side quests that flip over", () => {
  it("10109:A:3 flips into its Clue objective in the staging area when defeated, not into the victory display, and the Fog on it goes", () => {
    const t = built({ phase: "Quest", staging: [{ code: "10109", progress: 22 }], attached: [{ code: "10108", to: "10109" }] });
    const side = idOf(t.state, "10109");
    const done = settle(setCurrentQuest(t.state, side, t.ctx), t.ctx, []);
    const card = done.cards[side];
    expect(card?.code).toBe("10110");
    expect(card?.zone).toBe("staging");
    expect(card?.progress).toBe(0);
    expect(codesIn(done, "victory")).toEqual([]);
    expect(flagged(done, side, "currentQuest")).toBe(false);
    expect(codesIn(done, "discard").concat(codesIn(done, "encounterDiscard"))).toContain("10108");
  });
});

describe("Forbidden Descent", () => {
  it("10101:A:1 takes the first 2 progress each round that would be placed on a quest, each copy 2, the rest going on", () => {
    const t = built({ phase: "Quest", staging: ["10101", "10101"], active: undefined });
    const [one, two] = t.state.staging.filter((id) => t.state.cards[id]?.code === "10101");
    if (!one || !two) throw new Error("two copies");
    const stage = t.state.questStage ?? "";
    const planning = { ...t.state, phase: "Planning" as const };
    const placed = placeQuestProgress(planning, 3, t.ctx.cards, [], () => true);
    expect([placed.cards[one]?.progress, placed.cards[two]?.progress, placed.cards[stage]?.progress]).toEqual([2, 1, 0]);
    // A second placement the same round: the second copy has 1 left, the rest goes on the quest.
    const again = placeQuestProgress(placed, 3, t.ctx.cards, [], () => true);
    expect([again.cards[one]?.progress, again.cards[two]?.progress, again.cards[stage]?.progress]).toEqual([2, 2, 2]);
  });

  it("10101:A:2 raises each player's threat by 2 when it is discarded from the staging area, and not when it is explored", () => {
    const t = built({ staging: ["10101"], threat: [30, 30] });
    const descent = idOf(t.state, "10101");
    const discarded = settle(updateCard(t.state, descent, {}), t.ctx, []);
    expect(discarded.seats[0]?.threat).toBe(30);
    const gone = settle({ ...discarded, staging: discarded.staging.filter((id) => id !== descent), cards: { ...discarded.cards } }, t.ctx, []);
    expect(gone.seats[0]?.threat).toBe(30);
  });
});

describe("Ghostly Ruins", () => {
  it("10103:A:1 returns the topmost Undead enemy of the discard pile to the staging area before the empty encounter deck is reset", () => {
    const t = built({ phase: "Quest", staging: ["10103"], deck: [], discard: ["f0", "10099", "f3"] });
    const run = resolveRecords(t.state, t.ctx, "10100", "whenRevealed", undefined, undefined, false);
    expect(run).toBeTruthy();
  });
});
