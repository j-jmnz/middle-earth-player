// Rules: rr.setup, rr.winning-the-game, dwd.setup-the-seventh-level (data/rules/entries.json).
// What is The Seventh Level's own in the standalone game: the Nightmare deck dealt on Nightmare with Overseer Maurûl and Chamber of Records set aside, and the two stages every difficulty plays. The cycle checks (a part of its cycle, no campaign card,
// playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's (test/harness/golden-suite.ts).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

const level = loadAnyScenario("the-seventh-level");
const zonesOf = (code: string, name: string) => Object.values(goldenState(level.id, name).cards).filter((card) => card.code === code).map((card) => card.zone);

describe("The Seventh Level in the dwarrowdelf cycle", () => {
  it("deals its Nightmare deck on Nightmare (every card of it has a record)", () => {
    const state = goldenState(level.id, "Nightmare two-handed win");
    expect(Object.values(state.cards).some((card) => card.code === level.nightmare?.setupCard && card.zone === "nightmare")).toBe(true);
    expect(Object.values(state.cards).some((card) => level.nightmare?.cards.some((dealt) => dealt.code === card.code))).toBe(true);
  });

  it("901101:A:2 deals Overseer Maurûl and Chamber of Records only on Nightmare, where the won games destroy him", () => {
    expect(zonesOf("901102", "Nightmare two-handed win")).toEqual(["victory"]);
    expect(zonesOf("901102", "two-handed win")).toEqual([]);
    expect(zonesOf("901103", "two-handed win")).toEqual([]);
    expect(zonesOf("901103", "Nightmare two-handed win")).not.toEqual([]);
  });

  it("03068 The Fate of Balin is the last stage on every difficulty: the won games end on it with the Book removed", () => {
    for (const name of ["solo win", "Easy two-handed win", "Nightmare solo win"]) {
      const state = goldenState(level.id, name);
      expect(state.cards[state.questStage ?? ""]?.code, name).toBe("03068");
      expect(zonesOf("03024", name), name).toEqual(["removed"]);
    }
  });
});
