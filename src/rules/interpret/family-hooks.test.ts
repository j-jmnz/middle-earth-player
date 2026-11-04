import { describe, expect, it } from "vitest";

import type { Amount, Condition, PickSpec } from "../../catalog/boundary.ts";
import { blankScenario } from "../core/state.ts";
import { fixtureDefinition } from "../core/test-fixture.ts";
import type { RulesFamily } from "./family-manifest.ts";
import { familyAmount, familyCondition, familyMayTravel, familyPickMatches, familyTravelReach, runSettle, settleHooks } from "./family-hooks.ts";
import { RULES_FAMILIES, SETTLE_ORDER } from "../families/index.ts";

// Each hook point of RulesFamily, with a synthetic family handed to the dispatch in place of RULES_FAMILIES.
const state = blankScenario({ seatCount: 1, seed: 4, definition: fixtureDefinition(["stage"]) });
const ctx = { effects: [], cards: new Map() };
const scope = { actor: 0, sourceId: null };
const family = (name: string, hooks: Partial<RulesFamily> = {}): RulesFamily => ({ name, verbs: [], run: () => null, ...hooks });
const marked = (log: string[], name: string) => (current: typeof state) => {
  log.push(name);
  return { ...current, round: current.round + 1 };
};

describe("settle hooks", () => {
  it("run in the named order, then the rest in list order, each on the state the one before returned", () => {
    const log: string[] = [];
    const list = [family("a", { settle: { before: marked(log, "a") } }), family("b", { settle: { before: marked(log, "b") } }), family("c", { settle: { before: marked(log, "c") } }), family("d")];
    const order = { before: ["c", "a"], after: [], sweep: [] };
    const result = runSettle("before", state, ctx, [], list, order);
    expect(log).toEqual(["c", "a", "b"]);
    expect(result.round).toBe(state.round + 3);
    expect(runSettle("after", state, ctx, [], list, order)).toBe(state);
  });

  it("keep the order the core's chain had", () => {
    const names = (phase: "before" | "after" | "sweep") => RULES_FAMILIES.filter((candidate) => candidate.settle?.[phase]).map((candidate) => candidate.name);
    for (const phase of ["before", "after", "sweep"] as const) {
      expect([...names(phase)].sort()).toEqual([...SETTLE_ORDER[phase]].sort());
      expect(settleHooks(phase)).toHaveLength(SETTLE_ORDER[phase].length);
    }
    expect(SETTLE_ORDER.before).toEqual(["burden", "island", "south"]);
    expect(SETTLE_ORDER.after).toEqual(["sea", "stormcaller", "island"]);
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

  it("change nothing for the real families", () => {
    expect(familyMayTravel(state, ctx)).toBe(false);
    expect(familyTravelReach(state, ctx)).toEqual([]);
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
