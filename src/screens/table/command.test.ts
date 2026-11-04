import { describe, expect, it } from "vitest";

import { commandWidth } from "./command.ts";

describe("command column width", () => {
  it("is 30% of the screen between 210 and 280 pt at Medium", () => {
    expect(commandWidth(844)).toBe(253);
    expect(commandWidth(600)).toBe(210);
    expect(commandWidth(1200)).toBe(280);
  });

  it("works in logical points and draws at the scale", () => {
    // 844 pt at 1.15 is 734 logical points: 30% is 220, drawn at 1.15.
    expect(commandWidth(844, 1.15)).toBe(Math.round(((844 / 1.15) * 0.3) * 1.15));
    expect(commandWidth(1200, 1.15)).toBe(Math.round(280 * 1.15));
    expect(commandWidth(500, 0.875)).toBe(Math.round(210 * 0.875));
    // The share of the screen is the same until a bound is met.
    expect(commandWidth(800, 0.875)).toBe(commandWidth(800, 1));
  });
});
