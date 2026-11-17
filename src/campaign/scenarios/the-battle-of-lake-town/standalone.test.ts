// Rules: none (a scenario with no Nightmare deck).
// What is The Battle of Lake-town's own in the standalone game. Its Setup and what Easy deals are the golden suite's opening check (golden.test.ts); the cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a
// standalone run with nothing earned, the loss reasons) are the golden suite's too (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";

describe("The Battle of Lake-town in the standalone-scenarios cycle", () => {
  it("has no Nightmare deck", () => {
    expect(loadAnyScenario("the-battle-of-lake-town").nightmare).toBeUndefined();
  });

  it("deals the 9 Smaug cards to a deck of their own and Lake-town to the staging area", () => {
    const data = loadAnyScenario("the-battle-of-lake-town");
    expect(data.cards.filter((card) => ["50204", "50205", "50206"].includes(card.code)).every((card) => card.pile === "smaugDeck")).toBe(true);
    expect(data.cards.filter((card) => card.code === "50207").map((card) => card.pile)).toEqual(["staging"]);
  });
});
