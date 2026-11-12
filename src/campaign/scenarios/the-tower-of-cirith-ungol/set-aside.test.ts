// Rules: ltp.campaign-setup-checklist, rr.campaign-setup-checklist, mec113.setting-up-the-game, rr.in-play-and-out-of-play (data/rules/entries.json); ledger line 146069:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import { emptyLog, poolCard, type CampaignLog } from "../../log.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { startScenario } from "../../../rules/engine/reduce.ts";
import { campaignScenario } from "../../../catalog/scenario-data.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { loadScenario } from "../../../../scripts/data/load-scenarios.ts";
import { ungolLoadout, ungolStart, ungolWorld } from "../../../../test/scenarios/the-tower-of-cirith-ungol/game.ts";
import { checklist } from "../../checklist.ts";

// SetAsideBoon: each player chooses an Item boon (not Andúril) from the pool and sets it aside, out of play; it is left out of their deck this game.
const STING = "142011";
const GLAMDRING = "142013";
const ANDURIL = "142014";
const PHIAL = "142015";
let world: Awaited<ReturnType<typeof ungolWorld>>;
let ctx: ReduceContext;

beforeAll(async () => {
  world = await ungolWorld("strong");
  ctx = world.ctx;
}, 240_000);

const ungol = campaignScenario(loadScenario("the-tower-of-cirith-ungol"));
// The checklist for the seats of the game, answering the choices it is given, in order.
const ungolPlan = (seats: 1 | 2, log: CampaignLog, choices: readonly string[]) => checklist({ log, scenario: ungol, seats: ungolLoadout(seats), effects: EFFECTS, cards: world.cards, choices });
const pooled = (seats: 1 | 2, rows: readonly (readonly [string, number])[]): CampaignLog => ({ ...emptyLog(seats), campaignPool: rows.map(([code, seat]) => poolCard(world.cards.get(code)!, code, null, seat)) });
const needs = (plan: ReturnType<typeof ungolPlan>) => (plan.ok ? null : plan.needs);

describe("the-tower-of-cirith-ungol SetAsideBoon", () => {
  it("146069:A:1 asks each player for an Item boon of their own pool cards, never Andúril", () => {
    const log = pooled(2, [[STING, 0], [ANDURIL, 0], [GLAMDRING, 1], [PHIAL, 1]]);
    const first = needs(ungolPlan(2, log, []));
    expect(first?.seat).toBe(0);
    expect(first?.options).toEqual([STING]);
    const second = needs(ungolPlan(2, log, [STING]));
    expect(second?.seat).toBe(1);
    expect([...(second?.options ?? [])].sort()).toEqual([GLAMDRING, PHIAL]);
  });

  it("146069:A:1 sets the chosen boon aside for its seat and leaves it out of that seat's deck", () => {
    const log = pooled(2, [[STING, 0], [GLAMDRING, 1], [PHIAL, 1]]);
    const plan = ungolPlan(2, log, [STING, PHIAL]);
    if (!plan.ok) throw new Error("the plan asks again");
    expect(plan.seats[0]?.setAside).toEqual([STING]);
    expect(plan.seats[1]?.setAside).toEqual([PHIAL]);
    expect(plan.seats[0]?.deck).not.toContain(STING);
    expect(plan.seats[1]?.deck).toContain(GLAMDRING);
    expect(plan.seats[1]?.deck).not.toContain(PHIAL);
    // The pool still holds all three: the boon is set aside, not lost.
    expect(plan.log.campaignPool.map((card) => card.code).sort()).toEqual([GLAMDRING, PHIAL, STING].sort());
  });

  it("146069:A:1 deals the set-aside boon to the game's set-aside area as its player's own card", () => {
    const log = pooled(1, [[STING, 0], [GLAMDRING, 0]]);
    const state = startScenario(ungolStart(1, 1, "Normal", undefined, log, undefined, { choices: [GLAMDRING] }), ctx);
    const aside = state.setAside.map((id) => state.cards[id]!).filter((card) => card.code === GLAMDRING);
    expect(aside.map((card) => card.owner)).toEqual([0]);
    expect(Object.values(state.cards).filter((card) => card.code === GLAMDRING && card.zone === "deck")).toEqual([]);
    expect(Object.values(state.cards).filter((card) => card.code === STING && card.zone === "deck")).toHaveLength(1);
  });

  it("146069:A:1 asks nothing of a player who holds no Item boon, and of nobody with an empty pool", () => {
    expect(needs(ungolPlan(1, emptyLog(1), []))).toBeNull();
    const onlyAndul = pooled(1, [[ANDURIL, 0]]);
    expect(needs(ungolPlan(1, onlyAndul, []))).toBeNull();
    const plan = ungolPlan(1, onlyAndul, []);
    expect(plan.ok && plan.seats[0]?.setAside).toBeFalsy();
  });
});
