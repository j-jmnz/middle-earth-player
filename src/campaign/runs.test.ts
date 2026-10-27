import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { expectOk } from "../rules/fixture.ts";
import { definePrinted, type PrintedCard } from "../rules/printed.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";
import { ENGINE_VERSION } from "../rules/version.ts";
import { playOut } from "../../scripts/auto-player.ts";
import { campaign, scenario, loadWorld, type World } from "../../scripts/past-scene.ts";

import { emptyLog } from "./log.ts";
import { campaignRunId, runOf, standaloneRunId, type RunInput } from "./runs.ts";
import { newSave } from "./save.ts";
import { finish } from "./session.ts";
import { scoreOf } from "./score.ts";
import { buildStart } from "./start.ts";

// A Shadow of the Past on the seeds standalone-game.test.ts pins: seed 2 wins, seed 1 loses. The run is read from the engine's
// final state; nothing in it is typed.
const RING_BEARER = "141001";
const POLICY = { scout: "scout", prefer: "141035", protect: RING_BEARER } as const;

let world: World;
let ctx: ReduceContext;
let kept: (seed: number) => ScenarioState;

beforeAll(async () => {
  world = await loadWorld();
  const cards = new Map<string, PrintedCard>(world.cards);
  for (const code of ["scout", "q1", "q2"]) {
    cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", threat: 8, willpower: code === "scout" ? 12 : 8, attack: 1, defense: 2, health: 100 }));
  }
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  ctx = { effects: EFFECTS, cards };
  kept = (seed) => {
    const start = buildStart({ campaign, scenario, seatCount: 1, seed, threatModifier: 0, seats: [{ heroes: [RING_BEARER, "scout", "q1", "q2"], deck: Array.from({ length: 30 }, () => "filler") }], effects: EFFECTS, mode: "standalone" });
    return expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx)).state;
  };
});

const play = (seed: number): ScenarioState => playOut(kept(seed), ctx, POLICY).state;

function input(state: ScenarioState, overrides: Partial<RunInput> = {}): RunInput {
  return { id: "run-1", kind: "standalone", refId: "game-1", campaignId: null, box: "fellowship-of-the-ring", state, cards: ctx.cards, heroes: [[RING_BEARER, "scout"]], reward: null, startedAt: 100, endedAt: 200, engineVersion: ENGINE_VERSION, ...overrides };
}

describe("a run", () => {
  it("on a win carries the engine's score, rounds, victory points and each seat's threat", () => {
    const state = play(2);
    const run = runOf(input(state));
    const score = scoreOf(state, ctx.cards);
    expect(run).toMatchObject({ result: "won", lossCause: null, rounds: score.rounds, victoryPoints: score.victoryPoints, score: score.score, threats: [state.seats[0].threat], seatCount: 1, scenarioId: state.scenarioId, startedAt: 100, endedAt: 200, engineVersion: ENGINE_VERSION, backfilled: false });
  });

  it("on a campaign win carries the reward the Resolution chose; on a standalone win none", () => {
    const state = play(2);
    expect(runOf(input(state, { kind: "campaign", campaignId: "fellowship-of-the-ring", reward: ["141078"] }))?.reward).toEqual(["141078"]);
    expect(runOf(input(state))?.reward).toBeNull();
  });

  it("on a loss carries the engine's loss cause and the rounds completed, and no score", () => {
    const state = play(1);
    expect(state.lost).toBe(true);
    const run = runOf(input(state, { reward: ["141078"] }));
    expect(run).toMatchObject({ result: "lost", lossCause: state.lossReason, score: null, victoryPoints: null, reward: null, rounds: Math.max(0, state.round - 1) });
  });

  it("is not made while the game is still going", () => {
    expect(runOf(input(kept(2)))).toBeNull();
  });

  it("a campaign loss writes a run and leaves the log as it was", () => {
    const state = play(1);
    const save = { ...newSave("save-a", "fellowship-of-the-ring", 1), loadout: { scenarioId: state.scenarioId, difficulty: "Normal" as const, seats: [], ringBearer: null, choices: [], acceptPenalty: false } };
    const after = finish(save, world as unknown as Parameters<typeof finish>[1], state);
    expect(after.log).toEqual(emptyLog(1));
    expect(runOf(input(state, { kind: "campaign", refId: "save-a", campaignId: save.campaignId }))?.result).toBe("lost");
  });

  it("has ids that tell one attempt from the next and one game from another", () => {
    expect(campaignRunId("save-a", "x", 1)).not.toBe(campaignRunId("save-a", "x", 2));
    expect(standaloneRunId("game-1")).not.toBe(standaloneRunId("game-2"));
  });
});
