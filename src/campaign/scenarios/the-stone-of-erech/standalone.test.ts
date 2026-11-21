// Rules: none (a scenario with no Nightmare deck).
// What is The Stone of Erech's own in the standalone game. Its Setup is the golden suite's opening check (golden.test.ts); the cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned,
// the loss reasons) are the golden suite's too (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";

const erech = loadAnyScenario("the-stone-of-erech");

describe("The Stone of Erech in the standalone-scenarios cycle", () => {
  it("has no Nightmare deck", () => {
    expect(erech.nightmare).toBeUndefined();
  });

  it("deals the same encounter deck on Easy as on Normal (the 38 cards of its set)", () => {
    const encounter = erech.cards.filter((card) => card.pile === "encounter");
    expect(encounter.reduce((sum, card) => sum + card.normal, 0)).toBe(38);
    expect(encounter.every((card) => card.easy === card.normal)).toBe(true);
  });
});
