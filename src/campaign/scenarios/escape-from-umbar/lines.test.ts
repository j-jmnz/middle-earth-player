// Rules: rr.forced, rr.travel, rr.then, rr.cannot, rr.engaged, hrd.side-quests, hrd.current-quest (data/rules/entries.json); ledger lines of Escape from Umbar (data/printed/haradrim.json).
import { describe, expect, it } from "vitest";

import { flagged, type ScenarioState } from "../../../rules/core/state.ts";
import { queueEvent } from "../../../rules/windows/queue.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { asCurrentQuest } from "../../../rules/families/sidequests/fixture.ts";
import { drive, engagedCodes, fightEnemy, finish, idOf, legalIntents, opened, resolveRecords, run as runInstruction, send, statOf, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

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
  it("16020:A:2 a Harad enemy found in the deck engages the first player, 1 progress goes on the main quest and the deck is shuffled", () => {
    const made = table({ stage: MAIN, staging: ["16020"], deck: ["f0", "16041"] });
    const done = resolveRecords(opened(made).state, made.ctx, "16020", "travel");
    expect(engagedCodes(done.state)).toEqual(["16041"]);
    expect(progress(done.state, MAIN)).toBe(1);
  });

  it("16020:A:2 with no Harad enemy to find, the cost is paid and no progress goes on the main quest (rr.then)", () => {
    const made = table({ stage: MAIN, staging: ["16020"], deck: ["f0"] });
    const done = resolveRecords(opened(made).state, made.ctx, "16020", "travel");
    expect(engagedCodes(done.state)).toEqual([]);
    expect(progress(done.state, MAIN)).toBe(0);
  });

  it("16020:A:2 the Soldier put into play engaged by the search engages the player, so its Forced effect opens its choice", () => {
    const made = table({ stage: MAIN, progress: 3, staging: ["16020"], deck: ["16042"] });
    const done = resolveRecords(opened(made).state, made.ctx, "16020", "travel", undefined, () => "progress", false);
    expect(progress(done.state, MAIN)).toBe(2);
  });
});

describe("16040:A:2 the Champion takes no damage below 4 progress on the side quest", () => {
  it("16040:A:2 the Champion cannot take damage with 3 progress on the side quest, and can with 4", () => {
    const low = table({ stage: MAIN, staging: [{ code: "16040", progress: 3 }, { code: "16041", resources: 1 }] });
    const lowState = opened(low).state;
    expect(flagged(lowState, idOf(lowState, "16041"), "cannotTakeDamage")).toBe(true);
    const full = table({ stage: MAIN, staging: [{ code: "16040", progress: 4 }, { code: "16041", resources: 1 }] });
    const fullState = opened(full).state;
    expect(flagged(fullState, idOf(fullState, "16041"), "cannotTakeDamage")).toBe(false);
  });

  it("16040:A:2 an enemy without the Champion's token takes damage as usual", () => {
    const made = table({ stage: MAIN, staging: [{ code: "16040", progress: 0 }, "16041"] });
    const state = opened(made).state;
    expect(flagged(state, idOf(state, "16041"), "cannotTakeDamage")).toBe(false);
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

const ADD = (amount: number) => ({ verb: "AddStageProgress", amount }) as const;

describe("16018:A:1 Umbar Square gains a Response while it is the active location", () => {
  const defeated = (layout: Layout) => {
    const made = table({ stage: MAIN, staging: ["f0"], ...layout });
    const synced = opened(made).state;
    const queued = queueEvent({ ...synced, window: null }, { trigger: "enemyDestroyed", seat: 0, subject: idOf(synced, "f0") });
    const steps: never[] = [];
    return { made, run: { state: settle(queued, made.ctx, steps), steps } };
  };

  it("16018:A:1 an enemy defeated puts 1 progress on the main quest, bypassing the active location, when the player uses the Response", () => {
    const { made, run } = defeated({ active: "16018" });
    const offered = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === idOf(run.state, "16018"));
    expect(offered).toBeDefined();
    const done = send(run, offered as never, made.ctx);
    expect(progress(done.state, MAIN)).toBe(1);
    expect(progress(done.state, "16018")).toBe(0);
  });

  it("16018:A:1 the Square in the staging area gives no Response", () => {
    const { made, run } = defeated({ staging: ["f0", "16018"] });
    expect(legalIntents(run.state, made.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === idOf(run.state, "16018"))).toBe(false);
  });
});

describe("The constants that hold only in a zone", () => {
  it("16017:A:1 Umbar Street in the staging area takes nothing off an enemy's engagement cost", () => {
    const made = table({ stage: MAIN, progress: 3, staging: ["16017", "16042"] });
    expect(statOf(opened(made).state, made.ctx.cards, "16042", "engagementCost")).toBe(32);
  });

  it("16020:A:1 Haradrim Estate takes progress once it is the active location", () => {
    const made = table({ stage: MAIN, active: "16020" });
    const state = opened(made).state;
    expect(flagged(state, idOf(state, "16020"), "noProgressPlaced")).toBe(false);
  });

  it("16041:A:2 a Harad enemy in the staging area gets no Attack from the engaged Captain", () => {
    const made = table({ stage: MAIN, engaged: ["16041"], staging: ["16042"] });
    expect(statOf(opened(made).state, made.ctx.cards, "16042", "attack")).toBe(3);
  });
});

describe("16044 Nowhere to Hide", () => {
  it("16044:A:1 the first player, not the player who revealed it, takes the enemy engaged", () => {
    const made = table({ seats: 2, firstPlayer: 1, stage: MAIN, deck: ["treachery", "16041"] });
    const done = resolveRecords(opened(made).state, made.ctx, "16044", "whenRevealed");
    expect(engagedCodes(done.state, 1)).toEqual(["16041"]);
    expect(engagedCodes(done.state, 0)).toEqual([]);
  });

  it("16044:A:1 an empty encounter deck is filled from the discard pile and the discarding goes on", () => {
    const made = table({ stage: MAIN, deck: [], discard: ["treachery", "16041"] });
    const done = resolveRecords(opened(made).state, made.ctx, "16044", "whenRevealed");
    expect(engagedCodes(done.state)).toEqual(["16041"]);
  });

  it("16044:A:2 the attacking enemy gets +2 Attack instead when it was engaged this round (3 + 2 = 5 damage undefended)", () => {
    const marked = fightEnemy((layout: Layout) => table(layout), "16044", "16042", { stage: MAIN }, {
      undefended: true,
      tweak: (state) => {
        const foe = idOf(state, "16042");
        return { ...state, modifiers: [...state.modifiers, { instanceId: foe, sourceId: foe, stat: "engagedThisRound", amount: 1, until: "endOfRound" }] };
      },
    });
    expect(marked.run.state.cards[idOf(marked.run.state, "dh1")]?.damage).toBe(5);
  });
});

describe("16067:B:2 Flee the City, every player engaged", () => {
  it("nothing is discarded at the beginning of the quest phase", () => {
    const made = table({ stage: "16067", phase: "Quest", engaged: ["16043"], deck: ["16015"] });
    const synced = opened(made).state;
    const steps: never[] = [];
    const after = settle(queueEvent({ ...synced, window: null }, { trigger: "beginningOfPhase", seat: 0 } as never), made.ctx, steps);
    expect(after.cards[idOf(after, "16015")]?.zone).toBe("encounterDeck");
  });
});

describe("16014:A:2 the loss of \"Seize Them!\"", () => {
  // Every window is passed until round `until` begins (or the game is lost). The scene's first round is numbered 0.
  const playTo = (made: ReturnType<typeof table>, from: ScenarioState, until: number) => {
    const done = drive(made, opened(made, from), (current) => current.round >= until || Boolean(current.lost));
    expect(done.state.round >= until || Boolean(done.state.lost)).toBe(true);
    return done;
  };

  it("16014:A:2 the players lose at the end of a whole round in which the main quest held no progress", () => {
    const made = table({ stage: MAIN, progress: 0, staging: ["16014"] });
    expect(playTo(made, made.state, 2).state.lost).toBeTruthy();
  });

  it("16014:A:2 the players do not lose while the main quest holds progress", () => {
    const made = table({ stage: MAIN, progress: 1, staging: ["16014"] });
    expect(playTo(made, made.state, 2).state.lost).toBeFalsy();
  });

  it("16014:A:2 a stage revealed in the round, with no progress on it, is not checked at the end of that round, and is at the end of the next", () => {
    const made = table({ stage: MAIN, progress: 14, staging: ["16014"] });
    const advanced = runInstruction(made, opened(made).state, ADD(1));
    expect(advanced.questStage).toBe(idOf(advanced, "16067"));
    const first = playTo(made, advanced, 1);
    expect(first.state.lost).toBeFalsy();
    expect(playTo(made, first.state, 3).state.lost).toBeTruthy();
  });
});

describe("The main quest stages cannot be defeated while a player is engaged", () => {
  it("16066:B:2 the stage 1B with all its progress stays while a player is engaged, and advances once nobody is", () => {
    const engaged = table({ stage: MAIN, progress: 14, engaged: ["16043"] });
    const stays = runInstruction(engaged, opened(engaged).state, ADD(1));
    expect(stays.questStage).toBe(idOf(stays, MAIN));
    const free = table({ stage: MAIN, progress: 14 });
    const moved = runInstruction(free, opened(free).state, ADD(1));
    expect(moved.questStage).toBe(idOf(moved, "16067"));
  });

  it("16066:B:1 the stage takes no progress beyond its 15 quest points while a player is engaged", () => {
    const made = table({ stage: MAIN, progress: 10, engaged: ["16043"] });
    expect(progress(runInstruction(made, opened(made).state, ADD(20)), MAIN)).toBe(15);
  });

  it("16067:B:3 the stage 2B stays while a player is engaged, and defeating it wins the game once nobody is", () => {
    const engaged = table({ stage: "16067", progress: 14, engaged: ["16043"] });
    const stays = runInstruction(engaged, opened(engaged).state, ADD(1));
    expect(stays.stageCleared).toBeFalsy();
    const free = table({ stage: "16067", progress: 14 });
    const won = runInstruction(free, opened(free).state, ADD(1));
    expect(won.stageCleared).toBe(true);
    expect(won.lost).toBeFalsy();
  });

  it("16067:B:1 the stage 2B takes no progress beyond its 15 quest points while a player is engaged", () => {
    const made = table({ stage: "16067", progress: 10, engaged: ["16043"] });
    expect(progress(runInstruction(made, opened(made).state, ADD(20)), "16067")).toBe(15);
  });
});

describe("16067:A:1 When Revealed ends the current phase", () => {
  it("the phase that is running is over once the effect has resolved", () => {
    const made = table({ stage: "16067", phase: "Quest", deck: ["16015"] });
    const before = opened(made).state;
    const done = resolveRecords(before, made.ctx, "16067", "whenRevealed", undefined, undefined, false);
    expect(done.state.phase === before.phase && done.state.boundaryPhase === before.boundaryPhase && done.state.mode === before.mode).toBe(false);
  });
});

describe("16016:A:2 the enemy under Narrow Alleyway returns engaged and engages the first player", () => {
  it("a Southron Soldier under the Alleyway engages the first player when the Alleyway leaves play, opening its Forced choice", () => {
    const made = table({ stage: MAIN, progress: 3, staging: ["16016"], under: [{ code: "16042", to: "16016" }] });
    const synced = opened(made).state;
    const steps: never[] = [];
    const after = settle(queueEvent({ ...synced, window: null }, { trigger: "leftPlay", seat: 0, subject: idOf(synced, "16016"), cardId: idOf(synced, "16016") } as never), made.ctx, steps);
    expect(engagedCodes(after)).toEqual(["16042"]);
    expect(after.window?.kind).toBe("choose");
  });
});

describe("16045:A:2 no player holds more than 5 cards while In Enemy Territory is in the staging area", () => {
  const hand = (state: ScenarioState): number => state.seats[0]?.hand.length ?? 0;
  const FIVE = Array.from({ length: 5 }, () => "filler");

  it("16045:A:2 a player at 5 cards who draws a sixth discards back down to 5", () => {
    const made = table({ stage: MAIN, staging: ["16045"], hand: FIVE, deckOf: ["filler", "filler"] });
    const drawn = runInstruction(made, opened(made).state, { verb: "Draw", amount: 1 });
    const done = finish({ state: settle(drawn, made.ctx, []), steps: [] }, made.ctx);
    expect(hand(done.state)).toBe(5);
  });

  it("16045:A:2 without the side quest in play a sixth card stays in the hand", () => {
    const made = table({ stage: MAIN, hand: FIVE, deckOf: ["filler", "filler"] });
    const drawn = runInstruction(made, opened(made).state, { verb: "Draw", amount: 1 });
    expect(hand(finish({ state: settle(drawn, made.ctx, []), steps: [] }, made.ctx).state)).toBe(6);
  });
});
