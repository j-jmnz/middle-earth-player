// Rules: rr.setup, rr.winning-the-game, rm.threat-elimination-level (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";

// The scenario is the sixth of its cycle and has no campaign card, no boon or burden and nothing from the earlier parts (The Three Trials hands nothing on), so there is nothing for a campaign test to carry on. Its wins and losses are the golden suite's (golden.test.ts); the cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run) are too (test/harness/golden-suite.ts, standalone: true).
const tharbad = loadAnyScenario("trouble-in-tharbad");

describe("Trouble in Tharbad in the the-ring-maker cycle", () => {
  it("has no Nightmare deck", () => {
    expect(tharbad.nightmare).toBeUndefined();
  });
});
