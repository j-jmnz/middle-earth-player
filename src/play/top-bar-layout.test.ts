import { describe, expect, it } from "vitest";

import { barZones, MENU_BUTTON, railWide } from "./top-bar-layout.ts";

describe("top bar zones", () => {
  it("gives both sides the same width while the dials fit, so the rail is centered on the bar", () => {
    for (const [bar, dials] of [[800, 120], [800, 300], [620, 200], [1000, 0]] as const) {
      const { left, rail, right } = barZones(bar, dials);
      expect(left).toBe(right);
      expect(left + rail + right).toBeLessThanOrEqual(bar);
      expect(bar - left - rail - right).toBeLessThan(2);
    }
  });

  it("keeps the menu button's room and gives the left what the dials need, down to the rail's floor", () => {
    expect(barZones(800, 0).right).toBeGreaterThanOrEqual(MENU_BUTTON);
    const wide = barZones(620, 400);
    expect(wide.left).toBeGreaterThan(wide.right);
    expect(wide.left + wide.rail + wide.right).toBe(620);
    expect(wide.rail).toBeGreaterThanOrEqual(120);
    expect(barZones(620, 560).rail).toBe(120);
  });

  it("shows the neighbors only on a wide screen with a wide rail", () => {
    expect(railWide(400, false)).toBe(true);
    expect(railWide(400, true)).toBe(false);
    expect(railWide(200, false)).toBe(false);
  });
});
