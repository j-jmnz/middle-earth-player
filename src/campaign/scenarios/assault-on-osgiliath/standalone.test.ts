// Rules: rr.setup, ats.setup-assault-on-osgiliath, ltp.easy-mode (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

// What is Assault on Osgiliath's own in the standalone game: the Normal and Easy counts of every card, the cards Easy leaves out, and what the Setup puts in the staging area. The cycle checks (a part of its cycle, no campaign card, playable,
// scored and recorded as a standalone run with nothing earned, a loss writing nothing, the loss reasons) are the golden suite's (test/harness/golden-suite.ts, standalone: true). The scenario deals no Nightmare deck and no card besides its own piles.
const assault = loadAnyScenario("assault-on-osgiliath");
const NORMAL = "solo win";
const EASY = "Easy solo win";
const cardsOf = (code: string, name: string) => Object.values(goldenState(assault.id, name).cards).filter((card) => card.code === code);

describe("Assault on Osgiliath in the against-the-shadow cycle", () => {
  it("deals every card of the scenario in its Normal or Easy count", () => {
    // Each code once with its counts added: a code listed twice in the scenario's data (a card in two piles) deals both.
    const counts = (name: string, easy: boolean) => {
      const wanted = new Map<string, number>();
      for (const card of assault.cards) wanted.set(card.code, (wanted.get(card.code) ?? 0) + (easy ? card.easy : card.normal));
      return [...wanted].map(([code, count]) => [code, cardsOf(code, name).length, count] as const);
    };
    for (const [code, dealt, wanted] of counts(NORMAL, false)) expect(dealt, `${code} Normal`).toBe(wanted);
    for (const [code, dealt, wanted] of counts(EASY, true)) expect(dealt, `${code} Easy`).toBe(wanted);
  });

  it("leaves out the Uruk Lieutenants and the Southron Commanders on Easy, and keeps all four unique locations on both", () => {
    const counts = (name: string, codes: readonly string[]) => codes.map((code) => cardsOf(code, name).length);
    expect(counts(NORMAL, ["06092", "06095"])).toEqual([2, 2]);
    expect(counts(EASY, ["06092", "06095"])).toEqual([0, 0]);
    for (const name of [NORMAL, EASY]) expect(counts(name, ["06096", "06097", "06098", "06099"]), name).toEqual([1, 1, 1, 1]);
  });

  it("has Retake the City as the one stage, with no quest deck behind it", () => {
    for (const name of [NORMAL, EASY]) {
      const state = goldenState(assault.id, name);
      expect(state.cards[state.questStage ?? ""]?.code, name).toBe("06091");
      expect(state.questDeck, name).toEqual([]);
    }
  });
});
