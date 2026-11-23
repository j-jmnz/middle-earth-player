import { describe, expect, it } from "vitest";

import { facedownWords, kindWords, SET_ASIDE_FOOT, SET_ASIDE_TITLE, setAsideLabel, setAsideSaid, setAsideWords, victorySaid, victoryWords } from "./list.ts";

describe("kindWords", () => {
  it("names the type and the sphere", () => {
    expect(kindWords({ type: "event", sphere: "tactics" })).toBe("Event · Tactics");
    expect(kindWords({ type: "enemy", sphere: null })).toBe("Enemy");
    expect(kindWords({ type: "player-side-quest", sphere: "lore" })).toBe("Side quest · Lore");
    expect(kindWords(undefined)).toBeNull();
  });

  it("adds the Victory points on the victory list", () => {
    expect(victoryWords("Enemy", 4)).toBe("Enemy · 4 VP");
    expect(victoryWords(null, 1)).toBe("1 VP");
    expect(victorySaid("Enemy", 4)).toBe("Enemy, 4 victory points");
    expect(victorySaid(null, 1)).toBe("1 victory point");
  });

  it("words the Set aside list: the row, the facedown count in both numbers, a card's line and the foot", () => {
    expect(SET_ASIDE_TITLE).toBe("Set aside");
    expect(setAsideLabel(5)).toBe("Set aside (5)");
    expect(setAsideSaid(5)).toBe("Set aside cards, 5");
    expect(facedownWords(1)).toBe("1 card is facedown");
    expect(facedownWords(2)).toBe("2 cards are facedown");
    expect(setAsideWords("Enemy", "Set aside with 3 damage, which it keeps when it returns.")).toBe("Enemy · Set aside with 3 damage, which it keeps when it returns.");
    expect(setAsideWords("Enemy", null)).toBe("Enemy");
    expect(setAsideWords(null, null)).toBeNull();
    expect(SET_ASIDE_FOOT).toBe("These cards are out of play.");
  });
});
