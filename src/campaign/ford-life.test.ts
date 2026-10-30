// Rules: mec109.ringbearers-life, mec109.setup-flight-to-the-ford, rr.damage, rr.forced (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import { ruleCause } from "../rules/cause.ts";
import { syncConstants } from "../rules/constants.ts";
import type { EngineStep } from "../rules/intents.ts";
import { runInstruction } from "../rules/interpret.ts";
import { modifiedStat, placeDamage } from "../rules/keywords.ts";
import { settle } from "../rules/machine.ts";
import { expireModifiers, updateCard, type ScenarioState } from "../rules/state.ts";
import { fireForced } from "../rules/triggers.ts";
import { causeProblems } from "../../scripts/cause-check.ts";
import { fordTable, loadFordWorld, FELL_RIDER, type FordLayout, type FordWorld } from "../../scripts/ford-scene.ts";
import { first, reveal, SAM, send } from "../../scripts/past-scene.ts";

let world: FordWorld;

beforeAll(async () => {
  world = await loadFordWorld();
});

function make(layout: FordLayout = {}) {
  const made = fordTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

// Announces an event the way the engine does and lets what it started resolve, with a Choose answered by `answers`.
function announce(state: ScenarioState, event: Parameters<typeof fireForced>[1], ctx: ReturnType<typeof make>["ctx"], steps: EngineStep[]): ScenarioState {
  return settle(fireForced({ ...state, window: null }, event, ctx, steps), ctx, steps);
}

const END_OF_ROUND = { trigger: "endOfRound", seat: null, phase: "End of round" } as const;

describe("the Ring-bearer's life (mec109.ringbearers-life)", () => {
  it("goes down by 1 at the end of each round, on both stages (141028:B:2, 141029:B:3), each step naming its cause", () => {
    for (const stage of ["141028", "141029"] as const) {
      const { state, ctx } = make({ stage });
      const steps: EngineStep[] = [];
      const after = announce(state, END_OF_ROUND, ctx, steps);
      expect(after.life, stage).toBe(14);
      expect(steps.filter((step) => step.kind === "life")).toMatchObject([{ amount: -1, cause: { effect: stage === "141028" ? "141028:forced:1" : "141029:forced:1" } }]);
      expect(causeProblems(steps)).toEqual([]);
    }
  });

  it("is lowered by the damage a hero would take with An Evil Wound attached, and that hero is not damaged (141057:A:2)", () => {
    const { state, ctx, frodo } = make();
    const steps: EngineStep[] = [];
    const after = placeDamage(state, frodo, 3, ctx.cards, steps, "combat", ruleCause("rr.step-6-4-3"));
    expect(after.life).toBe(12);
    expect(after.cards[frodo]?.damage).toBe(0);
    expect(steps).toMatchObject([{ kind: "life", amount: -3 }]);
    expect(causeProblems(steps)).toEqual([]);
  });

  it("is not lowered by damage to another hero, which takes it", () => {
    const { state, ctx } = make();
    const sam = first(state, SAM);
    const after = placeDamage(state, sam, 2, ctx.cards, [], "framework", ruleCause("rr.effects"));
    expect(after.life).toBe(15);
    expect(after.cards[sam]?.damage).toBe(2);
  });

  it("is untouched when no An Evil Wound is attached: the Ring-bearer takes the damage", () => {
    const { state, ctx, frodo } = make({ wound: false });
    const after = placeDamage(state, frodo, 3, ctx.cards, [], "combat", ruleCause("rr.step-6-4-3"));
    expect(after.life).toBe(15);
    expect(after.cards[frodo]?.damage).toBe(3);
  });

  it("stops at 0, and the players lose the game when it gets there (141057:A:3)", () => {
    const { state, ctx, frodo } = make({ life: 2 });
    const after = placeDamage(state, frodo, 5, ctx.cards, [], "combat", ruleCause("rr.step-6-4-3"));
    expect(after.life).toBe(0);
    expect(after.lost).toBe(true);
    expect(after.lossReason).toBe("The Ring-bearer's life reached 0");
    const alive = placeDamage(state, frodo, 1, ctx.cards, [], "combat", ruleCause("rr.step-6-4-3"));
    expect(alive.life).toBe(1);
    expect(alive.lost).toBe(false);
  });

  it("loses the game at the end of a round that takes the last point", () => {
    const { state, ctx } = make({ life: 1 });
    const after = announce(state, END_OF_ROUND, ctx, []);
    expect(after.life).toBe(0);
    expect(after.lost).toBe(true);
  });

  it("is not raised by healing, and the Ring-bearer cannot be healed (141057:A:1, mec109.ringbearers-life)", () => {
    const { state, ctx, frodo } = make({ life: 10 });
    const wound = first(state, "141057");
    const hurt = updateCard(state, frodo, { damage: 2 });
    const healed = runInstruction(hurt, { verb: "Heal", amount: 2, target: "host" }, { seat: 0, sourceId: wound }, ctx, []);
    expect(healed.cards[frodo]?.damage).toBe(2);
    expect(healed.life).toBe(10);
    // Another hero is healed as usual, and that does not move the life either.
    const sam = first(state, SAM);
    const samHealed = runInstruction(updateCard(state, sam, { damage: 2 }), { verb: "Heal", amount: 2, target: "self" }, { seat: 0, sourceId: sam }, ctx, []);
    expect(samHealed.cards[sam]?.damage).toBe(0);
    expect(samHealed.life).toBe(10);
  });
});

describe("Pain Assailed Him (141066)", () => {
  it("reduces the life by 1 and sets the Ring-bearer's Willpower, Attack and Defense to 0 until the end of the round (141066:A:1)", () => {
    const { state, ctx, frodo } = make({ deck: ["141066", "f0", "f0"] });
    const sam = first(state, SAM);
    const before = ["willpower", "attack", "defense"].map((stat) => modifiedStat(state, state.cards[frodo]!, stat as "willpower", ctx.cards));
    expect(before.some((value) => value > 0)).toBe(true);
    const run = reveal(state, ctx);
    expect(run.state.life).toBe(14);
    for (const stat of ["willpower", "attack", "defense"] as const) {
      expect(modifiedStat(run.state, run.state.cards[frodo]!, stat, ctx.cards), stat).toBe(0);
      expect(modifiedStat(run.state, run.state.cards[sam]!, stat, ctx.cards), `Sam ${stat}`).toBe(modifiedStat(state, state.cards[sam]!, stat, ctx.cards));
    }
    // Another bonus does not lift a set stat (rr.modifiers).
    const bonus = { ...run.state, modifiers: [...run.state.modifiers, { instanceId: frodo, sourceId: frodo, stat: "attack" as const, amount: 2, until: "endOfPhase" as const }] };
    expect(modifiedStat(bonus, bonus.cards[frodo]!, "attack", ctx.cards)).toBe(0);
    const later = expireModifiers(run.state, ["endOfRound"]);
    expect(modifiedStat(later, later.cards[frodo]!, "willpower", ctx.cards)).toBe(before[0]);
    expect(causeProblems(run.steps)).toEqual([]);
  });
});

describe("Fell Rider in the staging area (141063:A:2)", () => {
  const BEGIN = { trigger: "beginningOfPhase", seat: null, phase: "Encounter" } as const;

  it("makes the first player reduce the life by 1 or engage it, at the beginning of the encounter phase", () => {
    const { state, ctx } = make({ staging: [FELL_RIDER], phase: "Encounter" });
    const rider = first(state, FELL_RIDER);
    const asked = announce(state, BEGIN, ctx, []);
    expect(asked.window).toEqual({ kind: "choose", seat: 0, options: ["life", "engage"] });
    const paid = send({ state: asked, steps: [] }, { type: "Choose", optionId: "life" }, ctx);
    expect(paid.state.life).toBe(14);
    expect(paid.state.cards[rider]?.zone).toBe("staging");
    const engaged = send({ state: asked, steps: [] }, { type: "Choose", optionId: "engage" }, ctx);
    expect(engaged.state.life).toBe(15);
    expect(engaged.state.cards[rider]).toMatchObject({ zone: "engaged", controller: 0 });
  });

  it("does not apply once the Fell Rider is engaged, or in another phase", () => {
    const engaged = make({ engaged: [{ code: FELL_RIDER, seat: 0 }], phase: "Encounter" });
    expect(announce(engaged.state, BEGIN, engaged.ctx, []).window?.kind).not.toBe("choose");
    const staged = make({ staging: [FELL_RIDER] });
    expect(announce(staged.state, { ...BEGIN, phase: "Quest" }, staged.ctx, []).window?.kind).not.toBe("choose");
  });

  it("asks the first player in a two-handed game", () => {
    const { state, ctx } = make({ seats: 2, staging: [FELL_RIDER, FELL_RIDER], phase: "Encounter" });
    const asked = announce({ ...state, firstPlayer: 1 }, BEGIN, ctx, []);
    expect(asked.window).toEqual({ kind: "choose", seat: 1, options: ["life", "engage"] });
  });
});
