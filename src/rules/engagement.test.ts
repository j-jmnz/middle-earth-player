import { describe, expect, it } from "vitest";

import { cardMap, expectOk, fixtureDefinition, hero } from "./fixture.ts";
import { definePrinted } from "./printed.ts";
import { reduce } from "./reduce.ts";
import { blankScenario, withThreat, type ScenarioState } from "./state.ts";
import { spawn } from "./zones.ts";

function enemy(code: string, engagementCost: number | null, threat = 1) {
  return definePrinted({ code, name: code, type: "enemy", engagementCost, threat, attack: 0, defense: 0, health: 5 });
}

function staged(costs: readonly { code: string; engagementCost: number | null }[]): {
  state: ScenarioState;
  ids: Record<string, string>;
  cards: ReturnType<typeof cardMap>;
} {
  const printed = [hero("aragorn", "leadership", 10, 1), ...costs.map((row) => enemy(row.code, row.engagementCost))];
  const cards = cardMap(printed);
  let state = blankScenario({ seatCount: 1, seed: 2, definition: fixtureDefinition(["stage"]) });
  state = spawn(state, "aragorn", { zone: "heroes", seat: 0 }).state;
  state = withThreat(state, 0, 30);
  const ids: Record<string, string> = {};
  for (const row of costs) {
    const spawned = spawn(state, row.code, { zone: "staging" });
    state = spawned.state;
    ids[row.code] = spawned.id;
  }
  state = {
    ...state,
    phase: "Encounter",
    mode: "optionalEngage",
    window: { kind: "optionalEngage" },
    activeSeat: 0,
  };
  return { state, ids, cards };
}

describe("engagement", () => {
  it("repeats checks until no enemy still qualifies", () => {
    const { state, ids, cards } = staged([
      { code: "high", engagementCost: 40 },
      { code: "low", engagementCost: 10 },
      { code: "mid", engagementCost: 20 },
      { code: "none", engagementCost: null },
    ]);
    const checked = expectOk(reduce(state, { type: "DeclineEngage" }, { effects: [], cards }));
    expect(checked.state.seats[0].engaged).toEqual([ids.low, ids.mid]);
    expect(checked.state.staging).toEqual([ids.high, ids.none]);
    expect(checked.steps.filter((step) => step.kind === "engage").map((step) => step.kind === "engage" && step.enemyId)).toEqual([
      ids.low,
      ids.mid,
    ]);
  });

  it("lets a seat optionally engage any enemy, then keeps checking", () => {
    const { state, ids, cards } = staged([
      { code: "high", engagementCost: 40 },
      { code: "low", engagementCost: 10 },
    ]);
    const engaged = expectOk(reduce(state, { type: "Engage", enemyId: ids.high ?? "" }, { effects: [], cards }));
    expect(engaged.state.seats[0].engaged).toEqual([ids.high, ids.low]);
  });

  it("asks the first player when several enemies share the lowest cost", () => {
    const { state, ids, cards } = staged([
      { code: "a", engagementCost: 10 },
      { code: "b", engagementCost: 10 },
    ]);
    const choice = expectOk(reduce(state, { type: "DeclineEngage" }, { effects: [], cards }));
    expect(choice.state.window?.kind).toBe("chooseEnemy");
    expect(choice.state.seats[0].engaged).toEqual([]);
    const picked = expectOk(reduce(choice.state, { type: "ChooseEnemy", enemyId: ids.b ?? "" }, { effects: [], cards }));
    expect(picked.state.seats[0].engaged).toEqual([ids.b, ids.a]);
  });

  it("ends the loop after a full pass with no engagement", () => {
    const { state, ids, cards } = staged([{ code: "high", engagementCost: 40 }]);
    const passed = expectOk(reduce(state, { type: "DeclineEngage" }, { effects: [], cards }));
    expect(passed.steps.some((step) => step.kind === "engage")).toBe(false);
    expect(passed.state.seats[0].engaged).toEqual([]);
    expect(passed.state.staging).toEqual([ids.high]);
  });
});
