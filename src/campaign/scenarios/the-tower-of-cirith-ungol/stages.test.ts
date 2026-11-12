// Rules: mec113.setting-up-the-game, mec113.the-one-ring, mec113.saga-staging-rules, rr.guarded, rr.travel, rr.quest-advancement, rr.ownership-and-control, faq.progress-without-advancing (data/rules/entries.json); ledger lines 146014:A:1, 146014:A:2, 146022:A:3, 146066:A:1, 146066:B:3, 146015:A:2, 146015:A:3, 146067:B:2, 146068:A:1, 146068:B:1, 146068:B:3, 146069:B:1, 146020:A:3.
import { beforeAll, describe, expect, it } from "vitest";

import { emptyLog, poolCard } from "../../log.ts";
import { heroPays } from "../../../rules/player/payments.ts";
import { hasTrait } from "../../../rules/interpret/conditions.ts";
import { opened } from "../../../../test/harness/campaign-kit.ts";
import { ungolStart, ungolWorld } from "../../../../test/scenarios/the-tower-of-cirith-ungol/game.ts";
import { legalTargets, reduce, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { pickCandidates } from "../../../rules/interpret/pick.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { flagged, updateCard } from "../../../rules/core/state.ts";
import { moveCard, spawn } from "../../../rules/core/zones.ts";

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

  function stage3(): ScenarioState {
    const stage2 = killWatchers(open());
    const ready = travelWindow(updateCard(stage2, stage2.questStage!, { progress: 18 }));
    const traveled = reduce(ready, { type: "Travel", locationId: byCode(ready, "146015").id }, ctx);
    if (!traveled.ok) throw new Error(traveled.reason);
    return settle(syncConstants({ ...moveCard(traveled.state, byCode(traveled.state, "146015").id, { zone: "victory" }), window: null, activeLocation: null }, ctx), ctx, []);
  }

  it("146068:A:1 sends Last of the Company to the victory display, puts The One Ring on the Ring-bearer, exhausts him and returns The Two Watchers to the staging area", () => {
    const at3 = stage3();
    expect(zoneOf(at3, "146014")).toBe("victory");
    expect(hostCode(at3, "146065")).toBe("141001");
    expect(byCode(at3, "141001").exhausted).toBe(true);
    expect(zoneOf(at3, "146070")).toBe("staging");
  });

  it("146069:B:1 moves A Heavy Burden to the Ring-bearer and attaches the set-aside boon to Shagrat, held for its owner", () => {
    const at3 = stage3();
    expect(hostCode(at3, "144052")).toBe("141001");
    expect(Object.values(at3.cards).filter((card) => card.code === "144052")).toHaveLength(1);
    const sting = byCode(at3, STING);
    expect([sting.zone, hostCode(at3, STING), sting.held, sting.owner]).toEqual(["attached", "146020", true, 0]);
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

  it("146014:A:1 gives the attached hero the Ring-bearer trait and the Fellowship sphere, and the first player token never leaves its player", () => {
    const state = open();
    const stand = byCode(state, "q1");
    expect(hasTrait(state, stand.id, "Ring-bearer", ctx)).toBe(true);
    expect(heroPays(state, stand.id, "fellowship", ctx)).toBe(true);
    expect(flagged(state, "table", "firstPlayerLocked")).toBe(true);
  });

  it("146014:A:2 follows the attached hero's Willpower while the effect lasts", () => {
    const state = open();
    const company = byCode(state, "146014");
    const stand = state.cards[company.host ?? ""]!;
    const orc = spawn(state, "146060", { zone: "staging" });
    const laid = { ...orc.state, modifiers: [...orc.state.modifiers, { instanceId: orc.id, sourceId: company.id, stat: "threatPerHostWillpower" as const, amount: -1, until: "endOfPhase" as const }] };
    const threatOf = (current: ScenarioState) => modifiedStat(current, current.cards[orc.id]!, "threat", ctx.cards);
    const printed = modifiedStat(orc.state, orc.state.cards[orc.id]!, "threat", ctx.cards);
    const willpower = modifiedStat(laid, laid.cards[stand.id]!, "willpower", ctx.cards);
    expect(threatOf(laid)).toBe(Math.max(0, printed - willpower));
    // The hero's Willpower rises later in the phase: the Threat taken off follows it.
    const stronger = { ...laid, modifiers: [...laid.modifiers, { instanceId: stand.id, sourceId: stand.id, stat: "willpower" as const, amount: 1, until: "endOfPhase" as const }] };
    expect(threatOf(stronger)).toBe(Math.max(0, printed - willpower - 1));
  });

  it("146022:A:3 recalculates the Attack for each damage on the enemy while the shadow lasts", () => {
    const state = open();
    const uruk = spawn(state, "146022", { zone: "staging" });
    const laid = { ...uruk.state, modifiers: [...uruk.state.modifiers, { instanceId: uruk.id, sourceId: uruk.id, stat: "attackPerDamage" as const, amount: 1, until: "endOfAttack" as const }] };
    const attack = (current: ScenarioState) => modifiedStat(current, current.cards[uruk.id]!, "attack", ctx.cards);
    const bare = attack(laid);
    expect(attack(updateCard(laid, uruk.id, { damage: 2 }))).toBe(bare + 2);
    expect(attack(updateCard(laid, uruk.id, { damage: 3 }))).toBe(bare + 3);
  });

  it("146066:A:1 lets the first player choose Last of the Company's hero among the heroes he controls, never the captive Ring-bearer or another seat's hero", () => {
    const two = syncConstants(opened(ungolStart(2, 1, "Normal", undefined, emptyLog(2)), ctx), ctx);
    const host = two.cards[byCode(two, "146014").host ?? ""];
    expect(host?.controller).toBe(two.firstPlayer);
    expect(host?.code).not.toBe("141001");
  });

  it("146068:B:1 bars the Watchers' location until stage 3B holds 12 progress", () => {
    const at3 = stage3();
    const at = (progress: number) => travelWindow(updateCard(at3, at3.questStage!, { progress }));
    expect(targets(at(11))).not.toContain("146070");
    expect(targets(at(12))).toContain("146070");
  });

  it("146068:B:3 keeps stage 3B while The Two Watchers is in play, and defeating it wins the game", () => {
    const at3 = stage3();
    const full = syncConstants(updateCard(at3, at3.questStage!, { progress: 99 }), ctx);
    expect(settle({ ...full, window: null }, ctx, []).stageCleared).toBeFalsy();
    const gone = moveCard(full, byCode(full, "146070").id, { zone: "victory" });
    const won = settle(syncConstants({ ...gone, window: null }, ctx), ctx, []);
    expect(won.stageCleared).toBe(true);
  });

  it("146069:B:1 a boon guarded on Shagrat is no attachment a player controls, and it returns to its owner's hand when he is defeated", () => {
    const at3 = stage3();
    const sting = byCode(at3, STING);
    const offered = pickCandidates(at3, { type: "attachment", control: "you", nonObjective: true }, 0, [], null, ctx);
    expect(offered).not.toContain(sting.id);
    const defeated = settle(syncConstants({ ...moveCard(at3, byCode(at3, "146020").id, { zone: "victory" }), window: null }, ctx), ctx, []);
    const home = byCode(defeated, STING);
    expect([home.zone, home.controller, defeated.seats[0].hand.includes(home.id)]).toEqual(["hand", 0, true]);
  });
});
