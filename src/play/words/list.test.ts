import { describe, expect, it } from "vitest";

import { kindWords, victorySaid, victoryWords } from "./list.ts";

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
});
