import { describe, expect, it } from "vitest";

import { cardMap, fixtureDefinition, hero } from "./test-fixture.ts";
import { legalIntents, reduce } from "../engine/reduce.ts";
import { blankScenario } from "./state.ts";
import { spawn } from "./zones.ts";

describe("engine numbers", () => {
  it("rejects an intent that supplies damage, threat, or progress", () => {
    let state = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
    state = spawn(state, "aragorn", { zone: "heroes", seat: 0 }).state;
    state = { ...state, phase: "Combat", mode: "enemyAttacks", window: { kind: "defense", enemyId: "missing", seat: 0 } };
    const cards = cardMap([hero("aragorn", "leadership")]);
    const ctx = { effects: [], cards };
    for (const intent of [
      { type: "DealDamage" as const, amount: 3 },
      { type: "RaiseThreat" as const, amount: 2 },
      { type: "PlaceProgress" as const, amount: 4 },
    ]) {
      const rejected = reduce(state, intent, ctx);
      expect(rejected.ok).toBe(false);
      if (!rejected.ok) {
        expect(rejected.reason).toBe("The engine computes that number");
        expect(rejected.state).toBe(state);
      }
    }
    expect(legalIntents(state, ctx).map((intent) => intent.type)).not.toContain("DealDamage");
  });
});

describe("resigning", () => {
  it("loses the game at once, in any window, and then refuses every intent", () => {
    let state = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });
    state = spawn(state, "aragorn", { zone: "heroes", seat: 0 }).state;
    state = { ...state, phase: "Combat", mode: "enemyAttacks", window: { kind: "defense", enemyId: "missing", seat: 0 } };
    const ctx = { effects: [], cards: cardMap([hero("aragorn", "leadership")]) };
    const resigned = reduce(state, { type: "Resign" }, ctx);
    expect(resigned.ok).toBe(true);
    if (!resigned.ok) return;
    expect(resigned.state.lost).toBe(true);
    expect(resigned.state.lossReason).toBe("The players resigned");
    expect(resigned.state.window).toBeNull();
    expect(reduce(resigned.state, { type: "Resign" }, ctx).ok).toBe(false);
  });
});
