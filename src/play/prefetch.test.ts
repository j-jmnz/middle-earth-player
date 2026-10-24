import { describe, expect, it } from "vitest";

import { expectOk } from "../rules/fixture.ts";
import { reduce, startScenario } from "../rules/reduce.ts";
import { updateCard } from "../rules/state.ts";
import { starterStart, starterWorld } from "../../scripts/starter-game.ts";

import { prefetchCodes, resolutionCodes } from "./prefetch.ts";

// The table prefetches the hand, staging and the next screen, and nothing else (docs/architecture.md, Images).
describe("prefetch", () => {
  it("asks for the hand, the face-up staging cards and the next screen, once each", async () => {
    const { ctx } = await starterWorld("stealth-and-steadfastness");
    const game = expectOk(reduce(startScenario(starterStart("stealth-and-steadfastness", 1), ctx), { type: "Keep" }, ctx)).state;
    const hand = game.seats[0].hand.map((id) => game.cards[id]?.code ?? "");
    const staging = game.staging.map((id) => game.cards[id]?.code ?? "");
    const codes = prefetchCodes(game, 0, ["141030", hand[0] ?? ""]);
    expect(codes).toEqual([...new Set([...hand, ...staging, "141030"])]);
    // Not the deck, the encounter deck or the discard piles.
    for (const id of [...game.seats[0].deck, ...game.encounterDeck]) {
      const code = game.cards[id]?.code ?? "";
      if (!hand.includes(code) && !staging.includes(code) && code !== "141030") expect(codes).not.toContain(code);
    }
    const hidden = updateCard(game, game.staging[0] ?? "", { face: "down" });
    expect(prefetchCodes(hidden, 0).length).toBeLessThanOrEqual(codes.length);
  });

  it("names the resolution's cards only once the scenario is won", async () => {
    const { ctx } = await starterWorld("stealth-and-steadfastness");
    const game = startScenario(starterStart("stealth-and-steadfastness", 1), ctx);
    expect(resolutionCodes(game)).toEqual([]);
    expect(resolutionCodes({ ...game, stageCleared: true })).toEqual(expect.arrayContaining(["141078", "141079"]));
  });
});
