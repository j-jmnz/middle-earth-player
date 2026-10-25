import { describe, expect, it } from "vitest";

import type { Effect } from "../catalog/boundary.ts";

import { cardMap, expectOk, fixtureDefinition, hero } from "./fixture.ts";
import { settle } from "./machine.ts";
import { definePrinted } from "./printed.ts";
import { legalIntents, reduce } from "./reduce.ts";
import { blankScenario, withThreat, type ScenarioState } from "./state.ts";
import { spawn } from "./zones.ts";

// rr.framework-steps, rr.action-windows, rr.attack-resolution-chart: an action window between framework steps opens when
// some seat has an action it could take. Here a lamp in play has an Action (exhaust: raise your threat by 1).
const lampAction: Effect = {
  id: "lamp:action:1", cardCode: "lamp", lines: ["fixture:A:1"], timing: "action",
  cost: { kind: "exhaustSelf" }, instructions: [{ verb: "RaiseThreat" }],
};

const cards = cardMap([
  hero("aragorn", "leadership", 10, 1),
  definePrinted({ code: "lamp", name: "Lamp", type: "attachment", sphere: "neutral", cost: 0 }),
  definePrinted({ code: "orc", name: "Orc", type: "enemy", attack: 2, defense: 0, health: 9, engagementCost: 5, threat: 1 }),
]);

function table(withLamp: boolean): { state: ScenarioState; orc: string; aragorn: string } {
  let state = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
  const aragorn = spawn(state, "aragorn", { zone: "heroes", seat: 0 });
  state = aragorn.state;
  if (withLamp) state = spawn(state, "lamp", { zone: "play", seat: 0 }).state;
  const orc = spawn(state, "orc", { zone: "staging" });
  return { state: withThreat(orc.state, 0, 20), orc: orc.id, aragorn: aragorn.id };
}

describe("framework action windows", () => {
  it("open after optional engagement (5.2) and after the engagement checks (5.3), still in the Encounter phase", () => {
    const ctx = { effects: [lampAction], cards };
    const { state, orc } = table(true);
    const opened = settle({ ...state, phase: "Encounter", mode: "engagement", window: null, engagement: { ordinal: 0, engagedThisPass: false } }, ctx, []);
    expect(opened.window).toEqual({ kind: "frameAction" });
    expect(opened.phase).toBe("Encounter");
    expect(legalIntents(opened, ctx)).toContainEqual({ type: "Trigger", cardId: expect.any(String), effectId: "lamp:action:1" });
    const checked = expectOk(reduce(opened, { type: "Pass" }, ctx)).state;
    expect(checked.cards[orc]?.zone).toBe("engaged");
    expect(checked.window).toEqual({ kind: "frameAction" });
    expect(checked.phase).toBe("Encounter");
    const combat = expectOk(reduce(checked, { type: "Pass" }, ctx)).state;
    expect(combat.phase).toBe("Combat");
  });

  it("are skipped when no seat could take an action", () => {
    const ctx = { effects: [lampAction], cards };
    const { state, orc } = table(false);
    const settled = settle({ ...state, phase: "Encounter", mode: "engagement", window: null, engagement: { ordinal: 0, engagedThisPass: false } }, ctx, []);
    expect(settled.cards[orc]?.zone).toBe("engaged");
    expect(settled.phase).toBe("Combat");
  });

  it("open between the steps of an enemy attack: before the defender, before the shadow, before damage, before it ends", () => {
    const ctx = { effects: [lampAction], cards };
    const built = table(true);
    const engaged = spawn(built.state, "orc", { zone: "engaged", seat: 0 });
    const state: ScenarioState = { ...engaged.state, staging: [], cards: { ...engaged.state.cards, [built.orc]: { ...engaged.state.cards[built.orc]!, zone: "removed" } }, phase: "Combat", mode: "enemyAttacks", window: null };
    let current = settle(state, ctx, []);
    expect(current.pendingAttack).toMatchObject({ enemyId: engaged.id, awaiting: "defense" });
    expect(current.window).toEqual({ kind: "frameAction" });
    current = expectOk(reduce(current, { type: "Pass" }, ctx)).state;
    expect(current.window).toMatchObject({ kind: "defense", enemyId: engaged.id });
    current = expectOk(reduce(current, { type: "Undefended" }, ctx)).state;
    expect(current.pendingAttack?.awaiting).toBe("shadow");
    current = expectOk(reduce(current, { type: "Pass" }, ctx)).state;
    expect(current.pendingAttack?.awaiting).toBe("damage");
    expect(current.cards[built.aragorn]?.damage).toBe(0);
    current = expectOk(reduce(current, { type: "Pass" }, ctx)).state;
    expect(current.cards[built.aragorn]?.damage).toBe(2);
    expect(current.pendingAttack?.awaiting).toBe("end");
    current = expectOk(reduce(current, { type: "Pass" }, ctx)).state;
    expect(current.pendingAttack).toBeNull();
  });
});

describe("responses", () => {
  it("are offered as soon as their trigger has resolved, over a defense window, which then comes back (rr.response)", () => {
    const shield: Effect = {
      id: "aragorn:response:1", cardCode: "aragorn", lines: ["fixture:A:1"], timing: "response", trigger: "damaged",
      instructions: [{ verb: "RaiseThreat" }],
    };
    const ctx = { effects: [shield], cards };
    const built = table(false);
    const engaged = spawn(built.state, "orc", { zone: "engaged", seat: 0 });
    const waiting: ScenarioState = {
      ...engaged.state,
      phase: "Combat",
      mode: "enemyAttacks",
      pendingAttack: { enemyId: engaged.id, seat: 0 },
      window: { kind: "defense", enemyId: engaged.id, seat: 0 },
      pendingEvents: [{ trigger: "damaged", seat: 0, cardId: built.aragorn, subject: built.aragorn }],
    };
    const offered = settle(waiting, ctx, []);
    expect(offered.window).toEqual({ kind: "response", seat: 0 });
    const back = expectOk(reduce(offered, { type: "Pass" }, ctx)).state;
    expect(back.window).toEqual({ kind: "defense", enemyId: engaged.id, seat: 0 });
  });
});
