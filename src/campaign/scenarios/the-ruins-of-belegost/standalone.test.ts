// Rules: none (a scenario with no Nightmare deck).
// What is The Ruins of Belegost's own in the standalone game. Its Setup is the golden suite's opening check (golden.test.ts); the cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a
// standalone run with nothing earned, the loss reasons) are the golden suite's too (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { belegostStart, belegostWorld } from "../../../../test/scenarios/the-ruins-of-belegost/game.ts";
import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";

describe("The Ruins of Belegost in the standalone-scenarios cycle", () => {
  it("has no Nightmare deck", () => {
    expect(loadAnyScenario("the-ruins-of-belegost").nightmare).toBeUndefined();
  });

  it("deals 32 encounter cards on Easy and 38 on Normal to one player: the deck holds the 4 Loot objectives the Setup shuffles in", async () => {
    const { ctx } = await belegostWorld();
    const deckOf = (difficulty: "Easy" | "Normal") => expectOk(reduce(startScenario(belegostStart(1, 1, difficulty), ctx), { type: "Keep" }, ctx)).state.encounterDeck.length;
    expect(deckOf("Easy")).toBe(32);
    expect(deckOf("Normal")).toBe(38);
  });
});
