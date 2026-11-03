import { describe, expect, it } from "vitest";

import { cardMap, expectOk, fixtureDefinition, hero } from "../core/test-fixture.ts";
import { definePrinted } from "../core/printed.ts";
import { reduce } from "../engine/reduce.ts";
import { blankScenario, withThreat, type ScenarioState } from "../core/state.ts";
import { spawn } from "../core/zones.ts";

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
    expect(checked.state.seats[0].engaged).toEqual([ids.mid, ids.low]);
    expect(checked.state.staging).toEqual([ids.high, ids.none]);
    expect(checked.steps.filter((step) => step.kind === "engage").map((step) => step.kind === "engage" && step.enemyId)).toEqual([
      ids.mid,
      ids.low,
    ]);
  });

  it("engages the highest cost at or below threat first, not the lowest", () => {
    const { state, ids, cards } = staged([
      { code: "low", engagementCost: 5 },
      { code: "top", engagementCost: 30 },
      { code: "over", engagementCost: 31 },
    ]);
    const checked = expectOk(reduce(state, { type: "DeclineEngage" }, { effects: [], cards }));
    const order = checked.steps.flatMap((step) => (step.kind === "engage" ? [step.enemyId] : []));
    expect(order).toEqual([ids.top, ids.low]);
    expect(checked.state.staging).toEqual([ids.over]);
  });

  it("lets a seat optionally engage any enemy, then keeps checking", () => {
    const { state, ids, cards } = staged([
      { code: "high", engagementCost: 40 },
      { code: "low", engagementCost: 10 },
    ]);
    const engaged = expectOk(reduce(state, { type: "Engage", enemyId: ids.high ?? "" }, { effects: [], cards }));
    expect(engaged.state.seats[0].engaged).toEqual([ids.high, ids.low]);
  });

  it("asks the first player when several enemies share the highest qualifying cost", () => {
    const { state, ids, cards } = staged([
      { code: "a", engagementCost: 10 },
      { code: "b", engagementCost: 10 },
      { code: "c", engagementCost: 3 },
    ]);
    const choice = expectOk(reduce(state, { type: "DeclineEngage" }, { effects: [], cards }));
    expect(choice.state.window?.kind).toBe("chooseEnemy");
    expect(choice.state.window).toMatchObject({ options: [ids.a, ids.b] });
    expect(choice.state.seats[0].engaged).toEqual([]);
    const picked = expectOk(reduce(choice.state, { type: "ChooseEnemy", enemyId: ids.b ?? "" }, { effects: [], cards }));
    expect(picked.state.seats[0].engaged).toEqual([ids.b, ids.a, ids.c]);
  });

  it("ends the loop after a full pass with no engagement", () => {
    const { state, ids, cards } = staged([{ code: "high", engagementCost: 40 }]);
    const passed = expectOk(reduce(state, { type: "DeclineEngage" }, { effects: [], cards }));
    expect(passed.steps.some((step) => step.kind === "engage")).toBe(false);
    expect(passed.state.seats[0].engaged).toEqual([]);
    expect(passed.state.staging).toEqual([ids.high]);
  });
});
