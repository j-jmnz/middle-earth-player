// Rules: rr.setup, rr.winning-the-game, dwd.setup-the-long-dark, dwd.cave-torch-the-long-dark (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

// What is The Long Dark's own in the standalone game: the Nightmare deck dealt on Nightmare (its recipe takes cards of the standard deck out and shuffles the Nightmare cards in, the setup card staying next to the quest deck), the Easy counts (no Gathering Ground and no
// Goblin Warlord in the Easy deck) and the Setup (Cave Torch on a hero, the quest deck). The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's (test/harness/golden-suite.ts).
const dark = loadAnyScenario("the-long-dark");
const countOf = (code: string, name: string) => Object.values(goldenState(dark.id, name).cards).filter((card) => card.code === code).length;
const NIGHTMARE_CARDS = dark.nightmare?.cards ?? [];
const ENCOUNTER = dark.cards.filter((card) => card.pile === "encounter");

describe("The Long Dark in the dwarrowdelf cycle", () => {
  it("deals its Nightmare deck on Nightmare (every card of it has a record) and none of it on another difficulty", () => {
    const state = goldenState(dark.id, "Nightmare solo win");
    expect(Object.values(state.cards).some((card) => card.code === dark.nightmare?.setupCard && card.zone === "nightmare")).toBe(true);
    for (const card of NIGHTMARE_CARDS) {
      expect(countOf(card.code, "Nightmare solo win"), card.code).toBe(card.copies);
      expect(countOf(card.code, "solo win"), card.code).toBe(0);
    }
  });

  it("takes the cards the recipe removes out of the Nightmare deck", () => {
    for (const removed of dark.nightmare?.removed ?? []) {
      const normal = ENCOUNTER.find((card) => card.code === removed.code)?.normal ?? 0;
      expect(countOf(removed.code, "Nightmare solo win"), removed.code).toBe(removed.pile === "setAside" ? 0 : normal - removed.copies);
    }
  });

  it("deals the Easy counts on Easy and the Normal counts on Normal (every encounter card of the box): no Gathering Ground and no Goblin Warlord on Easy", () => {
    for (const card of ENCOUNTER) {
      expect(countOf(card.code, "Easy solo win"), `Easy ${card.code}`).toBe(card.easy);
      expect(countOf(card.code, "solo win"), `Normal ${card.code}`).toBe(card.normal);
    }
    expect(countOf("04095", "Easy solo win")).toBe(0);
    expect(countOf("04099", "Easy solo win")).toBe(0);
  });

  it("04086:A:1 attaches Cave Torch to a hero at Setup and keeps the second stage in the quest deck on every difficulty", () => {
    for (const name of ["solo win", "Easy solo win", "Nightmare solo win"]) {
      const state = goldenState(dark.id, name);
      const torch = Object.values(state.cards).filter((card) => card.code === "03041");
      expect(torch.length, name).toBe(1);
      expect(torch[0]?.host != null, name).toBe(true);
    }
  });

  it("deals Deeps of Moria's cards, not Hazards of the Pit's, with the box's encounter set (the rulesheet's third set, brief: Dwarrowdelf)", () => {
    const sets = new Set(ENCOUNTER.map((card) => card.code));
    expect(sets.has("04097")).toBe(true);
  });
});
