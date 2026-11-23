// Rules: none (a scenario with no Nightmare deck); docs/scenarios/standalone-scenarios/attack-on-dol-guldur.md (Attack on Dol Guldur).
// What is Attack on Dol Guldur's own in the standalone game. Its Setup is the golden suite's opening check (golden.test.ts); the cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a
// standalone run with nothing earned, the loss reasons) are the golden suite's too (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { guldurStart, guldurWorld } from "../../../../test/scenarios/attack-on-dol-guldur/game.ts";
import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";

describe("Attack on Dol Guldur in the standalone-scenarios cycle", () => {
  it("has no Nightmare deck and deals the Standard Game Mode as its mode card", () => {
    const scenario = loadAnyScenario("attack-on-dol-guldur");
    expect(scenario.nightmare).toBeUndefined();
    expect("modeCard" in scenario && scenario.modeCard).toBe("50931");
  });

  it("deals the same encounter deck on Easy and Normal, with a Marauder for each player staged", async () => {
    const { ctx } = await guldurWorld();
    const after = (seats: 1 | 2, difficulty: "Easy" | "Normal") => {
      const state = expectOk(reduce(startScenario(guldurStart(seats, 1, difficulty), ctx), { type: "Keep" }, ctx)).state;
      return { deck: state.encounterDeck.length, staging: state.staging.length, mode: Object.values(state.cards).find((card) => card.zone === "modeCard")?.face };
    };
    expect(after(1, "Easy")).toEqual(after(1, "Normal"));
    // Dol Guldur, Power of Lórien and one Marauder are in the staging area, and 39 cards are left for 1 player.
    expect(after(1, "Normal")).toEqual({ deck: 39, staging: 3, mode: "B" });
  });
});
