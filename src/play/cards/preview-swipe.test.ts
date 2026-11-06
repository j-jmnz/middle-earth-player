import { describe, expect, it } from "vitest";

import { clampStep, swipeStep } from "./preview-swipe.ts";

describe("swipeStep", () => {
  it("steps to the next card on a swipe to the left and back on a swipe to the right", () => {
    expect(swipeStep(0, 3, -60, 0, 1)).toBe(1);
    expect(swipeStep(2, 3, 60, 0, 1)).toBe(1);
  });

  it("counts a flick that falls short of the distance", () => {
    expect(swipeStep(0, 3, -10, -900, 1)).toBe(1);
  });

  it("stays put when the swipe falls short", () => {
    expect(swipeStep(1, 3, -20, -100, 1)).toBe(1);
    // At a larger UI scale the distance grows with it.
    expect(swipeStep(1, 3, -60, 0, 1.5)).toBe(1);
  });

  it("never steps past either end, and does nothing with one card", () => {
    expect(swipeStep(2, 3, -80, 0, 1)).toBe(2);
    expect(swipeStep(0, 3, 80, 0, 1)).toBe(0);
    expect(swipeStep(0, 1, -80, 0, 1)).toBe(0);
  });
});

describe("clampStep", () => {
  it("moves by one and stops at either end", () => {
    expect(clampStep(1, 3, 1)).toBe(2);
    expect(clampStep(2, 3, 1)).toBe(2);
    expect(clampStep(0, 3, -1)).toBe(0);
  });
});
