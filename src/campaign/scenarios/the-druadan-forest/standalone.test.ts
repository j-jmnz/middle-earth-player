// Rules: rr.setup, rr.winning-the-game, rr.victory, ats.setup-the-druadan-forest (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";

// What is The Drúadan Forest's own in the standalone game: the Normal and Easy counts of every card, the cards Easy thins or leaves out, and what each win leaves in the victory display (Drû-buri-Drû and the Woses the players
// filled with progress). The cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a standalone run with nothing earned, a loss writing nothing, the loss reasons) are the golden suite's
// (test/harness/golden-suite.ts, standalone: true). The scenario has no Nightmare deck.
const druadan = loadAnyScenario("the-druadan-forest");
const NORMAL = "solo win";
const TWO = "two-handed win";
const EASY = "Easy two-handed win";
const cardsOf = (code: string, name: string) => Object.values(goldenState(druadan.id, name).cards).filter((card) => card.code === code);

describe("The Drúadan Forest in the against-the-shadow cycle", () => {
  it("deals every card of the scenario in its Normal or Easy count", () => {
    for (const card of druadan.cards) {
      expect(cardsOf(card.code, NORMAL), `${card.code} Normal`).toHaveLength(card.normal);
      expect(cardsOf(card.code, EASY), `${card.code} Easy`).toHaveLength(card.easy);
    }
  });

  it("thins or leaves out the cards Easy changes (Drummer 3 to 1, Hunter 4 to 2, Ancestral Clearing out, Glade of Cleansing 3 to 1, Brooding Forest 3 to 1, Lost Companion out)", () => {
    const counts = (name: string) => ["06046", "06048", "06050", "06052", "05046", "05048"].map((code) => cardsOf(code, name).length);
    expect(counts(NORMAL)).toEqual([3, 4, 1, 3, 3, 2]);
    expect(counts(EASY)).toEqual([1, 2, 0, 1, 1, 0]);
  });

  it("keeps Drû-buri-Drû out of the encounter deck until the Setup sets him aside, and leaves him in the victory display in each win", () => {
    for (const name of [NORMAL, TWO, EASY]) {
      const state = goldenState(druadan.id, name);
      expect(cardsOf("06045", name).map((card) => card.zone), name).toEqual(["victory"]);
      // Every Wose in the victory display went there by progress, not by damage: none of them holds damage.
      const woses = state.victory.map((id) => state.cards[id]).filter((card) => card && card.code !== "06045");
      for (const card of woses) expect(card?.damage ?? 0, `${name} ${card?.code}`).toBe(0);
    }
  });
});
