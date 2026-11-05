import { describe, expect, it } from "vitest";

import type { Amount, Condition, PickSpec } from "../../catalog/boundary.ts";
import { blankScenario } from "../core/state.ts";
import { cardMap, fixtureDefinition, hero } from "../core/test-fixture.ts";
import { spawn } from "../core/zones.ts";
import { canAttack, canDefend, undefendedTargets } from "../combat/combat.ts";
import { legalTargets } from "../engine/legal.ts";
import { playBlocked } from "../families/sidequests/contract.ts";
import { forcedTravel, travelCostUnpayable } from "./restrictions.ts";
import type { RulesFamily } from "./family-manifest.ts";
import { familyAmount, familyAttached, familyAttackReason, familyDefenseReason, familyForcedTravel, familyPlayBarred, familyUndefendedTargets, familyCondition, familyMayTravel, familyPickMatches, familyTravelCost, familyTravelReach, familyTravelUnpayable, runSettle, settleHooks, withFamilies } from "./family-hooks.ts";
import { resolveAmount } from "./amounts.ts";
import { holds } from "./conditions.ts";
import { matchesPick } from "./pick.ts";
import { RULES_FAMILIES, SETTLE_ORDER } from "../families/index.ts";

// Each hook point of RulesFamily, with a synthetic family handed to the dispatch in place of RULES_FAMILIES.
const state = blankScenario({ seatCount: 1, seed: 4, definition: fixtureDefinition(["stage"]) });
const ctx = { effects: [], cards: new Map() };
const scope = { actor: 0, sourceId: null, returned: 0 };
const family = (name: string, hooks: Partial<RulesFamily> = {}): RulesFamily => ({ name, verbs: [], run: () => null, ...hooks });
const marked = (log: string[], name: string) => (current: typeof state) => {
  log.push(name);
  return { ...current, round: current.round + 1 };
};

describe("settle hooks", () => {
  it("run in the order SETTLE_ORDER names, each on the state the one before returned", () => {
    const log: string[] = [];
    const list = [family("a", { settle: { before: marked(log, "a") } }), family("b", { settle: { before: marked(log, "b") } }), family("c", { settle: { before: marked(log, "c") } }), family("d")];
    const order = { before: ["c", "a", "b"], after: [], sweep: [] };
    const result = runSettle("before", state, ctx, [], list, order);
    expect(log).toEqual(["c", "a", "b"]);
    expect(result.round).toBe(state.round + 3);
    expect(runSettle("after", state, ctx, [], list, order)).toBe(state);
    expect(settleHooks("before", list, order)).toBe(settleHooks("before", list, order));
  });

  it("throw, naming the family, when one with a hook for the phase is not in SETTLE_ORDER", () => {
    const list = [family("a", { settle: { before: marked([], "a") } }), family("b", { settle: { before: marked([], "b") } })];
    expect(() => settleHooks("before", list, { before: ["a"], after: [], sweep: [] })).toThrow(/family b .*settle\.before/);
  });

  it("keep the order the core's chain had", () => {
    const names = (phase: "before" | "after" | "sweep") => RULES_FAMILIES.filter((candidate) => candidate.settle?.[phase]).map((candidate) => candidate.name);
    for (const phase of ["before", "after", "sweep"] as const) {
      expect([...names(phase)].sort()).toEqual([...SETTLE_ORDER[phase]].sort());
      expect(settleHooks(phase)).toHaveLength(SETTLE_ORDER[phase].length);
    }
    expect(SETTLE_ORDER.before).toEqual(["burden", "island", "south"]);
    expect(SETTLE_ORDER.after).toEqual(["sea", "stormcaller", "island", "wilderland"]);
  });
});

describe("travel hooks", () => {
  it("let the players travel when some family says so, and add the locations it reaches", () => {
    const none = [family("a")];
    const some = [family("a", { travel: { may: () => false, reach: () => [] } }), family("b", { travel: { may: () => true, reach: () => ["x", "y"] } }), family("c", { travel: { reach: () => ["z"] } })];
    expect(familyMayTravel(state, ctx, none)).toBe(false);
    expect(familyMayTravel(state, ctx, some)).toBe(true);
    expect(familyTravelReach(state, ctx, none)).toEqual([]);
    expect(familyTravelReach(state, ctx, some)).toEqual(["x", "y", "z"]);
  });

  it("charge for traveling (the first family's charge wins), list the locations the players must travel to, and say what they cannot pay", () => {
    const charge = { source: "s1", instructions: [] };
    const some = [family("a", { travel: { cost: () => null, forced: () => [], unpayable: () => false } }), family("b", { travel: { cost: (_s, _c, at) => (at === "x" ? null : charge), forced: () => ["x"], unpayable: (_s, step) => step.verb === "Heal" } }), family("c", { travel: { forced: () => ["y"] } })];
    expect(familyTravelCost(state, ctx, "x", [family("a")])).toBeNull();
    expect(familyTravelCost(state, ctx, "z", some)).toBe(charge);
    expect(familyTravelCost(state, ctx, "x", some)).toBeNull();
    expect(familyTravelCost(state, ctx, null, some)).toBe(charge);
    expect(familyForcedTravel(state, ctx, [family("a")])).toEqual([]);
    expect(familyForcedTravel(state, ctx, some)).toEqual(["x", "y"]);
    expect(familyTravelUnpayable(state, { verb: "Heal", target: "self", amount: 1 }, some)).toBe(true);
    expect(familyTravelUnpayable(state, { verb: "Heal", target: "self", amount: 1 }, [family("a")])).toBe(false);
  });

  it("change nothing for the real families", () => {
    expect(familyMayTravel(state, ctx)).toBe(false);
    expect(familyTravelReach(state, ctx)).toEqual([]);
    expect(familyTravelCost(state, ctx, null)).toBeNull();
    expect(familyForcedTravel(state, ctx)).toEqual([]);
  });

  it("forcedTravel and travelCostUnpayable ask them", () => {
    const { state: staged, id } = spawn(state, "e1", { zone: "staging" });
    const forcing = family("a", { travel: { forced: () => [id], unpayable: () => true } });
    expect(forcedTravel(staged, ctx)).toEqual([]);
    expect(withFamilies([family("a", { travel: { forced: () => [id] } })], () => forcedTravel(staged, ctx))).toEqual([id]);
    // A forced location the players cannot pay for is not one they must travel to.
    const costly = { ...ctx, effects: [{ id: "e1:travel:1", cardCode: "e1", lines: [], timing: "travel" as const, instructions: [{ verb: "Heal" as const, target: "self" as const, amount: 1 }] }] };
    expect(withFamilies([forcing], () => travelCostUnpayable(staged, costly, id))).toBe(true);
    expect(withFamilies([forcing], () => forcedTravel(staged, costly))).toEqual([]);
  });
});

describe("play hooks", () => {
  it("bar playing and putting into play when some family says so", () => {
    const { state: held, id } = spawn(state, "h1", { zone: "hand", seat: 0 });
    expect(familyPlayBarred(held, id, ctx, [family("a")])).toBe(false);
    expect(familyPlayBarred(held, id, ctx, [family("a", { play: () => false }), family("b", { play: (_state, card) => card === id })])).toBe(true);
    expect(playBlocked(held, id, 0, ctx)).toBe(false);
    expect(withFamilies([family("a", { play: () => true })], () => playBlocked(held, id, 0, ctx))).toBe(true);
    expect(withFamilies([family("a", { play: () => true })], () => playBlocked(held, id, 0, ctx, true))).toBe(true);
  });
});

describe("pick hooks", () => {
  const spec = { type: "card" } as unknown as PickSpec;
  it("reject a card when any family does", () => {
    const at = { seat: 0, sourceId: null };
    expect(familyPickMatches(state, "c1", spec, at, ctx, [family("a")])).toBe(true);
    expect(familyPickMatches(state, "c1", spec, at, ctx, [family("a", { pick: () => true }), family("b", { pick: (_state, id) => id !== "c1" })])).toBe(false);
    expect(familyPickMatches(state, "c2", spec, at, ctx, [family("b", { pick: (_state, id) => id !== "c1" })])).toBe(true);
  });
});

describe("condition hooks", () => {
  const condition = { kind: "synthetic" } as unknown as Condition;
  it("answer with the first family that owns the condition, null when none does", () => {
    expect(familyCondition(state, condition, { sourceId: null, seat: 0 } as never, ctx, [family("a", { condition: () => null })])).toBeNull();
    expect(familyCondition(state, condition, { sourceId: null, seat: 0 } as never, ctx, [family("a", { condition: () => null }), family("b", { condition: () => false }), family("c", { condition: () => true })])).toBe(false);
  });
});

describe("amount hooks", () => {
  const amount = { x: true } as Exclude<Amount, number>;
  it("answer with the first family that owns the amount, null when none does", () => {
    expect(familyAmount(state, amount, scope, ctx, [family("a", { amount: () => null })])).toBeNull();
    expect(familyAmount(state, amount, scope, ctx, [family("a", { amount: () => null }), family("b", { amount: () => 0 }), family("c", { amount: () => 5 })])).toBe(0);
  });
});

describe("attached hooks", () => {
  it("run for each family that has one, each on the state the one before returned", () => {
    const seen: string[] = [];
    const hook = (name: string) => (current: typeof state, id: string, host: string) => {
      seen.push(`${name}:${id}>${host}`);
      return { ...current, round: current.round + 1 };
    };
    const after = familyAttached(state, "c", "h", ctx, [family("a", { attached: hook("a") }), family("none"), family("b", { attached: hook("b") })]);
    expect(seen).toEqual(["a:c>h", "b:c>h"]);
    expect(after.round).toBe(state.round + 2);
    expect(familyAttached(state, "c", "h", ctx, [family("none")])).toBe(state);
  });
});

describe("combat hooks", () => {
  const printed = hero("h1", "leadership");
  const cards = cardMap([printed]);
  it("answer with the first family's reason, and with the first non-empty list of undefended targets", () => {
    const a = family("a", { combat: { defense: () => null, attack: () => null, undefended: () => [] } });
    const b = family("b", { combat: { defense: () => "no defense", attack: () => "no attack", undefended: () => ["x"] } });
    const c = family("c", { combat: { defense: () => "other", attack: () => "other", undefended: () => ["y"] } });
    expect(familyDefenseReason(state, printed, cards, [a, family("none")])).toBeNull();
    expect(familyDefenseReason(state, printed, cards, [a, b, c])).toBe("no defense");
    expect(familyAttackReason(state, "e", printed, printed, [a])).toBeNull();
    expect(familyAttackReason(state, "e", printed, printed, [a, b, c])).toBe("no attack");
    expect(familyUndefendedTargets(state, () => ["h"], cards, [a])).toEqual([]);
    expect(familyUndefendedTargets(state, () => ["h"], cards, [a, b, c])).toEqual(["x"]);
  });
});

// The core's own call sites, with a synthetic family in the list the core walks (withFamilies).
describe("the core's hook calls", () => {
  const at = { seat: 0, sourceId: null };

  it("holds asks a family's condition hook", () => {
    const condition = { kind: "synthetic" } as unknown as Condition;
    expect(withFamilies([family("a", { condition: () => true })], () => holds(state, condition, scope, ctx))).toBe(true);
    expect(withFamilies([family("a", { condition: () => false })], () => holds(state, condition, scope, ctx))).toBe(false);
  });

  it("resolveAmount takes a family's value and applies times, plus and limit to it", () => {
    const amount = { x: true, times: 3, plus: 1 } as Exclude<Amount, number>;
    expect(withFamilies([family("a", { amount: () => 4 })], () => resolveAmount(state, amount, scope, ctx))).toBe(13);
    expect(withFamilies([family("a", { amount: () => 4 })], () => resolveAmount(state, { ...amount, limit: 10 }, scope, ctx))).toBe(10);
    expect(resolveAmount(state, amount, scope, ctx)).toBe(1);
  });

  it("matchesPick drops a card a family's pick hook rejects", () => {
    const cards = cardMap([hero("h1", "leadership")]);
    const { state: dealt, id } = spawn(state, "h1", { zone: "heroes", seat: 0 });
    const spec = { type: "hero", from: "heroes" } as unknown as PickSpec;
    const run = () => matchesPick(dealt, id, spec, at, { effects: [], cards });
    expect(run()).toBe(true);
    expect(withFamilies([family("a", { pick: () => false })], run)).toBe(false);
  });

  it("legalTargets lets the players travel when a family's may hook says so, and adds the locations its reach hook names", () => {
    const traveling = { ...state, window: { kind: "travel" as const } };
    const held = { ...traveling, activeLocation: "somewhere" };
    expect(legalTargets(held, { type: "Travel" }, ctx)).toEqual([]);
    expect(withFamilies([family("a", { travel: { may: () => true, reach: () => ["there"] } })], () => legalTargets(held, { type: "Travel" }, ctx))).toEqual(["there"]);
    expect(withFamilies([family("a", { travel: { reach: () => ["there"] } })], () => legalTargets(held, { type: "Travel" }, ctx))).toEqual([]);
    expect(withFamilies([family("a", { travel: { reach: () => ["there"] } })], () => legalTargets(traveling, { type: "Travel" }, ctx))).toEqual(["there"]);
  });

  it("canDefend, canAttack and undefendedTargets ask a family's combat hooks", () => {
    const cards = cardMap([hero("h1", "leadership"), hero("e1", "neutral")]);
    const { state: first, id } = spawn(state, "h1", { zone: "heroes", seat: 0 });
    const { state: dealt, id: enemyId } = spawn(first, "e1", { zone: "engaged", seat: 0 });
    const barring = family("a", { combat: { defense: () => "no", attack: () => "no", undefended: (_state, candidates) => candidates().slice(0, 1) } });
    expect(canDefend(dealt, 0, id, cards)).toBe(true);
    expect(canAttack(dealt, 0, id, enemyId, cards)).toBe(true);
    expect(withFamilies([barring], () => canDefend(dealt, 0, id, cards))).toBe(false);
    expect(withFamilies([barring], () => canAttack(dealt, 0, id, enemyId, cards))).toBe(false);
    expect(withFamilies([barring], () => undefendedTargets(dealt, 0, cards))).toEqual([id]);
  });

  it("withFamilies restores the list, also when the callback throws", () => {
    expect(() => withFamilies([family("a", { travel: { may: () => true } })], () => { throw new Error("x"); })).toThrow("x");
    expect(familyMayTravel(state, ctx)).toBe(false);
  });
});
