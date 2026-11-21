// Rules: rr.setup, rr.search, docs/brief.md (The Mines of Moria, readings 2 and 6) (data/rules/entries.json).
// What is The Mines of Moria's own in the standalone game. Its Setup is the golden suite's opening check (golden.test.ts); the cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a
// standalone run with nothing earned, the loss reasons) are the golden suite's too (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { minesStart, minesWorld } from "../../../../test/scenarios/the-mines-of-moria/game.ts";
import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";

describe("The Mines of Moria in the standalone-scenarios cycle", () => {
  it("has no Nightmare deck and no Easy twin", () => {
    expect(loadAnyScenario("the-mines-of-moria").nightmare).toBeUndefined();
  });

  it("deals the 14 sets (70 cards) and The Watcher in the staging area; the Setup builds the Quick-build deck: 7 of the 14 sets, the same on Easy and Normal", async () => {
    const { ctx } = await minesWorld();
    const opened = (difficulty: "Easy" | "Normal", seed: number) => {
      const dealt = startScenario(minesStart(1, seed, difficulty), ctx);
      expect(dealt.encounterDeck).toHaveLength(70);
      const kept = expectOk(reduce(dealt, { type: "Keep" }, ctx)).state;
      expect(kept.staging.map((id) => kept.cards[id]?.code)).toContain("51210");
      expect(Object.values(kept.cards).filter((card) => card.code === "51211")).toHaveLength(0);
      return kept;
    };
    for (const seed of [1, 2, 3]) {
      const state = opened("Normal", seed);
      const sets = new Set(state.encounterDeck.map((id) => ctx.cards.get(state.cards[id]?.code ?? "")?.encounterSet));
      // 7 sets of 5 cards, 35 in all.
      expect(state.encounterDeck, `seed ${seed}`).toHaveLength(35);
      expect(sets.size, `seed ${seed}`).toBe(7);
      expect(state.setAside.length, `seed ${seed}`).toBe(35);
    }
    expect(opened("Easy", 1).encounterDeck).toEqual(opened("Normal", 1).encounterDeck);
  });

  it("the sets kept change with the seed", async () => {
    const { ctx } = await minesWorld();
    const kept = (seed: number) => {
      const state = expectOk(reduce(startScenario(minesStart(1, seed, "Normal"), ctx), { type: "Keep" }, ctx)).state;
      return [...new Set(state.encounterDeck.map((id) => ctx.cards.get(state.cards[id]?.code ?? "")?.encounterSet))].sort().join();
    };
    expect(new Set([1, 2, 3, 4, 5, 6].map(kept)).size).toBeGreaterThan(1);
  });
});
