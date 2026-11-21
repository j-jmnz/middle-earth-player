// Rules: rr.setup, rr.winning-the-game, dwd.setup-the-watcher-in-the-water, dwd.setup-the-watcher-in-the-water-set-aside (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

// What is The Watcher in the Water's own in the standalone game: the Nightmare deck dealt on Nightmare (its recipe takes the standard Watcher and some Misty Mountains cards out, shuffles the Nightmare cards in and sets the Nightmare Watcher aside in place of The Watcher), the Easy counts and the
// cards set aside. The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's (test/harness/golden-suite.ts).
const water = loadAnyScenario("the-watcher-in-the-water");
const countOf = (code: string, name: string) => Object.values(goldenState(water.id, name).cards).filter((card) => card.code === code).length;
const NIGHTMARE_CARDS = water.nightmare?.cards ?? [];
const ENCOUNTER = water.cards.filter((card) => card.pile === "encounter");

describe("The Watcher in the Water in the dwarrowdelf cycle", () => {
  it("deals its Nightmare deck on Nightmare (every card of it has a record) and none of it on another difficulty", () => {
    const state = goldenState(water.id, "Nightmare solo win");
    expect(Object.values(state.cards).some((card) => card.code === water.nightmare?.setupCard && card.zone === "nightmare")).toBe(true);
    for (const card of NIGHTMARE_CARDS) {
      expect(countOf(card.code, "Nightmare solo win"), card.code).toBe(card.copies);
      expect(countOf(card.code, "solo win"), card.code).toBe(0);
    }
  });

  it("deals the Nightmare Watcher (901502) set aside in place of The Watcher (04072) on Nightmare, and The Watcher on every other difficulty", () => {
    expect(countOf("04072", "Nightmare solo win")).toBe(0);
    expect(countOf("901502", "Nightmare solo win")).toBe(1);
    for (const name of ["solo win", "Easy solo win"]) {
      expect(countOf("901502", name), name).toBe(0);
      expect(countOf("04072", name), name).toBe(1);
    }
  });

  it("stages the Nightmare Watcher when The Seething Lake is revealed on Nightmare: it was in play and ended in the victory display with Doors of Durin", () => {
    for (const name of ["Nightmare solo win", "Nightmare two-handed win"]) {
      const state = goldenState(water.id, name);
      const codes = state.victory.map((id) => state.cards[id]?.code);
      expect(codes, name).toEqual(expect.arrayContaining(["901502", "04065"]));
      expect(state.stageCleared, name).toBe(true);
    }
  });

  it("takes the cards the recipe removes out of the Nightmare deck", () => {
    for (const removed of water.nightmare?.removed ?? []) {
      const normal = ENCOUNTER.find((card) => card.code === removed.code)?.normal ?? 0;
      expect(countOf(removed.code, "Nightmare solo win"), removed.code).toBe(removed.pile === "setAside" ? 0 : normal - removed.copies);
    }
  });

  it("deals the Easy counts on Easy and the Normal counts on Normal (every encounter card of the box)", () => {
    for (const card of ENCOUNTER) {
      expect(countOf(card.code, "Easy solo win"), `Easy ${card.code}`).toBe(card.easy);
      expect(countOf(card.code, "solo win"), `Normal ${card.code}`).toBe(card.normal);
    }
  });
});
