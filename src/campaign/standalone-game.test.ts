import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import { definePrinted, type PrintedCard } from "../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../rules/engine/reduce.ts";
import { resolutionResult } from "../rules/setup/resolution.ts";
import { playOut } from "../../test/harness/auto-player.ts";
import { campaign, scenario, loadWorld, type World } from "../../test/scenarios/a-shadow-of-the-past/scene.ts";

import { scoreOf } from "./score.ts";
import { buildStart } from "./start.ts";

// A whole standalone A Shadow of the Past on fixed seeds, with the full-game test's in-memory heroes (full-game.test.ts):
// the engine plays it to the end with no campaign card, and a win settles with nothing to choose. Seed 2 wins and seed 1
// loses.
const RING_BEARER = "141001";
const POLICY = { scout: "scout", prefer: "141035", protect: RING_BEARER } as const;
const WIN_SEED = 2;
const LOSS_SEED = 1;

let world: World;
let ctx: ReduceContext;

beforeAll(async () => {
  world = await loadWorld();
  const cards = new Map<string, PrintedCard>(world.cards);
  for (const code of ["scout", "q1", "q2"]) {
    const willpower = code === "scout" ? 12 : 8;
    cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", threat: 8, willpower, attack: 1, defense: 2, health: 100 }));
  }
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  ctx = { effects: EFFECTS, cards };
});

function play(seed: number): ScenarioState {
  const start = buildStart({
    campaign,
    scenario,
    seatCount: 1,
    seed,
    threatModifier: 0,
    seats: [{ heroes: [RING_BEARER, "scout", "q1", "q2"], deck: Array.from({ length: 30 }, () => "filler") }],
    effects: EFFECTS,
    mode: "standalone",
  });
  const kept = expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx)).state;
  return playOut(kept, ctx, POLICY).state;
}

describe("a whole standalone game of A Shadow of the Past", () => {
  it("wins, and the win settles at once with nothing earned and a score", () => {
    const state = play(WIN_SEED);
    expect(state.lost).toBe(false);
    expect(state.stageCleared).toBe(true);
    expect(state.window).toBeNull();
    expect(resolutionResult(state)).toEqual({ earned: [], fallen: [], captives: [] });
    expect(scoreOf(state, ctx.cards).score).toBeGreaterThan(0);
  });

  it("loses on another seed", () => {
    const state = play(LOSS_SEED);
    expect(state.lost).toBe(true);
    expect(resolutionResult(state)).toBeNull();
  });
});
