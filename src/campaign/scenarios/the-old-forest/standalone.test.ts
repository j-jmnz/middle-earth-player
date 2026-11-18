// Rules: none (a scenario with no Nightmare deck).
// What is The Old Forest's own in the standalone game. Its Setup and what each difficulty deals are the golden suite's opening check (golden.test.ts); the cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a
// standalone run with nothing earned, the loss reasons) are the golden suite's too (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { forestStart, forestWorld } from "../../../../test/scenarios/the-old-forest/game.ts";
import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";

describe("The Old Forest in the standalone-scenarios cycle", () => {
  it("has no Nightmare deck", () => {
    expect(loadAnyScenario("the-old-forest").nightmare).toBeUndefined();
  });

  it("deals 31 encounter cards on Easy and 38 on Normal", async () => {
    const { ctx } = await forestWorld();
    const deckOf = (difficulty: "Easy" | "Normal") => expectOk(reduce(startScenario(forestStart(1, 1, difficulty), ctx), { type: "Keep" }, ctx)).state.encounterDeck.length;
    expect(deckOf("Easy")).toBe(31);
    expect(deckOf("Normal")).toBe(38);
  });
});
