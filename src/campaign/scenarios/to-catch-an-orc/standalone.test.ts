// Rules: rr.setup, rr.winning-the-game, rm.out-of-play-deck, rm.mugash-player-card-backs, rm.time-x (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

// What is To Catch an Orc's own in the standalone game: the Easy counts, the cards the Setup places, and the stage the wins end on. The scenario is the second of its cycle and has no campaign card, no boon or burden and no Nightmare deck: it continues nothing
// from The Fords of Isen, so there is nothing for a campaign test to carry on. The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's (test/harness/golden-suite.ts, standalone: true).
const orc = loadAnyScenario("to-catch-an-orc");
const countOf = (code: string, name: string) => Object.values(goldenState(orc.id, name).cards).filter((card) => card.code === code).length;
const WINS = ["solo win", "Easy solo win", "two-handed win", "Easy two-handed win"];

describe("To Catch an Orc in the the-ring-maker cycle", () => {
  it("has no Nightmare deck", () => {
    expect(orc.nightmare).toBeUndefined();
  });

  it("deals Mugash, his 3 Guards and the three stages once on every difficulty", () => {
    for (const name of WINS) {
      for (const [code, count] of [["07024", 1], ["07025", 3], ["07062", 1], ["07063", 1], ["07064", 1]] as const) expect(countOf(code, name), `${name} ${code}`).toBe(count);
    }
  });

  it("deals the Normal counts, and leaves cards out on Easy (2 Orc Territory, 2 Orc Hunter, 1 Orc Hound and 1 Take Cover!)", () => {
    for (const [code, normal, easy] of [["07030", 2, 0], ["07039", 3, 1], ["07040", 2, 1], ["07055", 3, 2], ["07026", 3, 3], ["07027", 4, 4], ["07041", 2, 2]] as const) {
      expect(countOf(code, "solo win"), `Normal ${code}`).toBe(normal);
      expect(countOf(code, "Easy solo win"), `Easy ${code}`).toBe(easy);
    }
  });

  it("ends every win on The Wizard's Prize with Mugash attached to a hero", () => {
    for (const name of WINS) {
      const state = goldenState(orc.id, name);
      const ended = state.cards[state.questStage ?? ""]?.code === "07064" ? "07064" : state.cards[state.stageLeft?.from ?? ""]?.code;
      expect(ended, name).toBe("07064");
      const mugash = Object.values(state.cards).find((card) => card.code === "07024");
      expect(mugash?.zone, name).toBe("attached");
    }
  });
});
