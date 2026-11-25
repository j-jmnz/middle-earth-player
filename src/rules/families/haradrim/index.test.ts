// Rules: rr.constant-ability, rr.triggered-ability, rr.in-play-and-out-of-play, rr.cannot (data/rules/entries.json); ledger lines 16014:A:2, 16016:A:1, 16045:A:2, 16066:B:1, 16067:B:1. The haradrim family's flag, condition, trigger and verb on their own:
// the stage that holds no more than its quest points, the main quest card noted for the round it came into play, the hand limit and the card placed faceup under a location.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { ruleCause } from "../../core/cause.ts";
import type { ScenarioState } from "../../core/state.ts";
import { finish, idOf, opened, resolveRecords, run as runInstruction, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { settle } from "../../engine/machine.ts";
import { holds } from "../../interpret/conditions.ts";
import { putOnStage } from "../../quest/quest.ts";
import { announceOverLimit } from "./hand.ts";
import { noteStage, stageInPlayWholeRound } from "./stage.ts";

const table = (layout: Layout = {}) => tableFromLayout("escape-from-umbar", { seats: 1, ...layout });
const ENEMY = "16015";
const WHOLE_ROUND = { kind: "stageInPlayWholeRound" } as const;

describe("16066:B:1 stageCapped: a stage holds no more progress than its quest points while it cannot advance", () => {
  it("takes 15 of 20 progress while a player is engaged, and keeps the 5 beyond only without the flag", () => {
    const made = table({ stage: "16066", engaged: [ENEMY] });
    const synced = opened(made).state;
    const stage = idOf(synced, "16066");
    const none = () => false;
    const capped = putOnStage(synced, stage, 20, 15, made.ctx.cards, [] as EngineStep[], none, ruleCause("rr.step-3-4"), { counted: true });
    expect(capped.cards[stage]?.progress).toBe(15);
    const uncapped = putOnStage({ ...synced, modifiers: synced.modifiers.filter((modifier) => modifier.stat !== "stageCapped") }, stage, 20, 15, made.ctx.cards, [] as EngineStep[], none, ruleCause("rr.step-3-4"), { counted: true });
    expect(uncapped.cards[stage]?.progress).toBe(20);
  });

  it("the stage 2B holds the same cap", () => {
    const made = table({ stage: "16067", engaged: [ENEMY] });
    const synced = opened(made).state;
    const stage = idOf(synced, "16067");
    const capped = putOnStage(synced, stage, 18, 15, made.ctx.cards, [] as EngineStep[], () => false, ruleCause("rr.step-3-4"), { counted: true });
    expect(capped.cards[stage]?.progress).toBe(15);
  });
});

describe("16014:A:2 stageInPlayWholeRound: the main quest card noted for the round it came into play", () => {
  it("a stage in play from Setup (round 0) has been in play the whole of round 1, and a stage noted in round 1 only from round 2", () => {
    const made = table({ stage: "16066" });
    const fromSetup = noteStage({ ...made.state, round: 0 }, true);
    expect(stageInPlayWholeRound({ ...fromSetup, round: 1 })).toBe(true);
    const revealed = noteStage({ ...made.state, round: 1 }, true);
    expect(stageInPlayWholeRound(revealed)).toBe(false);
    expect(stageInPlayWholeRound({ ...revealed, round: 2 })).toBe(true);
  });

  it("notes nothing in a game with no record that reads it, and notes a stage once", () => {
    const made = table({ stage: "16066" });
    expect(noteStage(made.state, false)).toBe(made.state);
    const once = noteStage({ ...made.state, round: 0 }, true);
    expect(noteStage({ ...once, round: 3 }, true).modifiers).toHaveLength(once.modifiers.length);
  });

  it("is read through the condition hook, false before the card is noted", () => {
    const made = table({ stage: "16066" });
    const scope = { actor: 0, sourceId: null } as never;
    expect(holds(made.state, WHOLE_ROUND, scope, made.ctx)).toBe(false);
    const noted = noteStage({ ...made.state, round: 0 }, true);
    expect(holds({ ...noted, round: 1 }, WHOLE_ROUND, scope, made.ctx)).toBe(true);
  });

  it("16014:A:2 the settle hook notes the stage of a state the machine settles", () => {
    const made = table({ stage: "16066", staging: ["16014"] });
    const settled = settle({ ...opened(made).state, round: 0 }, made.ctx, [] as EngineStep[]);
    expect(settled.modifiers.some((modifier) => modifier.stat === "stageEntered" && modifier.amount === 0)).toBe(true);
  });
});

describe("16045:A:2 handLimit and handOverLimit", () => {
  const hand = (count: number) => Array.from({ length: count }, () => "16015");
  const sideQuest = (cards: number) => table({ staging: ["16045"], hand: hand(cards) });

  it("queues the event for a seat over the limit, once, and none for a hand at the limit", () => {
    const over = sideQuest(7);
    const synced = opened(over).state;
    const queued = announceOverLimit(synced, []);
    expect(queued.pendingEvents).toEqual([{ trigger: "handOverLimit", seat: 0 }]);
    expect(announceOverLimit(queued, []).pendingEvents).toHaveLength(1);
    expect(announceOverLimit(opened(sideQuest(5)).state, []).pendingEvents).toBeUndefined();
  });

  it("queues nothing without the flag or while an effect is resolving", () => {
    const made = table({ hand: hand(7) });
    expect(announceOverLimit(opened(made).state, []).pendingEvents).toBeUndefined();
  });

  it("queues nothing while an effect is open on the stack or an attack is pending, and queues once both are done", () => {
    const synced = opened(sideQuest(7)).state;
    const frame = { id: "open" } as unknown as ScenarioState["stack"][number];
    expect(announceOverLimit({ ...synced, stack: [frame] }, []).pendingEvents).toBeUndefined();
    const attack = { enemyId: idOf(synced, "16045"), seat: 0, defenderId: idOf(synced, "16045") } as NonNullable<ScenarioState["pendingAttack"]>;
    expect(announceOverLimit({ ...synced, pendingAttack: attack }, []).pendingEvents).toBeUndefined();
    expect(announceOverLimit(synced, []).pendingEvents).toEqual([{ trigger: "handOverLimit", seat: 0 }]);
  });

  it("the card's record discards the player's choice of cards down to 5, at the next settle", () => {
    const made = sideQuest(7);
    const first = settle(opened(made).state, made.ctx, [] as EngineStep[]);
    const done = finish({ state: first, steps: [] }, made.ctx);
    expect(done.state.seats[0]?.hand).toHaveLength(5);
  });
});

describe("16016:A:1 PlaceUnderSelfFaceup", () => {
  it("the picked enemy goes faceup under the location, out of play, and leaves its player's engaged enemies", () => {
    const made = table({ staging: ["16016"], engaged: [ENEMY] });
    const location = idOf(made.state, "16016");
    const state = resolveRecords(opened(made).state, made.ctx, "16016", "response", location).state;
    const enemy = idOf(state, ENEMY);
    expect(state.cards[enemy]).toMatchObject({ zone: "under", host: location, face: "up" });
    expect(state.seats[0]?.engaged).not.toContain(enemy);
  });

  it("with no source or no picked card nothing happens", () => {
    const made = table({ staging: ["16016"] });
    const state = opened(made).state;
    expect(runInstruction(made, state, { verb: "PlaceUnderSelfFaceup" }, { sourceId: null }).cards).toEqual(state.cards);
  });
});
