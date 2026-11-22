// Rules: rr.running-out-of-cards, dcce.corsair-deck, emce.evil-creatures-deck (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { reshuffleWords } from "./pile-ids.ts";

describe("a named deck's reshuffle", () => {
  it("reads like the encounter deck's, with the deck's own name", () => {
    expect(reshuffleWords("corsairDeck", 4)).toBe("The Corsair discard pile (4) is shuffled into the Corsair deck");
    expect(reshuffleWords("evilCreaturesDeck")).toBe("The Evil Creatures discard pile is shuffled into the Evil Creatures deck");
  });

  it("never names the deck's discard pile as the deck's own", () => {
    expect(reshuffleWords("nowhere", 2)).toBe("The discard pile (2) is shuffled into its deck");
  });
});
