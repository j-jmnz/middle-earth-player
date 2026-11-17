// Rules: none (a scenario with no Nightmare deck).
// What is The Massing at Osgiliath's own in the standalone game. Its Setup and what Easy deals are the golden suite's opening check (golden.test.ts); the cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a
// standalone run with nothing earned, the loss reasons) are the golden suite's too (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";

describe("The Massing at Osgiliath in the standalone-scenarios cycle", () => {
  it("has no Nightmare deck", () => {
    expect(loadAnyScenario("the-massing-at-osgiliath").nightmare).toBeUndefined();
  });
});
