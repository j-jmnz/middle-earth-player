// Rules: rr.setup, rr.winning-the-game, ats.setup-peril-in-pelargir (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

// What is Peril in Pelargir's own in the standalone game: the Easy counts (no Pelargir Docks, Lost in the City or Umbar Assassin and one Local Trouble), the three stages and the cards the Setup places. The cycle checks (a part of its cycle, no campaign card,
// playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's (test/harness/golden-suite.ts, standalone: true). The scenario has no Nightmare deck, so the dealt cards are the same on every win.
const pelargir = loadAnyScenario("peril-in-pelargir");
const countOf = (code: string, name: string) => Object.values(goldenState(pelargir.id, name).cards).filter((card) => card.code === code).length;

describe("Peril in Pelargir in the against-the-shadow cycle", () => {
  it("deals 1 Alcaron's Scroll, 1 The Leaping Fish and the three stages on every difficulty", () => {
    for (const name of ["solo win", "Easy solo win", "two-handed win"]) {
      for (const code of ["05019", "05021", "05065", "05066", "05067"]) expect(countOf(code, name), `${name} ${code}`).toBe(1);
    }
  });

  it("deals Pelargir Docks, Lost in the City, Umbar Assassin and 2 Local Troubles on Normal and leaves 3 of them out on Easy", () => {
    expect(countOf("05022", "solo win")).toBe(2);
    expect(countOf("05040", "solo win")).toBe(1);
    expect(countOf("05044", "solo win")).toBe(1);
    expect(countOf("05041", "solo win")).toBe(2);
    for (const code of ["05022", "05040", "05044"]) expect(countOf(code, "Easy solo win"), code).toBe(0);
    expect(countOf("05041", "Easy solo win")).toBe(1);
  });

  it("deals 5 Harbor Thugs on Normal and Easy", () => {
    for (const name of ["solo win", "Easy solo win"]) expect(countOf("05020", name), name).toBe(5);
  });

  it("ends every win on Escape to the Quays", () => {
    for (const name of ["solo win", "Easy solo win", "two-handed win", "Easy two-handed win"]) {
      const state = goldenState(pelargir.id, name);
      const ended = state.cards[state.questStage ?? ""]?.code === "05067" ? "05067" : state.cards[state.stageLeft?.from ?? ""]?.code;
      expect(ended, name).toBe("05067");
    }
  });
});
