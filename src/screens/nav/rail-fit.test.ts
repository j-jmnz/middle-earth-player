// The rail in a short window (rail-fit.ts): every tab and Settings fit the height, and a target stays 44 pt.
import { describe, expect, it } from "vitest";

import { compactItemHeight } from "./rail-fit.ts";

describe("compactItemHeight", () => {
  it("fits six items in the smallest desktop window, 390 high, at 56 pt or more", () => {
    const each = compactItemHeight(390, 1, 6);
    expect(each).toBeGreaterThanOrEqual(44);
    expect(each * 6 + 16).toBeLessThanOrEqual(390);
  });

  it("never takes more than the full rail's 72 pt times the scale, nor less than 44", () => {
    expect(compactItemHeight(479, 1, 6)).toBeLessThanOrEqual(72);
    expect(compactItemHeight(1000, 1.15, 6)).toBe(72 * 1.15);
    expect(compactItemHeight(200, 1, 6)).toBe(44);
  });
});
