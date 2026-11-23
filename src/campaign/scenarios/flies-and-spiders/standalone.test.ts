// Rules: rr.setup, hob.bilbo-baggins-otd, hob.treasure-otd (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { GLADE } from "../../../../test/scenarios/flies-and-spiders/scene.ts";

const spiders = loadAnyScenario("flies-and-spiders");

// What is Flies and Spiders's own in the standalone game. The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's
// (test/harness/golden-suite.ts, standalone: true).
describe("Flies and Spiders in the the-hobbit cycle", () => {
  it("has no Nightmare deck: the cycle builds none (docs/scenarios/the-hobbit.md, The Hobbit), so nothing is dealt on Nightmare", () => {
    expect(spiders.nightmare).toBeUndefined();
  });

  it("deals The Spider's Glade and 4 copies of Bilbo's Magic Ring (one for each player the cycle seats, 132067:A:1) into the set-aside pile on Normal and Easy", () => {
    for (const mode of ["normal", "easy"] as const) {
      expect(spiders.cards.find((card) => card.code === GLADE), mode).toMatchObject({ [mode]: 1, pile: "setAside" });
      expect(spiders.cards.find((card) => card.code === "132019"), mode).toMatchObject({ [mode]: 4, pile: "setAside" });
    }
  });
});
