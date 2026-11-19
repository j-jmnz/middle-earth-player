// Rules: rr.setup, dwd.setup-into-the-pit (data/rules/entries.json).
// What is the scenario's own in the standalone game: the Nightmare deck dealt on Nightmare, with Goblin Ambush in the place of Goblin Patrol. The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's (test/harness/golden-suite.ts).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

const pit = loadAnyScenario("into-the-pit");
const zonesOf = (code: string, name: string) => Object.values(goldenState(pit.id, name).cards).filter((card) => card.code === code).map((card) => card.zone);

describe("Into the Pit in the dwarrowdelf cycle", () => {
  it("deals its Nightmare deck on Nightmare (every card of it has a record)", () => {
    const state = goldenState(pit.id, "Nightmare two-handed win");
    expect(Object.values(state.cards).some((card) => card.code === pit.nightmare?.setupCard && card.zone === "nightmare")).toBe(true);
    expect(Object.values(state.cards).some((card) => pit.nightmare?.cards.some((dealt) => dealt.code === card.code))).toBe(true);
  });

  it("901001:B:3 Goblin Ambush takes the place of Goblin Patrol as stage 2 on Nightmare, and Goblin Patrol is dealt on Normal", () => {
    expect(zonesOf("03065", "Nightmare two-handed win")).toEqual([]);
    expect(zonesOf("901002", "Nightmare two-handed win")).toEqual(["setAside"]);
    expect(zonesOf("901002", "two-handed win")).toEqual([]);
    expect(zonesOf("03065", "two-handed win")).toEqual(["setAside"]);
  });

  it("03066 A Way Up is the last stage on every difficulty: the won games end on it", () => {
    for (const name of ["solo win", "Easy two-handed win", "Nightmare solo win"]) {
      const state = goldenState(pit.id, name);
      expect(state.cards[state.questStage ?? ""]?.code, name).toBe("03066");
    }
  });
});
