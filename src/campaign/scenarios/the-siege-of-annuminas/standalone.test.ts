// Rules: none (a scenario with no Nightmare deck); docs/brief.md (The Siege of Annúminas).
// What is The Siege of Annúminas's own in the standalone game. Its Setup is the golden suite's opening check (golden.test.ts); the cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a
// standalone run with nothing earned, the loss reasons) are the golden suite's too (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { annuminasStart, annuminasWorld } from "../../../../test/scenarios/the-siege-of-annuminas/game.ts";
import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";

describe("The Siege of Annúminas in the standalone-scenarios cycle", () => {
  it("has no Nightmare deck and deals the Standard Game Mode as its mode card", () => {
    const scenario = loadAnyScenario("the-siege-of-annuminas");
    expect(scenario.nightmare).toBeUndefined();
    expect("modeCard" in scenario && scenario.modeCard).toBe("50801");
  });

  it("deals the same encounter deck on Easy and Normal, less the Gate of Annúminas the Setup puts in the staging area", async () => {
    const { ctx } = await annuminasWorld();
    const after = (seats: 1, difficulty: "Easy" | "Normal") => {
      const state = expectOk(reduce(startScenario(annuminasStart(seats, 1, difficulty), ctx), { type: "Keep" }, ctx)).state;
      return { deck: state.encounterDeck.length, staging: state.staging.length, set: state.setAside.length, mode: Object.values(state.cards).find((card) => card.zone === "modeCard")?.face };
    };
    expect(after(1, "Easy")).toEqual(after(1, "Normal"));
    const solo = after(1, "Normal");
    // Annúminas and the Gate are in the staging area, the 10 cards of 1A set aside, 34 cards left for 1 player.
    expect(solo).toEqual({ deck: 34, staging: 2, set: 10, mode: "B" });
  });
});
