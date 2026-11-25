// Rules: rr.setup, ats.setup-the-blood-of-gondor, ats.ally-objectives, ltp.easy-mode (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

// What is The Blood of Gondor's own in the standalone game: the Normal and Easy counts of every card, the cards Easy leaves out, and what the Setup puts in play and in the staging area. The cycle checks (a part of its cycle, no campaign
// card, playable, scored and recorded as a standalone run with nothing earned, a loss writing nothing, the loss reasons) are the golden suite's (test/harness/golden-suite.ts, standalone: true). The scenario deals no Nightmare deck and no
// card besides its own piles.
const blood = loadAnyScenario("the-blood-of-gondor");
const NORMAL = "two-handed win";
const EASY = "Easy two-handed win";
const cardsOf = (code: string, name: string) => Object.values(goldenState(blood.id, name).cards).filter((card) => card.code === code);

describe("The Blood of Gondor in the against-the-shadow cycle", () => {
  it("deals every card of the scenario in its Normal or Easy count", () => {
    // Each code once with its counts added: a code listed twice in the scenario's data (a card in two piles) deals both.
    const counts = (name: string, easy: boolean) => {
      const wanted = new Map<string, number>();
      for (const card of blood.cards) wanted.set(card.code, (wanted.get(card.code) ?? 0) + (easy ? card.easy : card.normal));
      return [...wanted].map(([code, count]) => [code, cardsOf(code, name).length, count] as const);
    };
    for (const [code, dealt, wanted] of counts(NORMAL, false)) expect(dealt, `${code} Normal`).toBe(wanted);
    for (const [code, dealt, wanted] of counts(EASY, true)) expect(dealt, `${code} Easy`).toBe(wanted);
  });

  it("leaves out Conflict at the Crossroads and the Orc Rabble on Easy, halves the Orc Ambusher and Brutal Uruk counts, and keeps the objective allies on both", () => {
    const counts = (name: string, codes: readonly string[]) => codes.map((code) => cardsOf(code, name).length);
    expect(counts(NORMAL, ["06131", "05062", "06120", "06121"])).toEqual([2, 3, 4, 3]);
    expect(counts(EASY, ["06131", "05062", "06120", "06121"])).toEqual([0, 0, 2, 1]);
    for (const name of [NORMAL, EASY]) expect(counts(name, ["06132", "06133", "06119", "06123"]), name).toEqual([1, 1, 1, 1]);
  });

  it("ends on Captured!, the last stage, with no quest deck behind it", () => {
    for (const name of [NORMAL, EASY]) {
      const state = goldenState(blood.id, name);
      expect(state.cards[state.questStage ?? ""]?.code, name).toBe("06118");
      expect(state.questDeck, name).toEqual([]);
    }
  });
});
