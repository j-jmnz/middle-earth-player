// The play policy kit (test/harness/policy-kit.ts): each rule answers its own window only, the intent it returns is one the reducer lists (and accepts), a policy is the first rule that answers, and the list of the
// rules (POLICY_KIT_RULES) names every exported rule. Each test builds a small table of The Morgul Vale with the scene kit (`tableFromLayout`); the scenario's goldens (src/campaign/scenarios/the-morgul-vale/golden.test.ts)
// play the kit's rules in a whole game.
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { updateCard } from "../../src/rules/core/state.ts";
import { legalIntents, legalTargets, reduce, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../src/rules/engine/reduce.ts";
import { ROOT } from "../../scripts/data/paths.ts";
import { idOf, tableFromLayout, type Layout } from "./scene-kit.ts";
import {
  archeryLeastDamaged, attackAllTogether, attackEach, chooseFirstOrLast, chooseOption, commitAllBut, declineAttack, declineTravel, defendFirst, engageUpTo, passCommitWhile, policyIntent, POLICY_KIT_RULES,
  travelFewestQuestPoints, triggerActions, undefendedLeastDamaged, type Policy, type Rule,
} from "./policy-kit.ts";

const ROAD_LOCATION = "06154";
const BRIDGE = "06156";
const NONE = new Set<string>();

const table = (layout: Layout) => tableFromLayout("the-morgul-vale", layout);
type Made = ReturnType<typeof table>;

// The intent is one the engine lists for the window (its type is among the legal intents) and the reducer accepts it.
function expectOffered(state: ScenarioState, ctx: ReduceContext, intent: PlayerIntent | null): void {
  expect(intent).not.toBeNull();
  expect(legalIntents(state, ctx).map((legal) => legal.type)).toContain(intent?.type);
  const result = reduce(state, intent as PlayerIntent, ctx);
  expect(result.ok, result.ok ? "" : result.reason).toBe(true);
}

// The table at the first defense window the passes reach (the seat of the first engaged enemy is the active seat).
function atDefense(layout: Layout): Made {
  const made = table({ phase: "Combat", ...layout });
  let state = made.state;
  for (let guard = 0; guard < 12 && state.window?.kind !== "defense"; guard += 1) {
    const result = reduce(state, { type: "Pass" }, made.ctx);
    if (!result.ok) throw new Error(result.reason);
    state = result.state;
  }
  expect(state.window?.kind).toBe("defense");
  return { ...made, state };
}

const withDamage = (made: Made, id: string, damage: number): ScenarioState => updateCard(made.state, id, { damage });
const choose = (options: string[]): ScenarioState => ({ window: { kind: "choose", options } }) as unknown as ScenarioState;

describe("a rule answers its own window only", () => {
  it("takes the first or the last option of a Choose, or the one the scenario names when it is offered", () => {
    const made = table({});
    const state = { ...made.state, ...choose(["a", "b", "c"]) };
    expect(chooseFirstOrLast("first")(state, made.ctx, NONE)).toEqual({ type: "Choose", optionId: "a" });
    expect(chooseFirstOrLast("last")(state, made.ctx, NONE)).toEqual({ type: "Choose", optionId: "c" });
    expect(chooseOption((_state, options) => (options.includes("b") ? "b" : undefined))(state, made.ctx, NONE)).toEqual({ type: "Choose", optionId: "b" });
    expect(chooseOption(() => "z", "last")(state, made.ctx, NONE)).toEqual({ type: "Choose", optionId: "c" });
    expect(chooseFirstOrLast("first")(made.state, made.ctx, NONE)).toBeNull();
    // The engine lists a Choose for this window.
    expect(legalIntents(state, made.ctx).map((legal) => legal.type)).toContain("Choose");
  });

  it("travels to the location with the fewest quest points (none printed last), or declines; it declines on request", () => {
    const made = table({ phase: "Travel", staging: [BRIDGE, ROAD_LOCATION] });
    const intent = travelFewestQuestPoints()(made.state, made.ctx, NONE);
    expect(intent).toEqual({ type: "Travel", locationId: idOf(made.state, ROAD_LOCATION) });
    expectOffered(made.state, made.ctx, intent);
    const barred = travelFewestQuestPoints((_state, id) => id !== idOf(made.state, ROAD_LOCATION))(made.state, made.ctx, NONE);
    expect(barred).toEqual({ type: "Travel", locationId: idOf(made.state, BRIDGE) });
    expect(travelFewestQuestPoints((): boolean => false)(made.state, made.ctx, NONE)).toEqual({ type: "DeclineTravel" });
    expectOffered(made.state, made.ctx, declineTravel()(made.state, made.ctx, NONE));
    expect(travelFewestQuestPoints()(table({}).state, made.ctx, NONE)).toBeNull();
    expect(declineTravel()(table({}).state, made.ctx, NONE)).toBeNull();
  });

  it("commits the active seat's characters but the last `reserve` heroes and the ones `keepHome` names, once", () => {
    const made = table({ seats: 2 });
    const first = commitAllBut(1)(made.state, made.ctx, NONE);
    expect(first).toEqual({ type: "Commit", cardIds: [made.hero] });
    expectOffered(made.state, made.ctx, first);
    expect(commitAllBut(0, (_state, id) => id === made.hero2)(made.state, made.ctx, NONE)).toEqual({ type: "Commit", cardIds: [made.hero] });
    // The second seat has one hero: reserved, so it commits nobody; with no reserve it commits him.
    const second = { ...made.state, activeSeat: 1 };
    expect(commitAllBut(1)(second, made.ctx, NONE)).toBeNull();
    const all = commitAllBut(0)(second, made.ctx, NONE);
    expect(all).toEqual({ type: "Commit", cardIds: [made.seat1Hero] });
    expectOffered(second, made.ctx, all);
    // A seat that has committed answers nothing more.
    expect(commitAllBut(1)(updateCard(made.state, made.hero, { committed: true }), made.ctx, NONE)).toBeNull();
    expect(commitAllBut(1)(table({ phase: "Travel" }).state, made.ctx, NONE)).toBeNull();
  });

  it("passes the commit while its condition holds", () => {
    const made = table({});
    const rule = passCommitWhile((state) => state.round <= 2);
    expectOffered(made.state, made.ctx, rule({ ...made.state, round: 2 }, made.ctx, NONE));
    expect(rule({ ...made.state, round: 3 }, made.ctx, NONE)).toBeNull();
    expect(rule(table({ phase: "Travel" }).state, made.ctx, NONE)).toBeNull();
  });

  it("has the first character who may defend, the first `perRound` attacks of a seat's round, then the first hero is undefended", () => {
    const made = atDefense({ engaged: ["f0"] });
    const memory = new Set<string>();
    const rule = defendFirst(1);
    const defends = rule(made.state, made.ctx, memory);
    expect(defends?.type).toBe("DeclareDefender");
    expectOffered(made.state, made.ctx, defends);
    const undefended = rule(made.state, made.ctx, memory);
    expect(undefended).toEqual({ type: "Undefended", heroId: made.hero });
    expectOffered(made.state, made.ctx, undefended);
    expect(defendFirst(0)(made.state, made.ctx, new Set())).toEqual({ type: "Undefended", heroId: made.hero });
    expect(defendFirst()(table({}).state, made.ctx, NONE)).toBeNull();
  });

  it("reads the seat under attack: the second seat's hero defends or is undefended", () => {
    const made = atDefense({ seats: 2, engaged: [{ code: "f0", seat: 1 }] });
    expect(made.state.activeSeat).toBe(1);
    const defends = defendFirst()(made.state, made.ctx, new Set());
    expect(defends).toEqual({ type: "DeclareDefender", defenderId: made.seat1Hero });
    expectOffered(made.state, made.ctx, defends);
    const undefended = defendFirst(0)(made.state, made.ctx, new Set());
    expect(undefended).toEqual({ type: "Undefended", heroId: made.seat1Hero });
    expectOffered(made.state, made.ctx, undefended);
  });

  it("leaves the attack to the least damaged hero the engine offers, never one `except` names", () => {
    const made = atDefense({ engaged: ["f0"] });
    const damaged = { ...made, state: withDamage(made, made.hero, 2) };
    const intent = undefendedLeastDamaged()(damaged.state, made.ctx, NONE);
    expect(intent).toEqual({ type: "Undefended", heroId: made.hero2 });
    expectOffered(damaged.state, made.ctx, intent);
    const skipped = undefendedLeastDamaged((_state, id) => id === made.hero2)(damaged.state, made.ctx, NONE);
    expect(skipped).toEqual({ type: "Undefended", heroId: made.hero });
    expectOffered(damaged.state, made.ctx, skipped);
    expect(undefendedLeastDamaged(() => true)(damaged.state, made.ctx, NONE)).toBeNull();
    expect(undefendedLeastDamaged()(table({}).state, made.ctx, NONE)).toBeNull();
  });

  it("reads the seat under attack: the second seat's own hero takes it, and nobody is chosen when the engine offers none", () => {
    const made = atDefense({ seats: 2, engaged: [{ code: "f0", seat: 1 }] });
    const intent = undefendedLeastDamaged()(made.state, made.ctx, NONE);
    expect(intent).toEqual({ type: "Undefended", heroId: made.seat1Hero });
    expectOffered(made.state, made.ctx, intent);
    // The same window without the second seat's hero in its row (the engine lists no Undefended target): no answer, not an intent the reducer refuses.
    const [one, two] = made.state.seats;
    const gone = { ...made.state, seats: [one, { ...two, heroes: [] }] as const };
    expect(legalTargets(gone, { type: "Undefended" }, made.ctx)).toEqual([]);
    expect(undefendedLeastDamaged()(gone, made.ctx, NONE)).toBeNull();
  });

  it("puts all the archery damage on the least damaged character, never one `skip` names", () => {
    const made = table({ phase: "PlayerAttacks" });
    const archery = { ...updateCard(made.state, made.hero, { damage: 1 }), mode: "archery", window: { kind: "archery", total: 2 } } as unknown as ScenarioState;
    const intent = archeryLeastDamaged()(archery, made.ctx, NONE);
    expect(intent).toEqual({ type: "Distribute", assignments: [{ cardId: made.hero2, amount: 2 }] });
    expectOffered(archery, made.ctx, intent);
    const skipped = archeryLeastDamaged((_state, id) => id === made.hero2)(archery, made.ctx, NONE);
    expect(skipped).toEqual({ type: "Distribute", assignments: [{ cardId: made.hero, amount: 2 }] });
    expectOffered(archery, made.ctx, skipped);
    expect(archeryLeastDamaged()(made.state, made.ctx, NONE)).toBeNull();
  });

  it("attacks together: every ready character, the enemy of the lowest rank", () => {
    const made = table({ phase: "PlayerAttacks", engaged: ["f0", "f3"] });
    const lowest = attackAllTogether()(made.state, made.ctx, NONE);
    expect(lowest).toEqual({ type: "DeclareAttackers", enemyId: idOf(made.state, "f0"), attackerIds: [made.hero, made.hero2] });
    expectOffered(made.state, made.ctx, lowest);
    const ranked = attackAllTogether((state, id) => (state.cards[id]?.code === "f3" ? 0 : 1))(made.state, made.ctx, NONE);
    expect(ranked).toEqual({ type: "DeclareAttackers", enemyId: idOf(made.state, "f3"), attackerIds: [made.hero, made.hero2] });
    expectOffered(made.state, made.ctx, ranked);
    const some = attackAllTogether(undefined, (_state, id) => id === made.hero2)(made.state, made.ctx, NONE);
    expect(some).toEqual({ type: "DeclareAttackers", enemyId: idOf(made.state, "f0"), attackerIds: [made.hero2] });
    expect(attackAllTogether()(table({}).state, made.ctx, NONE)).toBeNull();
  });

  it("attacks alone: the first ready character, and with `once` an enemy a seat's attack declared is left to the next one", () => {
    const made = table({ phase: "PlayerAttacks", engaged: ["f0", "f3"] });
    const first = attackEach()(made.state, made.ctx, NONE);
    expect(first).toEqual({ type: "DeclareAttackers", enemyId: idOf(made.state, "f0"), attackerIds: [made.hero] });
    expectOffered(made.state, made.ctx, first);
    const declared = { ...made.state, declaredAttacks: [`0:${idOf(made.state, "f0")}`] };
    expect(attackEach({ once: true })(declared, made.ctx, NONE)).toEqual({ type: "DeclareAttackers", enemyId: idOf(made.state, "f3"), attackerIds: [made.hero] });
    expect(attackEach({ may: (_state, id) => id === made.hero2 })(made.state, made.ctx, NONE)).toEqual({ type: "DeclareAttackers", enemyId: idOf(made.state, "f0"), attackerIds: [made.hero2] });
    expect(attackEach()(table({}).state, made.ctx, NONE)).toBeNull();
  });

  it("declines the attack window, and only that one", () => {
    const made = table({ phase: "PlayerAttacks", engaged: ["f0"] });
    expectOffered(made.state, made.ctx, declineAttack()(made.state, made.ctx, NONE));
    expect(declineAttack()(table({}).state, made.ctx, NONE)).toBeNull();
  });

  it("engages one enemy at a time, the lowest rank first, the ones `allow` permits, while fewer than `most`", () => {
    const made = table({ phase: "Encounter", staging: ["f0", "f3"] });
    const first = engageUpTo(2)(made.state, made.ctx, NONE);
    expect(first).toEqual({ type: "Engage", enemyId: idOf(made.state, "f0") });
    expectOffered(made.state, made.ctx, first);
    const ranked = engageUpTo(2, { rank: (state, id) => (state.cards[id]?.code === "f3" ? 0 : 1) })(made.state, made.ctx, NONE);
    expect(ranked).toEqual({ type: "Engage", enemyId: idOf(made.state, "f3") });
    expectOffered(made.state, made.ctx, ranked);
    const allowed = engageUpTo(2, { allow: (state, id) => state.cards[id]?.code !== "f0" })(made.state, made.ctx, NONE);
    expect(allowed).toEqual({ type: "Engage", enemyId: idOf(made.state, "f3") });
    expect(engageUpTo(2, { allow: () => false })(made.state, made.ctx, NONE)).toBeNull();
    // The seat's engaged enemies count against `most` (the default is its hero count).
    expect(engageUpTo(0)(made.state, made.ctx, NONE)).toBeNull();
    const engaged = table({ phase: "Encounter", staging: ["f3"], engaged: ["f0"] });
    expect(engageUpTo(1)(engaged.state, engaged.ctx, NONE)).toBeNull();
    expectOffered(engaged.state, engaged.ctx, engageUpTo(2)(engaged.state, engaged.ctx, NONE));
    expect(engageUpTo(2)(table({}).state, made.ctx, NONE)).toBeNull();
  });

  it("triggers the records named each time the engine offers them, or once a round", () => {
    // An ally in play with an Action that does nothing: the engine offers its Trigger in the combat window.
    const effects = [{ id: "ally:action:1", cardCode: "ally", lines: ["ally:A:1"], timing: "action" as const, instructions: [] }];
    const made = tableFromLayout("the-morgul-vale", { phase: "Combat", play: ["ally"] }, { effects });
    const memory = new Set<string>();
    const once = triggerActions(["ally:action:1"], true);
    const intent = once(made.state, made.ctx, memory);
    expect(intent).toEqual({ type: "Trigger", cardId: idOf(made.state, "ally"), effectId: "ally:action:1" });
    expectOffered(made.state, made.ctx, intent);
    expect(once(made.state, made.ctx, memory)).toBeNull();
    expect(once({ ...made.state, round: made.state.round + 1 }, made.ctx, memory)).not.toBeNull();
    expectOffered(made.state, made.ctx, triggerActions(["ally:action:1"])(made.state, made.ctx, memory));
    expect(triggerActions(["other:action:1"])(made.state, made.ctx, NONE)).toBeNull();
    expect(triggerActions(["ally:action:1"])({ ...made.state, window: { kind: "choose", seat: 0, options: ["a"] } }, made.ctx, NONE)).toBeNull();
  });

  it("is the first rule that answers, in order; a window no rule owns falls to the auto-player", () => {
    const made = table({ phase: "Planning" });
    const first: PlayerIntent = { type: "Pass" };
    const policy: Policy = [() => null, () => first, () => ({ type: "Keep" })];
    expect(policyIntent(policy, { scout: "", prefer: "", protect: "" }, made.state, made.ctx, new Set())).toBe(first);
    const none: Rule = () => null;
    const fallback = policyIntent([none], { scout: "", prefer: "", protect: "" }, made.state, made.ctx, new Set());
    expectOffered(made.state, made.ctx, fallback);
  });
});

describe("the list of rules", () => {
  it("names every rule the kit exports, in the order of the file", () => {
    const source = readFileSync(path.join(ROOT, "test/harness/policy-kit.ts"), "utf8");
    const exported = [...source.matchAll(/^export (?:function|const) (\w+)/gm)].map((match) => match[1]).filter((name) => name !== "policyIntent" && name !== "POLICY_KIT_RULES");
    expect(POLICY_KIT_RULES.map(([name]) => /^\w+/.exec(name)?.[0])).toEqual(exported);
  });
});
