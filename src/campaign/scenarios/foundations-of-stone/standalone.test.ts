// Rules: rr.setup, rr.winning-the-game, dwd.setup-foundations-of-stone, dwd.setup-foundations-of-stone-cave-torch, dwd.cave-torch (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

// What is Foundations of Stone's own in the standalone game: the Nightmare deck dealt on Nightmare (the cards that bear the Goblins of the Deep icon in the standard deck, the ones that bear the Foundations of Stone icon in the set-aside set, the setup card staying next to the quest deck), the Easy counts
// and the Setup (Cave Torch on a hero, the Foundations of Stone set aside, all eight stages in the quest deck on every difficulty). The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's
// (test/harness/golden-suite.ts).
const stone = loadAnyScenario("foundations-of-stone");
const countOf = (code: string, name: string) => Object.values(goldenState(stone.id, name).cards).filter((card) => card.code === code).length;
const NIGHTMARE_CARDS = stone.nightmare?.cards ?? [];
const ENCOUNTER = stone.cards.filter((card) => card.pile === "encounter" || card.pile === "encounterDeck2");

describe("Foundations of Stone in the dwarrowdelf cycle", () => {
  it("deals its Nightmare deck on Nightmare (every card of it has a record) and none of it on another difficulty", () => {
    const state = goldenState(stone.id, "Nightmare solo win");
    expect(Object.values(state.cards).some((card) => card.code === stone.nightmare?.setupCard && card.zone === "nightmare")).toBe(true);
    for (const card of NIGHTMARE_CARDS) {
      expect(countOf(card.code, "Nightmare solo win"), card.code).toBe(card.copies);
      expect(countOf(card.code, "solo win"), card.code).toBe(0);
    }
  });

  it("901701:B:13 puts the Nightmare cards with the Goblins of the Deep icon in the standard deck and the ones with the Foundations of Stone icon in the set-aside set", () => {
    const piles = Object.fromEntries(NIGHTMARE_CARDS.map((card) => [card.code, card.pile]));
    expect(piles).toMatchObject({ "901702": "encounter", "901703": "encounter", "901704": "encounterDeck2", "901705": "encounterDeck2", "901706": "encounterDeck2", "901707": "encounterDeck2", "901708": "encounterDeck2" });
  });

  it("deals the Easy counts on Easy and the Normal counts on Normal (every encounter card of the box)", () => {
    for (const card of ENCOUNTER) {
      expect(countOf(card.code, "Easy solo win"), `Easy ${card.code}`).toBe(card.easy);
      expect(countOf(card.code, "solo win"), `Normal ${card.code}`).toBe(card.normal);
    }
  });

  it("04111:A:1 attaches Cave Torch to a hero at Setup, sets the Foundations of Stone set aside and keeps the other seven stages in the quest deck on every difficulty", () => {
    for (const name of ["solo win", "Easy solo win", "Nightmare solo win"]) {
      const state = goldenState(stone.id, name);
      const torch = Object.values(state.cards).filter((card) => card.code === "03041");
      expect(torch.length, name).toBe(1);
      expect(torch[0]?.host != null || torch[0]?.zone === "removed", name).toBe(true);
      expect(countOf("04125", name), name).toBeGreaterThan(0);
      for (const code of ["04111", "04112", "04113", "04114", "04115", "04116", "04117", "04118"]) expect(countOf(code, name), `${name} ${code}`).toBe(1);
    }
  });

  it("04111:A:1 deals the Foundations of Stone set in its own pile (set aside) and the other sets in the standard encounter deck", () => {
    const pileOf = (code: string) => stone.cards.find((card) => card.code === code)?.pile;
    expect(pileOf("04125")).toBe("encounterDeck2");
    expect(pileOf("04127")).toBe("encounterDeck2");
    expect(ENCOUNTER.some((card) => card.pile === "encounter")).toBe(true);
  });
});
