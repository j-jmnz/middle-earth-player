// Rules: mec113.setting-up-the-game, mec113.the-one-ring, mec113.saga-staging-rules, rr.guarded, rr.travel, rr.quest-advancement, rr.ownership-and-control, faq.progress-without-advancing (data/rules/entries.json); ledger lines 146066:A:1, 146066:B:3, 146015:A:2, 146015:A:3, 146067:B:2, 146068:A:1, 146069:B:1, 146020:A:3.
import { beforeAll, describe, expect, it } from "vitest";

import { emptyLog, poolCard } from "../../log.ts";
import { opened } from "../../../../test/harness/campaign-kit.ts";
import { ungolStart, ungolWorld } from "../../../../test/scenarios/the-tower-of-cirith-ungol/game.ts";
import { legalTargets, reduce, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { moveCard } from "../../../rules/core/zones.ts";

// The quest through its three stages as the engine plays it: the Setup of stage 1, the Watchers' defeat and the advance, the chamber's travel bar and its Travel cost, the Ring-bearer's release, and stage 3A with the campaign card's Forced. Each test reaches its moment from the one before.
const STING = "142011";
const ANDURIL = "142014";
let ctx: ReduceContext;
let world: Awaited<ReturnType<typeof ungolWorld>>;

beforeAll(async () => {
  world = await ungolWorld("strong");
  ctx = world.ctx;
}, 240_000);

const byCode = (state: ScenarioState, code: string) => Object.values(state.cards).find((card) => card.code === code)!;
const zoneOf = (state: ScenarioState, code: string) => byCode(state, code).zone;
const hostCode = (state: ScenarioState, code: string) => state.cards[byCode(state, code).host ?? ""]?.code;
const travelWindow = (state: ScenarioState): ScenarioState => syncConstants({ ...state, phase: "Travel", mode: "travel", window: { kind: "travel" } } as ScenarioState, ctx);
const targets = (state: ScenarioState) => legalTargets(state, { type: "Travel" }, ctx).map((id) => state.cards[id]?.code);

function open(): ScenarioState {
  const log = { ...emptyLog(1), campaignPool: [poolCard(world.cards.get(STING)!, STING, null, 0), poolCard(world.cards.get(ANDURIL)!, ANDURIL, null, 0)] };
  return syncConstants(opened(ungolStart(1, 1, "Normal", undefined, log, undefined, { choices: [STING] }), ctx), ctx);
}

// The Watchers' enemy side killed: it goes to the victory display and the settle loop runs with no window open.
function killWatchers(state: ScenarioState): ScenarioState {
  const flipped = runInstruction(state, { verb: "FlipToEnemySide", code: "146070", into: "146071" }, { seat: 0, sourceId: byCode(state, "146070").id }, ctx, []);
  return settle(syncConstants({ ...moveCard(flipped, byCode(flipped, "146071").id, { zone: "victory" }), window: null }, ctx), ctx, []);
}

describe("the-tower-of-cirith-ungol stages", () => {
  it("146066:A:1 lays the Ring-bearer faceup under Topmost Chamber, keeps it controlled by nobody, and gives Last of the Company and The One Ring to a hero", () => {
    const state = open();
    const frodo = byCode(state, "141001");
    expect([frodo.zone, state.cards[frodo.host ?? ""]?.code, frodo.face, frodo.controller]).toEqual(["captive", "146015", "up", null]);
    expect(state.seats[0].heroes).not.toContain(frodo.id);
    const stand = hostCode(state, "146014");
    expect(stand).toBe("q1");
    expect(hostCode(state, "146065")).toBe("q1");
    expect(hostCode(state, "144052")).toBe("q1");
    expect(zoneOf(state, STING)).toBe("setAside");
    expect(zoneOf(state, "146020")).toBe("setAside");
  });

  it("146066:B:3 keeps stage 1 while The Two Watchers is in play, and advances at once when it leaves, with no progress needed", () => {
    const state = open();
    expect(state.cards[state.questStage ?? ""]?.code).toBe("146066");
    const after = killWatchers(state);
    expect(after.cards[after.questStage ?? ""]?.code).toBe("146067");
  });

  it("146015:A:2 bars the chamber until stage 2 holds 18 progress, and stage 1 never lets the players travel there", () => {
    const stage1 = travelWindow(open());
    expect(targets(stage1)).toEqual(["146070"]);
    const stage2 = killWatchers(open());
    const at = (progress: number) => travelWindow(updateCard(stage2, stage2.questStage!, { progress }));
    expect(targets(at(17))).not.toContain("146015");
    expect(targets(at(18))).toContain("146015");
  });

  it("146015:A:3 adds the set-aside Shagrat to the staging area as the Travel cost", () => {
    const stage2 = killWatchers(open());
    const ready = travelWindow(updateCard(stage2, stage2.questStage!, { progress: 18 }));
    const traveled = reduce(ready, { type: "Travel", locationId: byCode(ready, "146015").id }, ctx);
    if (!traveled.ok) throw new Error(traveled.reason);
    expect(zoneOf(traveled.state, "146020")).toBe("staging");
    expect(zoneOf(traveled.state, "146015")).toBe("activeLocation");
  });

  it("146067:B:2 gives the first player the Ring-bearer once Topmost Chamber is in the victory display, and lets the stage advance", () => {
    const stage2 = killWatchers(open());
    const ready = travelWindow(updateCard(stage2, stage2.questStage!, { progress: 18 }));
    const traveled = reduce(ready, { type: "Travel", locationId: byCode(ready, "146015").id }, ctx);
    if (!traveled.ok) throw new Error(traveled.reason);
    expect(zoneOf(traveled.state, "141001")).toBe("captive");
    const explored = settle(syncConstants({ ...moveCard(traveled.state, byCode(traveled.state, "146015").id, { zone: "victory" }), window: null, activeLocation: null }, ctx), ctx, []);
    const frodo = byCode(explored, "141001");
    expect([frodo.zone, frodo.controller, frodo.face]).toEqual(["heroes", 0, "up"]);
    expect(explored.cards[explored.questStage ?? ""]?.code).toBe("146068");
  });

  it("146068:A:1 and 146069:B:1 send Last of the Company to the victory display, put The One Ring and the Burden on the Ring-bearer, exhaust him, return the Watchers and guard the boon", () => {
    const stage2 = killWatchers(open());
    const ready = travelWindow(updateCard(stage2, stage2.questStage!, { progress: 18 }));
    const traveled = reduce(ready, { type: "Travel", locationId: byCode(ready, "146015").id }, ctx);
    if (!traveled.ok) throw new Error(traveled.reason);
    const at3 = settle(syncConstants({ ...moveCard(traveled.state, byCode(traveled.state, "146015").id, { zone: "victory" }), window: null, activeLocation: null }, ctx), ctx, []);
    expect(zoneOf(at3, "146014")).toBe("victory");
    expect(hostCode(at3, "146065")).toBe("141001");
    expect(hostCode(at3, "144052")).toBe("141001");
    expect(byCode(at3, "141001").exhausted).toBe(true);
    expect(zoneOf(at3, "146070")).toBe("staging");
    const sting = byCode(at3, STING);
    expect([sting.zone, hostCode(at3, STING), sting.held]).toEqual(["attached", "146020", true]);
  });

  it("146020:A:3 lowers Shagrat's engagement cost by the progress just placed on the quest, until the end of the round", () => {
    const stage2 = killWatchers(open());
    const shagrat = byCode(stage2, "146020");
    const spawned = moveCard(stage2, shagrat.id, { zone: "staging" });
    const before = modifiedStat(spawned, spawned.cards[shagrat.id]!, "engagementCost", ctx.cards);
    const steps: never[] = [];
    const placed = settle(syncConstants(runInstruction({ ...spawned, window: null }, { verb: "AddStageProgress", amount: 5 }, { seat: 0, sourceId: null }, ctx, steps), ctx), ctx, steps);
    expect(modifiedStat(placed, placed.cards[shagrat.id]!, "engagementCost", ctx.cards)).toBe(before - 5);
  });
});
