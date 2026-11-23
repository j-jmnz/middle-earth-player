// Rules: hob.setup-the-battle-of-five-armies, hob.bilbo-baggins-otd, hob.treasure-otd (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario, loadCampaign } from "../../../../scripts/data/load-scenarios.ts";
import { isPlayable } from "../../playable.ts";

// What is The Battle of Five Armies's own in the standalone game. The cycle checks (a part of its cycle, no campaign card, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's
// (test/harness/golden-suite.ts, standalone: true). Nightmare is out of scope for The Hobbit.
describe("The Battle of Five Armies in the the-hobbit cycle", () => {
  const cycle = loadCampaign("the-hobbit");
  const armies = loadAnyScenario("the-battle-of-five-armies");

  it("hob.setup-the-battle-of-five-armies is the last scenario of the cycle, and every line of its cards has a record, so it is playable", () => {
    expect(cycle.scenarios.at(-1)).toBe("the-battle-of-five-armies");
    expect(isPlayable("the-battle-of-five-armies")).toBe(true);
  });

  it("hob.bilbo-baggins-otd the first player starts with the On the Doorstep Bilbo Baggins, and the dragon, web and troll treasure sets are listed", () => {
    expect(armies.sagaStart).toEqual({ hero: "132001" });
    expect(armies.treasures).toEqual(expect.arrayContaining(["131020", "132019", "132020"]));
  });

  it("hob.setup-the-battle-of-five-armies five quest stages are dealt, and Bolg starts in the staging area", () => {
    expect(armies.stages).toHaveLength(5);
    expect(armies.cards.filter((card) => card.pile === "staging").map((card) => card.code)).toEqual(["132053"]);
  });
});
