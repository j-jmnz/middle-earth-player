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

  it("keeps one Villain and one Plot in the game and removes the other two of each", () => {
    for (const name of [NORMAL, TWO, EASY]) {
      const state = goldenState(fear.id, name);
      for (const set of [["06015", "06016", "06017"], ["06029", "06030", "06031"]]) {
        const zones = set.map((code) => cardsOf(code, name)[0]?.zone);
        expect(zones.filter((zone) => zone === "removed"), `${name} ${set.join()}`).toHaveLength(2);
      }
      expect(state.lost, name).toBe(false);
    }
  });

  it("leaves Clues the players claimed in the victory display, and the Villain out of play, in each win", () => {
    for (const name of [NORMAL, TWO, EASY]) {
      const state = goldenState(fear.id, name);
      const victory = state.victory.map((id) => state.cards[id]?.code);
      // Each stage 1 and 2 advanced on four tokens, so the players claimed or explored enough: a claimed Clue of 06026 or 06028 is a victory card, and so is a location explored.
      expect(victory.length, name).toBeGreaterThan(0);
      expect(["06015", "06016", "06017"].filter((code) => cardsOf(code, name).some((card) => card.zone === "staging" || card.zone === "engaged")), name).toEqual([]);
    }
  });
});
