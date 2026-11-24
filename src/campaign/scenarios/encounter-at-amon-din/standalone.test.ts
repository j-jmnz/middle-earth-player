// Rules: rr.setup, rr.winning-the-game, rr.victory, ats.setup-encounter-at-amon-din, ats.setup-amon-din-objectives (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

// What is Encounter at Amon Dîn's own in the standalone game: the Normal and Easy counts of every card, the cards Easy leaves out (Craven Eagle, Homestead of Burnt-down Hearts' Burnt Homestead and the Orc Rabble of Ravaging Orcs), and what each win leaves in
// the victory display (Ghulat). The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, a loss writing nothing, the loss reasons) are the golden suite's
// (test/harness/golden-suite.ts, standalone: true). The scenario has no Nightmare deck: it deals only these cards (a win unlocks the next scenario of the cycle, a loss writes nothing).
const din = loadAnyScenario("encounter-at-amon-din");
const NORMAL = "solo win";
const TWO = "two-handed win, hunt first";
const EASY = "Easy two-handed win";
const cardsOf = (code: string, name: string) => Object.values(goldenState(din.id, name).cards).filter((card) => card.code === code);

describe("Encounter at Amon Dîn in the against-the-shadow cycle", () => {
  it("deals every card of the scenario in its Normal or Easy count", () => {
    // The two objectives, Burning Farmhouse and the stages are the Setup's: the encounter deck holds the rest, and a code listed twice (Burning Farmhouse) adds its Setup copy.
    const counts = (name: string, easy: boolean) => {
      const wanted = new Map<string, number>();
      for (const card of din.cards) wanted.set(card.code, (wanted.get(card.code) ?? 0) + (easy ? card.easy : card.normal));
      return [...wanted].map(([code, count]) => [code, cardsOf(code, name).length, count] as const);
    };
    for (const [code, dealt, wanted] of counts(NORMAL, false)) expect(dealt, `${code} Normal`).toBe(wanted);
    for (const [code, dealt, wanted] of counts(EASY, true)) expect(dealt, `${code} Easy`).toBe(wanted);
  });

  it("leaves out Craven Eagle, Homestead's Burnt Homestead and the Orc Rabble on Easy, and thins nothing else of Ravaging Orcs", () => {
    const counts = (name: string) => ["06074", "06078", "05062", "05063", "05064"].map((code) => cardsOf(code, name).length);
    expect(counts(NORMAL)).toEqual([2, 2, 3, 3, 2]);
    expect(counts(EASY)).toEqual([0, 0, 0, 3, 2]);
  });

  it("keeps Ghulat out of the encounter deck until stage 2 adds him, and leaves him in the victory display in each win", () => {
    for (const name of [NORMAL, TWO, EASY]) {
      expect(cardsOf("06071", name).map((card) => card.zone), name).toEqual(["victory"]);
    }
  });

  it("leaves Lord Alcaron in play in each win, a card the first player controls", () => {
    for (const name of [NORMAL, TWO, EASY]) {
      expect(cardsOf("06070", name).map((card) => card.zone), name).toEqual(["play"]);
    }
  });
});
