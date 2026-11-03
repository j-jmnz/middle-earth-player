import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import { definePrinted, type PrintedCard } from "../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../rules/engine/reduce.ts";
import { playOut } from "../../scripts/auto-player.ts";
import { campaign, scenario, loadWorld, type World } from "../../scripts/past-scene.ts";

import { validateLoadout, type LoadoutSeat } from "./loadout.ts";
import { applyResolution, emptyLog } from "./log.ts";
import { buildStart } from "./start.ts";

// A whole A Shadow of the Past on fixed seeds. The Ring-bearer is the saga hero; the three other heroes
// and the deck are in-memory cards with big numbers, so the outcome depends on the engine and the seed
// and not on card play. Seeds 2 and 4 win; seed 9 loses when the Ring-bearer's card leaves play. (Seed 1 won until progress
// beyond a stage's quest points stopped carrying over to the next stage, rr.quest-advancement; it now loses.)
const RING_BEARER = "141001";
const POLICY = { scout: "scout", prefer: "141035", protect: RING_BEARER } as const;
const WIN_SEED = 2;
const OTHER_WIN_SEED = 4;
const LOSS_SEED = 9;

let world: World;
let cards: Map<string, PrintedCard>;
let ctx: ReduceContext;

const loadout: LoadoutSeat = {
  heroes: [RING_BEARER, "scout", "q1", "q2"],
  deck: Array.from({ length: 30 }, () => "filler"),
};

beforeAll(async () => {
  world = await loadWorld();
  cards = new Map(world.cards);
  for (const code of ["scout", "q1", "q2"]) {
    const willpower = code === "scout" ? 12 : 8;
    cards.set(code, definePrinted({ code, name: code, type: "hero", sphere: "tactics", threat: 8, willpower, attack: 1, defense: 2, health: 100 }));
  }
  cards.set("filler", definePrinted({ code: "filler", name: "filler", type: "event", sphere: "neutral", cost: 0 }));
  ctx = { effects: EFFECTS, cards };
});

function play(seed: number): { state: ScenarioState; intents: number } {
  const start = buildStart({ campaign, scenario,
    seatCount: 1,
    seed,
    threatModifier: 0,
    seats: [loadout],
    effects: EFFECTS,
  });
  const kept = expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx)).state;
  const out = playOut(kept, ctx, POLICY);
  return { state: out.state, intents: out.intents.length };
}

describe("a whole game of A Shadow of the Past", () => {
  it("the loadout is legal", () => {
    expect(validateLoadout([loadout], cards, true)).toEqual([]);
  });

  it("wins from the quest, answers both reward groups, and ends with the Ring still attached", () => {
    const { state } = play(WIN_SEED);
    expect(state.lost).toBe(false);
    expect(state.stageCleared).toBe(true);
    expect(state.window).toBeNull();
    expect(state.stack).toEqual([]);
    expect(state.resolutionLog.earned.map((item) => item.code)).toEqual(["141078", "141077"]);
    expect(state.cards[state.questStage ?? ""]?.code).toBe(world.definition.stages.at(-1)?.code);
    const ring = Object.values(state.cards).find((card) => card.code === "141085");
    expect(ring?.zone).toBe("play");
    expect(state.cards[ring?.host ?? ""]?.code).toBe(RING_BEARER);
  });

  it("records the chosen cards once, and a second win does not grant them again", () => {
    const { state } = play(WIN_SEED);
    const log = applyResolution(emptyLog(1), state.scenarioId, state, cards);
    expect(log.campaignPool.map((card) => card.code)).toEqual(["141078", "141077"]);
    expect(log.completed).toEqual([state.scenarioId]);
    const second = play(OTHER_WIN_SEED).state;
    expect(second.stageCleared).toBe(true);
    expect(applyResolution(log, second.scenarioId, second, cards)).toBe(log);
  });

  it("writes nothing for a loss", () => {
    const { state } = play(LOSS_SEED);
    expect(state.lost).toBe(true);
    expect(state.lossReason).toBe("The One Ring left play");
    expect(state.window).toBeNull();
    expect(state.resolutionLog.earned).toEqual([]);
    const empty = emptyLog(1);
    expect(applyResolution(empty, state.scenarioId, state, cards)).toBe(empty);
  });
});
