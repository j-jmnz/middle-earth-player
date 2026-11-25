// Rules: rr.setup, rr.winning-the-game, mec108.time-x, rm.grima-objective-ally (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

// What is The Fords of Isen's own in the standalone game: the Easy counts, the cards the Setup places and the three stages. The scenario opens the cycle: it has no campaign card, no boon or burden and no earlier part, so there is nothing for a campaign test to
// continue, and no Nightmare deck. The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's (test/harness/golden-suite.ts, standalone: true).
const isen = loadAnyScenario("the-fords-of-isen");
const countOf = (code: string, name: string) => Object.values(goldenState(isen.id, name).cards).filter((card) => card.code === code).length;

describe("The Fords of Isen in the the-ring-maker cycle", () => {
  it("has no Nightmare deck", () => {
    expect(isen.nightmare).toBeUndefined();
  });

  it("deals 1 Gríma, 1 The Islet and the three stages on every difficulty", () => {
    for (const name of ["solo win", "Easy solo win", "two-handed win", "Easy two-handed win"]) {
      for (const code of ["07016", "07017", "07059", "07060", "07061"]) expect(countOf(code, name), `${name} ${code}`).toBe(1);
    }
  });

  it("deals the Normal counts, and leaves cards out on Easy (2 Gap of Rohan, 1 Pillaging and Burning, Down from the Hills, 2 Dunland Raiders, 2 Dunland Chieftains, 1 Old Hatreds and 1 Wild Men of Dunland)", () => {
    for (const [code, normal, easy] of [["07020", 4, 2], ["07021", 2, 1], ["07022", 1, 0], ["07044", 2, 0], ["07045", 2, 1], ["07047", 2, 0], ["07049", 2, 1], ["07018", 3, 3], ["07023", 2, 2]] as const) {
      expect(countOf(code, "solo win"), `Normal ${code}`).toBe(normal);
      expect(countOf(code, "Easy solo win"), `Easy ${code}`).toBe(easy);
    }
  });

  it("ends every win on Hold the Fords with Gríma in play", () => {
    for (const name of ["solo win", "Easy solo win", "two-handed win", "Easy two-handed win"]) {
      const state = goldenState(isen.id, name);
      const ended = state.cards[state.questStage ?? ""]?.code === "07061" ? "07061" : state.cards[state.stageLeft?.from ?? ""]?.code;
      expect(ended, name).toBe("07061");
      expect(Object.values(state.cards).find((card) => card.code === "07016")?.zone, name).toBe("play");
    }
  });
});
