import { describe, expect, it } from "vitest";

import { expectOk } from "../../rules/core/test-fixture.ts";
import { reduce, startScenario } from "../../rules/engine/reduce.ts";
import { updateCard } from "../../rules/core/state.ts";
import { starterStart, starterWorld } from "../../../test/scenarios/a-shadow-of-the-past/game.ts";

import { wilderlandFixture } from "../store/wilderland-fixture.ts";

import { prefetchCodes, resolutionCodes } from "./prefetch.ts";

// The table prefetches the hand, the face-up cards on the table (shadow cards and discard tops included) and the next screen,
// and nothing else (docs/architecture.md, Images).
describe("prefetch", () => {
  it("asks for the hand, the face-up cards on the table and the next screen, once each", async () => {
    const { ctx } = await starterWorld("stealth-and-steadfastness");
    const game = expectOk(reduce(startScenario(starterStart("stealth-and-steadfastness", 1), ctx), { type: "Keep" }, ctx)).state;
    const codeOf = (id: string | undefined) => game.cards[id ?? ""]?.code ?? "";
    const hand = game.seats[0].hand.map(codeOf);
    const codes = prefetchCodes(game, 0, ["141030", hand[0] ?? ""]);
    expect(codes).toEqual([...new Set(codes)]);
    for (const code of [...hand, ...game.staging.map(codeOf), "141030"]) expect(codes).toContain(code);
    // The quest stage and the heroes never pass through the hand or staging: they are asked for where they lie.
    const stage = Object.values(game.cards).find((card) => card.zone === "questStage");
    const hero = Object.values(game.cards).find((card) => card.zone === "heroes");
    expect(codes).toContain(`${stage?.code}.B`);
    expect(codes).toContain(hero?.code);
    // Not the deck or the encounter deck.
    const shown = new Set(Object.values(game.cards).filter((card) => card.zone !== "deck" && card.zone !== "encounterDeck").map((card) => card.code));
    for (const id of [...game.seats[0].deck, ...game.encounterDeck]) {
      const code = codeOf(id);
      if (!shown.has(code) && code !== "141030") expect(codes).not.toContain(code);
    }
    const hidden = updateCard(game, game.staging[0] ?? "", { face: "down" });
    expect(prefetchCodes(hidden, 0).length).toBeLessThanOrEqual(codes.length);
  });

  it("asks for a shadow card once it is face up, and for the top of the encounter discard pile", async () => {
    const { ctx } = await starterWorld("stealth-and-steadfastness");
    const game = expectOk(reduce(startScenario(starterStart("stealth-and-steadfastness", 1), ctx), { type: "Keep" }, ctx)).state;
    // Cards whose code no other card shares, so only the zone under test can bring them in.
    const only = (id: string) => Object.values(game.cards).filter((card) => card.code === game.cards[id]?.code).length === 1;
    const [first, second] = game.encounterDeck.filter(only);
    if (!first || !second) throw new Error("The encounter deck has too few single copies");
    const firstCode = game.cards[first]?.code ?? "";
    const secondCode = game.cards[second]?.code ?? "";
    const dealt = updateCard(game, first, { zone: "shadow", face: "down" });
    expect(prefetchCodes(dealt, 0)).not.toContain(firstCode);
    expect(prefetchCodes(updateCard(dealt, first, { face: "up" }), 0)).toContain(firstCode);
    const discarded = { ...updateCard(game, second, { zone: "encounterDiscard" }), encounterDiscard: [second] };
    expect(prefetchCodes(discarded, 0)).toContain(secondCode);
  });

  it("asks for side B's picture of a card lying on its B side: the quest stage after setup", async () => {
    const { ctx } = await starterWorld("stealth-and-steadfastness");
    const game = expectOk(reduce(startScenario(starterStart("stealth-and-steadfastness", 1), ctx), { type: "Keep" }, ctx)).state;
    const stage = game.cards[game.questStage ?? ""];
    expect(stage?.face).toBe("B");
    const codes = prefetchCodes(game, 0);
    expect(codes).toContain(`${stage?.code}.B`);
    expect(codes).not.toContain(stage?.code);
  });

  it("names the resolution's cards only once the scenario is won", async () => {
    const { ctx } = await starterWorld("stealth-and-steadfastness");
    const game = startScenario(starterStart("stealth-and-steadfastness", 1), ctx);
    expect(resolutionCodes(game)).toEqual([]);
    expect(resolutionCodes({ ...game, stageCleared: true })).toEqual(expect.arrayContaining(["141078", "141079"]));
  });

  it("asks for the top card of the Evil Creatures discard pile, and of no deck of the second slot", () => {
    const fixture = wilderlandFixture({ evilDeck: 2, evilDiscard: 2, caves: undefined });
    const codes = prefetchCodes(fixture.state, 0);
    expect(codes).toContain("warg");
    // The same cards in the deck alone are not asked for.
    const deckOnly = wilderlandFixture({ evilDeck: 2, evilDiscard: 0 });
    expect(prefetchCodes(deckOnly.state, 0)).not.toContain("warg");
  });
});
