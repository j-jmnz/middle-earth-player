// Rules: rr.setup, rr.search, docs/scenarios/standalone-scenarios.md (Escape from Khazad-dûm, readings 2, 3 and 6) (data/rules/entries.json).
// What is Escape from Khazad-dûm's own in the standalone game. Its Setup is the golden suite's opening check (golden.test.ts); the cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a
// standalone run with nothing earned, the loss reasons) are the golden suite's too (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { khazadStart, khazadWorld } from "../../../../test/scenarios/escape-from-khazad-dum/game.ts";
import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";

describe("Escape from Khazad-dûm in the standalone-scenarios cycle", () => {
  it("has no Nightmare deck and no Easy twin", () => {
    expect(loadAnyScenario("escape-from-khazad-dum").nightmare).toBeUndefined();
  });

  it("deals the 14 sets (70 cards) and Dark Pit in the staging area; the Setup builds the Quick-build deck: 7 of the 14 sets, the same on Easy and Normal", async () => {
    const { ctx } = await khazadWorld();
    const opened = (difficulty: "Easy" | "Normal", seed: number) => {
      const dealt = startScenario(khazadStart(1, seed, difficulty), ctx);
      expect(dealt.encounterDeck).toHaveLength(70);
      const kept = expectOk(reduce(dealt, { type: "Keep" }, ctx)).state;
      expect(kept.staging.map((id) => kept.cards[id]?.code)).toContain("51310");
      // Durin's Bane is Dark Pit's other side: it exists only once Dark Pit has flipped.
      expect(Object.values(kept.cards).filter((card) => card.code === "51311")).toHaveLength(0);
      return kept;
    };
    for (const seed of [1, 2, 3]) {
      const state = opened("Normal", seed);
      const sets = new Set([...state.encounterDeck, ...state.staging].map((id) => ctx.cards.get(state.cards[id]?.code ?? "")?.encounterSet).filter((set) => set != null && /Khazad-dûm \d+$/.test(set)));
      // 7 sets of 5 cards, 35 in all, less the 0 cost enemy or location the Setup search added to the staging area.
      expect(state.encounterDeck.length, `seed ${seed}`).toBeLessThanOrEqual(35);
      expect(state.encounterDeck.length, `seed ${seed}`).toBeGreaterThanOrEqual(34);
      expect(sets.size, `seed ${seed}`).toBe(7);
      expect(state.setAside.length, `seed ${seed}`).toBe(35);
    }
    expect(opened("Easy", 1).encounterDeck).toEqual(opened("Normal", 1).encounterDeck);
  });

  it("the sets kept change with the seed", async () => {
    const { ctx } = await khazadWorld();
    const kept = (seed: number) => {
      const state = expectOk(reduce(startScenario(khazadStart(1, seed, "Normal"), ctx), { type: "Keep" }, ctx)).state;
      return [...new Set([...state.encounterDeck, ...state.staging].map((id) => ctx.cards.get(state.cards[id]?.code ?? "")?.encounterSet))].sort().join();
    };
    expect(new Set([1, 2, 3, 4, 5, 6].map(kept)).size).toBeGreaterThan(1);
  });
});
