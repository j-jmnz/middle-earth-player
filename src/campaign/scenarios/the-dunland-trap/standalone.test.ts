// Rules: rr.setup, rr.winning-the-game, rr.engaged, rr.active-location, rm.time-x (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

// What is The Dunland Trap's own in the standalone game: the cards the Setup places, the Time X counters of 3B by the number of players, and the stage the wins end on. The scenario is the fourth of its cycle and has no campaign card, no boon or burden and no Nightmare deck: it continues nothing
// from the earlier parts, so there is nothing for a campaign test to carry on. The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's
// (test/harness/golden-suite.ts, standalone: true).
const trap = loadAnyScenario("the-dunland-trap");
const cardsOf = (name: string, code: string) => Object.values(goldenState(trap.id, name).cards).filter((card) => card.code === code);
const WINS = ["solo win", "two-handed win", "Easy solo win", "Easy two-handed win"];

describe("The Dunland Trap in the the-ring-maker cycle", () => {
  it("has no Nightmare deck", () => {
    expect(trap.nightmare).toBeUndefined();
  });

  it("deals the three stages, Chief Turch, the Ravine and Old South Road once on every difficulty", () => {
    for (const name of WINS) {
      for (const code of ["08011", "08012", "08013", "08014", "08015", "08016"]) expect(cardsOf(name, code).length, `${name} ${code}`).toBe(1);
    }
  });

  it("ends every win on stage 3B with its time counters gone and Turch engaged, the Ravine come out of the set-aside pile and no hero destroyed", () => {
    for (const name of WINS) {
      const state = goldenState(trap.id, name);
      expect(state.cards[state.questStage ?? ""]?.code, name).toBe("08013");
      expect(state.cards[state.questStage ?? ""]?.resources, name).toBe(0);
      expect(cardsOf(name, "08014")[0]?.zone, name).toBe("engaged");
      expect(cardsOf(name, "08015")[0]?.zone, name).not.toBe("setAside");
      expect(state.seats.slice(0, state.seatCount).every((seat) => seat.heroes.length === 3), name).toBe(true);
    }
  });

  it("loses on stage 3B when a hero is destroyed after the last counter", () => {
    for (const name of ["solo loss: a hero destroyed by the 3B attacks", "two-handed loss: a hero destroyed by the 3B attacks"]) {
      const state = goldenState(trap.id, name);
      expect(state.cards[state.questStage ?? ""]?.code, name).toBe("08013");
      expect(state.cards[state.questStage ?? ""]?.resources, name).toBe(0);
      expect(state.lossReason, name).toContain("A hero was destroyed");
    }
  });
});
