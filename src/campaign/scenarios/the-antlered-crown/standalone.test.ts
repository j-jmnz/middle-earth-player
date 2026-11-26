// Rules: rr.setup, rr.winning-the-game (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";

// The scenario is the ninth of its cycle and has no campaign card, no boon or burden and nothing from the earlier parts, so there is nothing for a campaign test to carry on. Its wins and losses are the golden suite's (golden.test.ts); the cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run) are too (test/harness/golden-suite.ts, standalone: true).
const crown = loadAnyScenario("the-antlered-crown");

describe("The Antlered Crown in the the-ring-maker cycle", () => {
  it("has no Nightmare deck", () => {
    expect(crown.nightmare).toBeUndefined();
  });
});
