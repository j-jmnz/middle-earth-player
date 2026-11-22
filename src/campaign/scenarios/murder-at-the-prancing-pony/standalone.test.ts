// Rules: rr.setup (data/rules/entries.json); docs/scenarios/standalone-scenarios.md (Murder at the Prancing Pony).
// What is Murder at the Prancing Pony's own in the standalone game. Its Setup is the golden suite's opening check (golden.test.ts); the cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a
// standalone run with nothing earned, the loss reasons) are the golden suite's too (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { ponyStart, ponyWorld } from "../../../../test/scenarios/murder-at-the-prancing-pony/game.ts";
import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { pileOf } from "../../../rules/core/piles.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";

describe("Murder at the Prancing Pony in the standalone-scenarios cycle", () => {
  it("has no Nightmare deck", () => {
    expect(loadAnyScenario("murder-at-the-prancing-pony").nightmare).toBeUndefined();
  });

  it("deals 27 encounter cards on Easy and 36 on Normal, and builds the Investigation deck of the 8 other Suspects and Hideouts and the Taken by Surprise the difficulty deals", async () => {
    const { ctx } = await ponyWorld();
    const after = (difficulty: "Easy" | "Normal") => expectOk(reduce(startScenario(ponyStart(1, 1, difficulty), ctx), { type: "Keep" }, ctx)).state;
    const easy = after("Easy");
    const normal = after("Normal");
    expect(easy.encounterDeck.length).toBe(27);
    expect(normal.encounterDeck.length).toBe(36);
    expect(pileOf(easy, "investigationDeck")).toHaveLength(9);
    expect(pileOf(normal, "investigationDeck")).toHaveLength(10);
  });
});
