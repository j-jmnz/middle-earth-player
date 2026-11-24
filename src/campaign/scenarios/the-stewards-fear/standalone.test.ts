// Rules: rr.setup, rr.winning-the-game, rr.objective-cards, rr.victory, ats.underworld, ats.setup-the-stewards-fear, ats.setup-the-stewards-fear-underworld-deck (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

// What is The Steward's Fear's own in the standalone game: the Normal and Easy counts of every card, the underworld deck's size on each difficulty, the Villain and the Plot each win leaves in the game, and what the Clues and the
// stages leave in the victory display. The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, the loss reasons) are the golden suite's
// (test/harness/golden-suite.ts, standalone: true). The scenario has no Nightmare deck.
const fear = loadAnyScenario("the-stewards-fear");
const NORMAL = "solo win";
const TWO = "two-handed win";
const EASY = "Easy two-handed win";
const UNDERWORLD = ["05037", "05042", "05043", "05044", "06026", "06027", "06028"];
const cardsOf = (code: string, name: string) => Object.values(goldenState(fear.id, name).cards).filter((card) => card.code === code);

describe("The Steward's Fear in the against-the-shadow cycle", () => {
  it("deals every card of the scenario in its Normal or Easy count", () => {
    for (const card of fear.cards) {
      expect(cardsOf(card.code, NORMAL), `${card.code} Normal`).toHaveLength(card.normal);
      expect(cardsOf(card.code, EASY), `${card.code} Easy`).toHaveLength(card.easy);
    }
  });

  it("leaves out or thins the cards that Easy changes (Houses of the Dead, 05040 and Umbar Assassin out, A Knife in the Back 3 to 1, 05041 2 to 1)", () => {
    const counts = (name: string) => ["06021", "05040", "05044", "06024", "05041"].map((code) => cardsOf(code, name).length);
    expect(counts(NORMAL)).toEqual([1, 1, 1, 3, 2]);
    expect(counts(EASY)).toEqual([0, 0, 0, 1, 1]);
  });

  it("builds an underworld deck of 12 cards on Normal and 11 on Easy, each from the set-aside codes", () => {
    const size = (name: string) => UNDERWORLD.flatMap((code) => cardsOf(code, name)).length;
    expect(size(NORMAL)).toBe(12);
    expect(size(EASY)).toBe(11);
  });

  it("leaves the Clues the players claimed in the victory display, and the hidden Villain in the encounter discard pile, in each win", () => {
    // The Clues each game claimed (a claimed A Prisoner, A Scrap of History or Secret Map goes to the victory display; Secret Map may go there for its progress): the codes, not a count.
    const claimed: Record<string, string[]> = { [NORMAL]: ["06028"], [TWO]: ["06026", "06028"], [EASY]: ["06026", "06027", "06028"] };
    for (const name of [NORMAL, TWO, EASY]) {
      const state = goldenState(fear.id, name);
      expect(state.victory.map((id) => state.cards[id]?.code).sort(), name).toEqual(claimed[name]);
      const villains = ["06015", "06016", "06017"].flatMap((code) => cardsOf(code, name)).filter((card) => card.zone !== "removed");
      expect(villains.map((card) => card.zone), name).toEqual(["encounterDiscard"]);
    }
  });
});
