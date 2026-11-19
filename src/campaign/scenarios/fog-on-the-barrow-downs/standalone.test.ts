// Rules: none (a scenario with no Nightmare deck).
// What is Fog on the Barrow-downs's own in the standalone game. Its Setup and what each difficulty deals are the golden suite's opening check (golden.test.ts); the cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a
// standalone run with nothing earned, the loss reasons) are the golden suite's too (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { downsStart, downsWorld } from "../../../../test/scenarios/fog-on-the-barrow-downs/game.ts";
import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";

describe("Fog on the Barrow-downs in the standalone-scenarios cycle", () => {
  it("has no Nightmare deck", () => {
    expect(loadAnyScenario("fog-on-the-barrow-downs").nightmare).toBeUndefined();
  });

  it("deals 27 encounter cards on Easy and 34 on Normal", async () => {
    const { ctx } = await downsWorld();
    const deckOf = (difficulty: "Easy" | "Normal") => expectOk(reduce(startScenario(downsStart(1, 1, difficulty), ctx), { type: "Keep" }, ctx)).state.encounterDeck.length;
    expect(deckOf("Easy")).toBe(27);
    expect(deckOf("Normal")).toBe(34);
  });
});
