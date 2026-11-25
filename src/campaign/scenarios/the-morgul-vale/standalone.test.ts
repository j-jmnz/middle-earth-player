// Rules: rr.setup, ats.setup-the-morgul-vale, ats.setup-the-morgul-vale-to-the-tower, ats.captain-enemies, ltp.easy-mode (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

// What is The Morgul Vale's own in the standalone game: the Normal and Easy counts of every card, the cards Easy leaves out, and the three stages. The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a
// standalone run with nothing earned, a loss writing nothing, the loss reasons) are the golden suite's (test/harness/golden-suite.ts, standalone: true). The scenario deals no Nightmare deck and no card besides its own piles.
const vale = loadAnyScenario("the-morgul-vale");
const NORMAL = "two-handed win";
const EASY = "Easy solo win";
const cardsOf = (code: string, name: string) => Object.values(goldenState(vale.id, name).cards).filter((card) => card.code === code);

describe("The Morgul Vale in the against-the-shadow cycle", () => {
  it("deals every card of the scenario in its Normal or Easy count", () => {
    // Each code once with its counts added: a code listed twice in the scenario's data (a card in two piles) deals both.
    const counts = (name: string, easy: boolean) => {
      const wanted = new Map<string, number>();
      for (const card of vale.cards) wanted.set(card.code, (wanted.get(card.code) ?? 0) + (easy ? card.easy : card.normal));
      return [...wanted].map(([code, count]) => [code, cardsOf(code, name).length, count] as const);
    };
    for (const [code, dealt, wanted] of counts(NORMAL, false)) expect(dealt, `${code} Normal`).toBe(wanted);
    for (const [code, dealt, wanted] of counts(EASY, true)) expect(dealt, `${code} Easy`).toBe(wanted);
  });

  it("leaves out Impenetrable Fog, Orc Vanguard, Orc War Camp, The Master's Malice and Watcher in the Wood on Easy, halves The Dead City Looms and the Morgul Spiders, and keeps the three Captains and their cards on both", () => {
    const counts = (name: string, codes: readonly string[]) => codes.map((code) => cardsOf(code, name).length);
    expect(counts(NORMAL, ["06157", "05058", "05059", "05060", "05051", "06160", "05049"])).toEqual([2, 2, 2, 2, 2, 2, 3]);
    expect(counts(EASY, ["06157", "05058", "05059", "05060", "05051", "06160", "05049"])).toEqual([0, 0, 0, 0, 0, 1, 1]);
    for (const name of [NORMAL, EASY]) expect(counts(name, ["06151", "06152", "06153", "06147", "06156"]), name).toEqual([1, 1, 1, 1, 1]);
  });

  it("ends on The Morgul Rider, the last stage, with no quest deck behind it, after the stages The Rearguard and The Betrayal", () => {
    for (const name of [NORMAL, EASY]) {
      const state = goldenState(vale.id, name);
      expect(state.cards[state.questStage ?? ""]?.code, name).toBe("06146");
      expect(state.questDeck, name).toEqual([]);
    }
  });
});
