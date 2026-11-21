// Rules: rr.setup, rr.winning-the-game, dwd.setup-shadow-and-flame, dwd.durins-bane (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

// What is Shadow and Flame's own in the standalone game: the Nightmare deck dealt on Nightmare (the setup card next to the quest deck, the ten Attack cards in the Balrog deck), the Easy counts and the Normal counts of the box, and the Setup (Durin's Bane
// in the staging area, Dark Pit set aside, all three stages dealt on every difficulty). The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's
// (test/harness/golden-suite.ts).
const flame = loadAnyScenario("shadow-and-flame");
const cardsOf = (code: string, name: string) => Object.values(goldenState(flame.id, name).cards).filter((card) => card.code === code);
const countOf = (code: string, name: string) => cardsOf(code, name).length;
const NIGHTMARE_CARDS = flame.nightmare?.cards ?? [];
const ENCOUNTER = flame.cards.filter((card) => card.pile === "encounter");

describe("Shadow and Flame in the dwarrowdelf cycle", () => {
  it("deals its Nightmare deck on Nightmare (every card of it has a record) and none of it on another difficulty", () => {
    expect(cardsOf(flame.nightmare?.setupCard ?? "", "Nightmare solo win").map((card) => card.zone)).toEqual(["nightmare"]);
    for (const card of NIGHTMARE_CARDS) {
      expect(countOf(card.code, "Nightmare solo win"), card.code).toBe(card.copies);
      expect(countOf(card.code, "solo win"), card.code).toBe(0);
    }
  });

  it("901801:A:2 puts the ten Attack cards of the Nightmare deck (901802 to 901806) in the Balrog deck and the others in the standard encounter deck", () => {
    const state = goldenState(flame.id, "Nightmare solo win");
    const attack = NIGHTMARE_CARDS.filter((card) => ["901802", "901803", "901804", "901805", "901806"].includes(card.code));
    expect(attack.reduce((sum, card) => sum + card.copies, 0)).toBe(10);
    for (const card of attack) expect(cardsOf(card.code, "Nightmare solo win").every((one) => one.deck === "balrog" || one.zone === "balrogDeck" || one.zone === "balrogDiscard"), card.code).toBe(true);
    expect((state.piles?.balrogDeck?.length ?? 0) + (state.piles?.balrogDiscard?.length ?? 0)).toBe(10);
    for (const card of NIGHTMARE_CARDS.filter((one) => !attack.includes(one))) expect(cardsOf(card.code, "Nightmare solo win").every((one) => one.zone !== "balrogDeck" && one.zone !== "balrogDiscard"), card.code).toBe(true);
  });

  it("deals the Easy counts on Easy and the Normal counts on Normal (every encounter card of the box)", () => {
    for (const card of ENCOUNTER) {
      expect(countOf(card.code, "Easy solo win"), `Easy ${card.code}`).toBe(card.easy);
      expect(countOf(card.code, "solo win"), `Normal ${card.code}`).toBe(card.normal);
    }
  });

  it("04138:A:1 deals all three stages on every difficulty (the Nightmare setup card removes no quest card), Durin's Bane once and Dark Pit once", () => {
    for (const name of ["solo win", "Easy solo win", "Nightmare solo win"]) {
      for (const code of ["04138", "04139", "04140", "04150", "04141"]) expect(countOf(code, name), `${name} ${code}`).toBe(1);
    }
  });
});
