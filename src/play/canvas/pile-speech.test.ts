import { describe, expect, it } from "vitest";

import { pileSpeech } from "./pile-speech.ts";

describe("pileSpeech", () => {
  it("says the victory display's points and that it opens its list", () => {
    expect(pileSpeech({ zone: "victory", count: 3, points: 5 })).toEqual({ label: "Victory display, 3 cards, 5 victory points", hint: "Opens the list of cards" });
    expect(pileSpeech({ zone: "victory", count: 1, points: 1 }).label).toBe("Victory display, 1 card, 1 victory point");
  });

  it("says a discard pile holds a card playable now when it wears the play mark", () => {
    expect(pileSpeech({ zone: "discard", count: 5 }, true).label).toBe("Discard pile, 5 cards, a card playable now");
    expect(pileSpeech({ zone: "discard", count: 5 }).label).toBe("Discard pile, 5 cards");
  });

  it("gives a deck no hint", () => {
    expect(pileSpeech({ zone: "deck", count: 30 }).hint).toBeNull();
  });
});
