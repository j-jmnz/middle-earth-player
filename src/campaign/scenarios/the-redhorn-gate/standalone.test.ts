// Rules: rr.setup, rr.winning-the-game, dwd.setup-the-redhorn-gate, dwd.setup-the-redhorn-gate-set-aside (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

// What is The Redhorn Gate's own in the standalone game: the Nightmare deck dealt on Nightmare (its recipe takes cards out and shuffles Wolfpelt Goblin, Silvertine Marauder, Snow-Giant, Icy Cavern, Frozen Silverlode, Blinding Blizzard and Caradhras the Cruel in), the Easy counts
// (no Avalanche! and no Mountain Troll) and the cards set aside. The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's (test/harness/golden-suite.ts).
const gate = loadAnyScenario("the-redhorn-gate");
const countOf = (code: string, name: string) => Object.values(goldenState(gate.id, name).cards).filter((card) => card.code === code).length;
const NIGHTMARE_CARDS = ["901302", "901303", "901304", "901305", "901306", "901307", "901308"];

describe("The Redhorn Gate in the dwarrowdelf cycle", () => {
  it("deals its Nightmare deck on Nightmare (every card of it has a record)", () => {
    const state = goldenState(gate.id, "Nightmare solo win");
    expect(Object.values(state.cards).some((card) => card.code === gate.nightmare?.setupCard && card.zone === "nightmare")).toBe(true);
    for (const code of NIGHTMARE_CARDS) expect(countOf(code, "Nightmare solo win"), code).toBeGreaterThan(0);
    for (const code of NIGHTMARE_CARDS) expect(countOf(code, "solo win"), code).toBe(0);
  });

  it("901301:A:2 sets the 2 Blinding Blizzards aside and 901301:A:3 shuffles them in with 2B", () => {
    expect(countOf("901307", "Nightmare solo win")).toBe(2);
    expect(countOf("901307", "solo win")).toBe(0);
  });

  it("deals the plain three stages on every difficulty and ends on The Mountains' Peaks", () => {
    for (const name of ["solo win", "Easy solo win", "Nightmare solo win"]) {
      const state = goldenState(gate.id, name);
      const ended = state.cards[state.questStage ?? ""]?.code === "04013" ? "04013" : state.cards[state.stageLeft?.from ?? ""]?.code;
      expect(ended, name).toBe("04013");
      for (const code of ["04011", "04012", "04013"]) expect(countOf(code, name), `${name} ${code}`).toBe(1);
    }
  });

  it("deals 5 Snowstorms on every difficulty and leaves out Avalanche! and Mountain Troll on Easy", () => {
    for (const name of ["solo win", "Easy solo win", "Nightmare solo win"]) expect(countOf("04022", name), name).toBe(5);
    expect(countOf("04024", "Easy solo win")).toBe(0);
    expect(countOf("04026", "Easy solo win")).toBe(0);
    expect(countOf("04024", "solo win")).toBeGreaterThan(0);
    expect(countOf("04026", "solo win")).toBeGreaterThan(0);
  });
});
