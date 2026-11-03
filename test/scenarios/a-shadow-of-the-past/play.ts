// A Shadow of the Past played by the auto-player on the seeds the run tests pin (seed 2 wins, seed 1 loses), for tests under
// src/screens, which may not import src/rules.
import { EFFECTS } from "../../../src/effects/index.ts";
import { expectOk } from "../../../src/rules/core/test-fixture.ts";
import { definePrinted, type PrintedCard } from "../../../src/rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../src/rules/engine/reduce.ts";
import { buildStart } from "../../../src/campaign/start.ts";

import { playOut } from "../../harness/auto-player.ts";
import { campaign, scenario, type World } from "./scene.ts";

export const RING_BEARER = "141001";
const POLICY = { scout: "scout", prefer: "141035", protect: RING_BEARER } as const;

export function pastContext(world: World): ReduceContext {
  const cards = new Map<string, PrintedCard>(world.cards);
  for (const code of ["scout", "q1", "q2"]) {
    cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", threat: 8, willpower: code === "scout" ? 12 : 8, attack: 1, defense: 2, health: 100 }));
  }
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  return { effects: EFFECTS, cards };
}

function started(ctx: ReduceContext, seed: number): ScenarioState {
  const start = buildStart({ campaign, scenario, seatCount: 1, seed, threatModifier: 0, seats: [{ heroes: [RING_BEARER, "scout", "q1", "q2"], deck: Array.from({ length: 30 }, () => "filler") }], effects: EFFECTS, mode: "standalone" });
  return expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx)).state;
}

/** The finished game of a seed. */
export const playPast = (ctx: ReduceContext, seed: number): ScenarioState => playOut(started(ctx, seed), ctx, POLICY).state;
/** The game as it stands after the opening keep, still going. */
export const goingPast = (ctx: ReduceContext, seed: number): ScenarioState => started(ctx, seed);
