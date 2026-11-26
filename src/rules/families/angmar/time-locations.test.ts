// Rules: mec108.time-x, rr.forced (data/rules/entries.json); ledger lines 08147:B:2, 08151:A:2, 08153:A:1, 08154:A:2, 08159:A:1. Time counters on the locations in play: taken off each, off the active location or divided among them, put on the ones with none,
// and the Time X value of the active location as an amount. Fixture cards: three locations with Time X (3, 2 and 4) and one with none.
import { describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import { cardMap, hero, idleScenario } from "../../core/test-fixture.ts";
import { definePrinted } from "../../core/printed.ts";
import { settle } from "../../engine/machine.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { type ScenarioState, updateCard } from "../../core/state.ts";
import { moveCard, spawn } from "../../core/zones.ts";

const CARDS = cardMap([
  hero("frodo", "lore"),
  definePrinted({ code: "stage", name: "Stage", type: "quest", questPoints: 20 }),
  definePrinted({ code: "camp", name: "Camp", type: "location", threat: 1, questPoints: 3 }),
  definePrinted({ code: "ford", name: "Ford", type: "location", threat: 1, questPoints: 3 }),
  definePrinted({ code: "hill", name: "Hill", type: "location", threat: 1, questPoints: 3 }),
  definePrinted({ code: "plain", name: "Plain", type: "location", threat: 1, questPoints: 3 }),
  definePrinted({ code: "orc", name: "Orc", type: "enemy", threat: 1, engagementCost: 10, attack: 1, defense: 1, health: 2 }),
]);
const time = (code: string, amount: number): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", instructions: [{ verb: "Time", amount }] });
const ctx: ReduceContext = { effects: [time("camp", 3), time("ford", 2), time("hill", 4)], cards: CARDS };

function table(): ScenarioState {
  const base = spawn(spawn(idleScenario(1), "stage", { zone: "questStage" }).state, "frodo", { zone: "heroes", seat: 0 }).state;
  return base;
}
const put = (state: ScenarioState, code: string, zone: "staging" | "activeLocation", counters: number) => {
  const made = spawn(state, code, { zone });
  return { state: updateCard(made.state, made.id, { resources: counters }), id: made.id };
};
const run = (state: ScenarioState, instructions: Instruction[]): ScenarioState =>
  settle(pushEffectFrame(state, { frame: "whenRevealed", sourceId: "none", actor: 0, peril: false, effectId: "fixture:whenRevealed:1", instructions, cancel: null, blockCancel: null }, []), ctx, []);
const counters = (state: ScenarioState, id: string): number | undefined => state.cards[id]?.resources;
const heard = (state: ScenarioState, id: string): boolean => (state.pendingEvents ?? []).some((event) => event.trigger === "lastTimeCounterRemoved" && event.subject === id);

// Three locations: Camp (3 counters) and Ford (1) in the staging area, Hill (4) active; Plain has no Time keyword.
function scene() {
  let state = table();
  const camp = put(state, "camp", "staging", 3);
  const ford = put(camp.state, "ford", "staging", 1);
  const hill = put(ford.state, "hill", "activeLocation", 4);
  const plain = put(hill.state, "plain", "staging", 0);
  return { state: plain.state, camp: camp.id, ford: ford.id, hill: hill.id, plain: plain.id };
}

describe("RemoveTimeCounters on locations (08147:B:2, 08159:A:1)", () => {
  it("target locations takes 1 counter off each location in play, the active one too, and a card with none loses none", () => {
    const s = scene();
    const next = run(s.state, [{ verb: "RemoveTimeCounters", target: "locations" }]);
    expect([counters(next, s.camp), counters(next, s.ford), counters(next, s.hill), counters(next, s.plain)]).toEqual([2, 0, 3, 0]);
  });

  it("a location whose last counter goes is announced, once, and the others are not", () => {
    const s = scene();
    const next = runStopped(s.state, [{ verb: "RemoveTimeCounters", target: "locations" }]);
    expect(heard(next, s.ford)).toBe(true);
    expect(heard(next, s.camp)).toBe(false);
    expect((next.pendingEvents ?? []).filter((event) => event.trigger === "lastTimeCounterRemoved")).toHaveLength(1);
  });

  it("takes an amount one counter at a time and stops at none", () => {
    const s = scene();
    const next = run(s.state, [{ verb: "RemoveTimeCounters", target: "locations", amount: 2 }]);
    expect([counters(next, s.camp), counters(next, s.ford), counters(next, s.hill)]).toEqual([1, 0, 2]);
  });

  it("touches no enemy and no other kind of card", () => {
    const s = scene();
    const enemy = put(s.state, "orc", "staging", 2);
    expect(counters(run(enemy.state, [{ verb: "RemoveTimeCounters", target: "locations" }]), enemy.id)).toBe(2);
  });
});

describe("RemoveTimeCounters on the active location (08151:A:2, 08154:A:1, 08160:A:3)", () => {
  it("takes 1 counter off the active location and none from the staging area", () => {
    const s = scene();
    const next = run(s.state, [{ verb: "RemoveTimeCounters", target: "active" }]);
    expect([counters(next, s.hill), counters(next, s.camp), counters(next, s.ford)]).toEqual([3, 3, 1]);
  });

  it("does nothing with no active location, or one with no counter", () => {
    const s = scene();
    const none = run(moveCard(s.state, s.hill, { zone: "staging" }), [{ verb: "RemoveTimeCounters", target: "active" }]);
    expect(counters(none, s.camp)).toBe(3);
    const empty = run(updateCard(s.state, s.hill, { resources: 0 }), [{ verb: "RemoveTimeCounters", target: "active" }]);
    expect(counters(empty, s.hill)).toBe(0);
  });
});

describe("RemoveTimeCounters with distribute (08153:A:1)", () => {
  const DIVIDE: Instruction = { verb: "RemoveTimeCounters", target: "locations", amount: 3, distribute: "firstPlayer" };

  it("asks the first player to choose the location, one counter at a time, among the locations that hold some", () => {
    const s = scene();
    const asked = run(s.state, [DIVIDE]);
    expect(asked.window?.kind).toBe("choose");
    expect(JSON.stringify(asked.window)).toContain(s.camp);
    expect(JSON.stringify(asked.window)).not.toContain(s.plain);
  });

  it("takes a single location without asking, all X counters, and stops at the counters it holds", () => {
    const s = scene();
    const only = run(updateCard(updateCard(s.state, s.ford, { resources: 0 }), s.hill, { resources: 0 }), [DIVIDE]);
    expect(counters(only, s.camp)).toBe(0);
    expect(only.window).toBeNull();
    const fewer = run(updateCard(updateCard(updateCard(s.state, s.camp, { resources: 2 }), s.ford, { resources: 0 }), s.hill, { resources: 0 }), [{ ...DIVIDE, amount: 5 }]);
    expect(counters(fewer, s.camp)).toBe(0);
  });

  it("an amount of 0, as an empty hand gives, removes nothing", () => {
    const s = scene();
    const next = run(s.state, [{ ...DIVIDE, amount: { hand: true } }]);
    expect([counters(next, s.camp), counters(next, s.ford), counters(next, s.hill)]).toEqual([3, 1, 4]);
  });
});

describe("PlaceTimeCounters (08159:A:1, 08147:A:1)", () => {
  it("puts the printed Time X on each location with the keyword and no counter, and leaves the others", () => {
    const s = scene();
    const emptied = updateCard(updateCard(s.state, s.camp, { resources: 0 }), s.hill, { resources: 0 });
    const next = run(emptied, [{ verb: "PlaceTimeCounters", target: "locationsWithNone" }]);
    expect([counters(next, s.camp), counters(next, s.ford), counters(next, s.hill), counters(next, s.plain)]).toEqual([3, 1, 4, 0]);
  });

  it("08159:A:1 after the removal, a location whose last counter went gets X again", () => {
    const s = scene();
    const next = run(s.state, [{ verb: "RemoveTimeCounters", target: "locations" }, { verb: "PlaceTimeCounters", target: "locationsWithNone" }]);
    expect([counters(next, s.camp), counters(next, s.ford), counters(next, s.hill)]).toEqual([2, 2, 3]);
  });
});

describe("the amount timeOfActive (08154:A:2, 08158:A:2)", () => {
  it("is the printed Time X of the active location, not the counters on it, and 0 with none", () => {
    const s = scene();
    const scope = frameScope(s.state, 0, null);
    expect(resolveAmount(s.state, { timeOfActive: true }, scope, ctx)).toBe(4);
    const staged = moveCard(s.state, s.hill, { zone: "staging" });
    expect(resolveAmount(staged, { timeOfActive: true }, frameScope(staged, 0, null), ctx)).toBe(0);
  });

  it("is 0 for an active location with no Time keyword", () => {
    const s = scene();
    const swapped = put(moveCard(s.state, s.hill, { zone: "staging" }), "plain", "activeLocation", 0);
    expect(resolveAmount(swapped.state, { timeOfActive: true }, frameScope(swapped.state, 0, null), ctx)).toBe(0);
  });
});

describe("a set-aside card with Time X added to the staging area (08149:A:1)", () => {
  it("gets its time counters as it enters play, with no reveal", () => {
    const aside = spawn(table(), "camp", { zone: "setAside" });
    const next = run(aside.state, [{ verb: "AddSetAsideToStaging", code: "camp" }]);
    expect(next.staging).toEqual([aside.id]);
    expect(counters(next, aside.id)).toBe(3);
  });

  it("a card without Time, or one added from the encounter deck, gets none", () => {
    const aside = spawn(table(), "plain", { zone: "setAside" });
    expect(counters(run(aside.state, [{ verb: "AddSetAsideToStaging", code: "plain" }]), aside.id)).toBe(0);
  });
});

// The instruction run outside a settle, so the events the removal queued are still pending.
function runStopped(state: ScenarioState, instructions: Instruction[]): ScenarioState {
  return instructions.reduce((next, instruction) => runInstruction(next, instruction, { seat: 0, sourceId: null }, ctx, []), { ...state, mode: "stopped" } as ScenarioState);
}
