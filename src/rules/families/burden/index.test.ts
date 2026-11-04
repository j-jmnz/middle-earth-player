// Rules: mec109.burden-deck, mec109.ringbearers-life, rr.first-player, rr.step-3-3, rr.modifiers
// (data/rules/entries.json). The burden family's verbs and conditions, run one at a time on a table of Flight to the Ford.
import { beforeAll, describe, expect, it } from "vitest";

import { holds } from "../../interpret/conditions.ts";
import type { EngineStep } from "../../core/intents.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { modifiedStat } from "../../core/keywords.ts";
import type { Instruction } from "../../../catalog/boundary.ts";
import { expireModifiers, type ScenarioState } from "../../core/state.ts";
import { fordTable, loadFordWorld, type FordLayout, type FordWorld } from "../../../../test/scenarios/flight-to-the-ford/scene.ts";
import { first, SAM } from "../../../../test/scenarios/a-shadow-of-the-past/scene.ts";

let world: FordWorld;

beforeAll(async () => {
  world = await loadFordWorld();
});

function make(layout: FordLayout = {}) {
  return fordTable(world, layout);
}

function run(state: ScenarioState, instruction: Instruction, ctx: ReturnType<typeof make>["ctx"], sourceId: string | null = null, steps: EngineStep[] = []): ScenarioState {
  return runInstruction(state, instruction, { seat: 0, sourceId }, ctx, steps);
}

describe("SetLife, ReduceLife and the burden deck's verbs", () => {
  it("SetLife sets the number; ReduceLife lowers it by an amount the record names or the engine reads", () => {
    const { state, ctx } = make({ seats: 2, life: 4 });
    expect(run(state, { verb: "SetLife", value: 15 }, ctx).life).toBe(15);
    expect(run(state, { verb: "ReduceLife", amount: 3 }, ctx).life).toBe(1);
    // Two players: X is the number of players.
    expect(run(state, { verb: "ReduceLife", amount: { players: true } }, ctx).life).toBe(2);
  });

  it("ReduceLife does nothing in a game with no life number", () => {
    const { state, ctx } = make();
    const { life: _life, ...without } = state;
    const after = run(without as ScenarioState, { verb: "ReduceLife", amount: 2 }, ctx);
    expect(after.life).toBeUndefined();
    expect(after.lost).toBe(false);
  });

  it("ShuffleBurdenDeck keeps the same five cards, in an order the seed decides", () => {
    const { state, ctx } = make();
    const shuffled = run(state, { verb: "ShuffleBurdenDeck" }, ctx);
    expect([...(shuffled.burdenDeck ?? [])].sort()).toEqual([...(state.burdenDeck ?? [])].sort());
    expect(shuffled.seedCursor).toBeGreaterThan(state.seedCursor);
    expect(run(state, { verb: "ShuffleBurdenDeck" }, ctx).burdenDeck).toEqual(shuffled.burdenDeck);
  });

  it("MoveBurden puts the top burden on top of the encounter deck, or shuffles it in; an empty burden deck moves nothing", () => {
    const { state, ctx } = make({ deck: ["f0", "f0", "f0"] });
    const top = state.burdenDeck?.[0] ?? "";
    const onTop = run(state, { verb: "MoveBurden", to: "encounterTop" }, ctx);
    expect(onTop.encounterDeck[0]).toBe(top);
    expect(onTop.burdenDeck).toHaveLength(4);
    expect(onTop.cards[top]?.face).toBe("down");
    const shuffledIn = run(state, { verb: "MoveBurden", to: "encounterShuffle" }, ctx);
    expect(shuffledIn.encounterDeck).toHaveLength(4);
    expect(shuffledIn.encounterDeck).toContain(top);
    const empty = make({ burden: [], deck: ["f0"] });
    expect(run(empty.state, { verb: "MoveBurden", to: "encounterTop" }, empty.ctx).encounterDeck).toEqual(empty.state.encounterDeck);
  });

  it("RemoveAllQuestProgress empties the current quest card and records the removal", () => {
    const { state, ctx } = make({ progress: 9 });
    const steps: EngineStep[] = [];
    const after = run(state, { verb: "RemoveAllQuestProgress" }, ctx, null, steps);
    expect(after.cards[after.questStage ?? ""]?.progress).toBe(0);
    expect(steps).toMatchObject([{ kind: "progress", amount: -9 }]);
    expect(run(after, { verb: "RemoveAllQuestProgress" }, ctx, null, steps)).toBe(after);
  });
});

describe("PassFirstPlayer, EndQuestPhase and SetStatUntil", () => {
  it("PassFirstPlayer gives the token to the next seat and announces it; one seat keeps it", () => {
    const two = make({ seats: 2 });
    const passed = run(two.state, { verb: "PassFirstPlayer" }, two.ctx);
    expect(passed.firstPlayer).toBe(1);
    expect(passed.pendingEvents).toContainEqual({ trigger: "firstPlayerTokenPassed", seat: 1 });
    const back = run(passed, { verb: "PassFirstPlayer" }, two.ctx);
    expect(back.firstPlayer).toBe(0);
    const solo = make();
    expect(run(solo.state, { verb: "PassFirstPlayer" }, solo.ctx)).toBe(solo.state);
  });

  it("PassFirstPlayer skips an eliminated seat", () => {
    const { state, ctx } = make({ seats: 2 });
    const eliminated = { ...state, seats: [state.seats[0], { ...state.seats[1], eliminated: true }] as typeof state.seats };
    expect(run(eliminated, { verb: "PassFirstPlayer" }, ctx).firstPlayer).toBe(0);
  });

  it("EndQuestPhase does nothing outside the staging step", () => {
    const { state, ctx } = make();
    expect(run(state, { verb: "EndQuestPhase" }, ctx)).toBe(state);
    const staging: ScenarioState = { ...state, mode: "staging", revealCursor: { seats: [0], index: 0 } };
    const ended = run(staging, { verb: "EndQuestPhase" }, ctx);
    expect(ended.mode).toBe("resolution");
    expect(ended.questResolved).toBe(true);
    expect(ended.revealCursor).toBeNull();
  });

  it("SetStatUntil sets the stat of the cards that match until the round ends, whatever else modifies it", () => {
    const { state, ctx, frodo } = make();
    const holders = { type: "hero", control: "any", trait: "Ring-bearer" } as const;
    const set = run(state, { verb: "SetStatUntil", stat: "defense", value: 0, until: "endOfRound", holders }, ctx);
    expect(modifiedStat(set, set.cards[frodo]!, "defense", ctx.cards)).toBe(0);
    expect(modifiedStat(set, set.cards[first(set, SAM)]!, "defense", ctx.cards)).toBe(modifiedStat(state, state.cards[first(state, SAM)]!, "defense", ctx.cards));
    expect(modifiedStat(expireModifiers(set, ["endOfRound"]), set.cards[frodo]!, "defense", ctx.cards)).toBe(modifiedStat(state, state.cards[frodo]!, "defense", ctx.cards));
    // A set to a higher value than a bonus holds too: the most recent set wins (rr.modifiers).
    const raised = run(set, { verb: "SetStatUntil", stat: "defense", value: 3, until: "endOfPhase", holders }, ctx);
    expect(modifiedStat(raised, raised.cards[frodo]!, "defense", ctx.cards)).toBe(3);
  });
});

describe("the conditions of the burden family", () => {
  const scope = { actor: 0, sourceId: null, returned: 0 };

  it("burdenDeck: the deck holds at least that many cards, one by default", () => {
    const { state, ctx } = make({ burden: ["141083", "141084"] });
    expect(holds(state, { kind: "burdenDeck" }, scope, ctx)).toBe(true);
    expect(holds(state, { kind: "burdenDeck", min: 2 }, scope, ctx)).toBe(true);
    expect(holds(state, { kind: "burdenDeck", min: 3 }, scope, ctx)).toBe(false);
    expect(holds(make({ burden: [] }).state, { kind: "burdenDeck" }, scope, ctx)).toBe(false);
  });

  it("campaign: the campaign card is in the game", () => {
    const { state, ctx } = make({ campaign: true });
    expect(holds(state, { kind: "campaign" }, scope, ctx)).toBe(true);
    expect(holds(make().state, { kind: "campaign" }, scope, ctx)).toBe(false);
  });

  it("x: the running effect's X is at least that number", () => {
    const { state, ctx } = make();
    expect(holds(state, { kind: "x", min: 1 }, scope, ctx)).toBe(false);
    expect(holds(state, { kind: "x", min: 1 }, { ...scope, x: 1 }, ctx)).toBe(true);
    expect(holds(state, { kind: "x", min: 2 }, { ...scope, x: 1 }, ctx)).toBe(false);
    expect(holds(state, { kind: "x", min: 0 }, scope, ctx)).toBe(true);
  });
});
