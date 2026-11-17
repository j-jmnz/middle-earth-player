import { describe, expect, it } from "vitest";

import { bubblePlace } from "./bubble-place.ts";

const none = { top: 0, bottom: 0, left: 0, right: 0 };

describe("the keyword bubble's place", () => {
  it("hangs under a chip in the upper half and over one in the lower half", () => {
    const upper = bubblePlace({ x: 40, y: 100, width: 80, height: 44 }, { width: 390, height: 844 }, none, 1);
    expect(upper.below).toBe(true);
    expect(upper.top).toBe(150);
    const lower = bubblePlace({ x: 40, y: 700, width: 80, height: 44 }, { width: 390, height: 844 }, none, 1);
    expect(lower.below).toBe(false);
    expect(lower.bottom).toBe(150);
  });

  it("keeps the whole bubble on screen in a landscape phone with a chip at mid-height", () => {
    const screen = { width: 844, height: 390 };
    const insets = { top: 0, bottom: 21, left: 47, right: 47 };
    const place = bubblePlace({ x: 500, y: 173, width: 96, height: 44 }, screen, insets, 1);
    // Over the chip, where there is more room; the bubble's height is capped to it.
    expect(place.below).toBe(false);
    expect(place.room).toBeGreaterThan(100);
    const top = screen.height - (place.bottom ?? 0) - place.room;
    expect(top).toBeGreaterThanOrEqual(insets.top);
    expect(screen.height - (place.bottom ?? 0)).toBeLessThanOrEqual(173);
    // A chip a little lower has more room under it than over it: the bubble stays above the home indicator.
    const low = bubblePlace({ x: 500, y: 40, width: 96, height: 44 }, screen, insets, 1);
    expect(low.below).toBe(true);
    expect((low.top ?? 0) + low.room).toBeLessThanOrEqual(screen.height - insets.bottom);
  });

  it("clamps the bubble inside the side insets", () => {
    const screen = { width: 844, height: 390 };
    const insets = { top: 0, bottom: 0, left: 47, right: 47 };
    const right = bubblePlace({ x: 800, y: 100, width: 40, height: 44 }, screen, insets, 1);
    expect(right.left + right.width).toBeLessThanOrEqual(screen.width - insets.right);
    const left = bubblePlace({ x: 0, y: 100, width: 40, height: 44 }, screen, insets, 1);
    expect(left.left).toBeGreaterThanOrEqual(insets.left);
    const narrow = bubblePlace({ x: 0, y: 100, width: 40, height: 44 }, { width: 300, height: 600 }, none, 1);
    expect(narrow.width).toBeLessThanOrEqual(300 - 16);
  });
});
