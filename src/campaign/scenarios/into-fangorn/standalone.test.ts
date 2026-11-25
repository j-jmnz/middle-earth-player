// Rules: rr.setup, rr.winning-the-game, rr.guarded, rr.objective-cards, rm.time-x (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

// What is Into Fangorn's own in the standalone game: the Easy counts, the cards the Setup places, and the stage the wins end on. The scenario is the third of its cycle and has no campaign card, no boon or burden and no Nightmare deck: it continues nothing
// from the earlier parts, so there is nothing for a campaign test to carry on. The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's
// (test/harness/golden-suite.ts, standalone: true).
const fangorn = loadAnyScenario("into-fangorn");
const countOf = (code: string, name: string) => Object.values(goldenState(fangorn.id, name).cards).filter((card) => card.code === code).length;
const WINS = ["solo win", "two-handed win", "Easy solo win through stage 3", "Easy two-handed win through stage 3"];

describe("Into Fangorn in the the-ring-maker cycle", () => {
  it("has no Nightmare deck", () => {
    expect(fangorn.nightmare).toBeUndefined();
  });

  it("deals Mugash, Edge of Fangorn and the three stages once on every difficulty", () => {
    for (const name of WINS) {
      for (const [code, count] of [["07031", 1], ["07032", 1], ["07065", 1], ["07066", 1], ["07067", 1]] as const) expect(countOf(code, name), `${name} ${code}`).toBe(count);
    }
  });

  it("ends every win on stage 2 with Mugash on a hero, since stage 3 cannot win", () => {
    for (const name of WINS) {
      const state = goldenState(fangorn.id, name);
      expect(state.cards[state.questStage ?? ""]?.code, name).toBe("07066");
      const mugash = Object.values(state.cards).find((card) => card.code === "07031");
      expect(mugash?.zone, name).toBe("attached");
      expect(state.cards[mugash?.host ?? ""]?.code, name).toBeTruthy();
    }
  });

  it("runs the Easy wins through stage 3 and back to stage 2 (the Time ran out on stage 2 and Mugash was shuffled into the encounter deck)", () => {
    for (const name of WINS.slice(2)) {
      const state = goldenState(fangorn.id, name);
      expect(state.cards[state.stageLeft?.from ?? ""]?.code, name).toBe("07067");
      expect(state.stageLeft?.bypassed, name).toBe(true);
    }
  });
});
