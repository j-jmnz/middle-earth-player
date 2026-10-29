// A card picture's rounded corners, the card screen's everywhere (user request, 2026-10-29).
import { describe, expect, it } from "vitest";

import { CARD_CORNER_MIN, cardCorner, containIn } from "./card-corner.ts";

describe("cardCorner", () => {
  it("is the card screen's 10 pt at its 236 pt width, the same share of any card's shorter side, never under 2 pt", () => {
    expect(cardCorner(236, 330)).toBeCloseTo(10, 9);
    expect(cardCorner(472, 660)).toBeCloseTo(20, 9);
    // A sideways card measures from its shorter side.
    expect(cardCorner(330, 236)).toBeCloseTo(10, 9);
    expect(cardCorner(32, 44)).toBe(CARD_CORNER_MIN);
  });
});

describe("containIn", () => {
  it("keeps the picture's shape, as large as fits, centered; the box itself before the picture is known", () => {
    expect(containIn(null, 32, 44)).toEqual({ x: 0, y: 0, w: 32, h: 44 });
    expect(containIn({ width: 100, height: 140 }, 50, 70)).toEqual({ x: 0, y: 0, w: 50, h: 70 });
    const quest = containIn({ width: 140, height: 100 }, 32, 44);
    expect(quest.w).toBeCloseTo(32, 9);
    expect(quest.h).toBeCloseTo(32 / 1.4, 9);
    expect(quest.y).toBeCloseTo((44 - 32 / 1.4) / 2, 9);
  });
});
