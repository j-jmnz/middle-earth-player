// Rules: rr.setup, rr.search, docs/scenarios/standalone-scenarios/the-wizards-quest.md (The Wizard's Quest, readings 1 and 2) (data/rules/entries.json).
// What is The Wizard's Quest's own in the standalone game. Its Setup is the golden suite's opening check (golden.test.ts); the cycle checks (a part of its cycle, no campaign card, playable, scored and recorded as a
// standalone run with nothing earned, the loss reasons) are the golden suite's too (test/harness/golden-suite.ts, standalone: true).
import { describe, expect, it } from "vitest";

import { questStart, questWorld } from "../../../../test/scenarios/the-wizards-quest/game.ts";
import { loadAnyScenario } from "../../../../scripts/data/load-scenarios.ts";
import { reduce, startScenario } from "../../../rules/engine/reduce.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";

describe("The Wizard's Quest in the standalone-scenarios cycle", () => {
  it("has no Nightmare deck", () => {
    expect(loadAnyScenario("the-wizards-quest").nightmare).toBeUndefined();
  });

  it("deals the 14 sets (70 cards) and the Setup builds the Quick-build deck: 7 of the 14 sets, 35 cards, the same on Easy and Normal", async () => {
    const { ctx } = await questWorld();
    const opened = (difficulty: "Easy" | "Normal", seed: number) => {
      const dealt = startScenario(questStart(1, seed, difficulty), ctx);
      expect(dealt.encounterDeck).toHaveLength(70);
      return expectOk(reduce(dealt, { type: "Keep" }, ctx)).state;
    };
    for (const seed of [1, 2, 3]) {
      const state = opened("Normal", seed);
      const sets = new Set(state.encounterDeck.map((id) => ctx.cards.get(state.cards[id]?.code ?? "")?.encounterSet));
      expect(state.encounterDeck, `seed ${seed}`).toHaveLength(35);
      expect(sets.size, `seed ${seed}`).toBe(7);
      expect(state.setAside.length, `seed ${seed}`).toBe(35);
    }
    expect(opened("Easy", 1).encounterDeck).toEqual(opened("Normal", 1).encounterDeck);
  });

  it("the sets kept change with the seed", async () => {
    const { ctx } = await questWorld();
    const kept = (seed: number) => {
      const state = expectOk(reduce(startScenario(questStart(1, seed, "Normal"), ctx), { type: "Keep" }, ctx)).state;
      return [...new Set(state.encounterDeck.map((id) => ctx.cards.get(state.cards[id]?.code ?? "")?.encounterSet))].sort().join();
    };
    expect(new Set([1, 2, 3, 4, 5, 6].map(kept)).size).toBeGreaterThan(1);
  });
});
