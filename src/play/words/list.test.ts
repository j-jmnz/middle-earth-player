import { describe, expect, it } from "vitest";

import { copiesLabel, listAnd, copiesSaid, facedownWords, keptWords, kindWords, SET_ASIDE_TITLE, setAsideHead, setAsideLabel, setAsideSaid, setAsideWords, victorySaid, victoryWords } from "./list.ts";

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

  it("words the Set aside list: the row, the head, the facedown count in both numbers, the copies and a card's line", () => {
    expect(SET_ASIDE_TITLE).toBe("Set aside");
    expect(setAsideLabel(5)).toBe("Set aside (5)");
    expect(setAsideSaid(5)).toBe("Set aside cards, 5");
    expect(setAsideHead(21)).toBe("21 cards · out of play");
    expect(setAsideHead(1)).toBe("1 card · out of play");
    expect(facedownWords(1)).toBe("1 card is facedown");
    expect(facedownWords(2)).toBe("2 cards are facedown");
    expect(copiesLabel("Deep Deep Dark", 4)).toBe("Deep Deep Dark ×4");
    expect(copiesSaid("Deep Deep Dark", 4)).toBe("Deep Deep Dark, 4 copies");
    expect(copiesLabel("Durin's Bane", 1)).toBe("Durin's Bane");
    expect(copiesSaid("Durin's Bane", 1)).toBe("Durin's Bane");
    expect(keptWords(15)).toBe("Keeps 15 damage");
    expect(keptWords(0)).toBeNull();
    expect(setAsideWords("Enemy", keptWords(15))).toBe("Enemy · Keeps 15 damage");
    expect(setAsideWords("Enemy", null)).toBe("Enemy");
    expect(setAsideWords(null, null)).toBeNull();
  });
});

describe("listAnd", () => {
  it("joins one, two and three names as the table's words do", () => {
    expect(listAnd([])).toBe("");
    expect(listAnd(["Garrison"])).toBe("Garrison");
    expect(listAnd(["Desert Sands", "The Desert Path"])).toBe("Desert Sands and The Desert Path");
    expect(listAnd(["A", "B", "C"])).toBe("A, B and C");
  });
});
