import { describe, expect, it } from "vitest";

import { STEP_WORDS } from "./rail.ts";
import { barZones, MENU_BUTTON, RAIL_FLOOR, railWide, stepWidth } from "./top-bar-layout.ts";

describe("top bar zones", () => {
  it("gives both sides the same width while the dials fit, so the rail is centered on the bar", () => {
    for (const [bar, dials] of [[800, 120], [800, 200], [620, 100], [1000, 0]] as const) {
      const { left, rail, right, scroll } = barZones(bar, dials);
      expect(left).toBe(right);
      expect(scroll).toBe(false);
      expect(left + rail + right).toBeLessThanOrEqual(bar);
      expect(bar - left - rail - right).toBeLessThan(2);
    }
  });

  it("floors the rail at the widest step name, so no step is cut", () => {
    for (const word of [...Object.values(STEP_WORDS), "Victory", "Defeat"]) expect(RAIL_FLOOR).toBeGreaterThanOrEqual(stepWidth(word));
    expect(RAIL_FLOOR).toBe(stepWidth("Optional engagement"));
    for (const [bar, dials] of [[800, 0], [800, 460], [620, 460], [500, 900]] as const) expect(barZones(bar, dials).rail).toBeGreaterThanOrEqual(Math.min(RAIL_FLOOR, bar - MENU_BUTTON));
  });

  it("keeps the menu button's room and gives the left what the dials need, down to the rail's floor", () => {
    expect(barZones(800, 0).right).toBeGreaterThanOrEqual(MENU_BUTTON);
    const wide = barZones(800, 400);
    expect(wide.left).toBeGreaterThan(wide.right);
    expect(wide.left + wide.rail + wide.right).toBe(800);
    expect(wide.rail).toBeGreaterThanOrEqual(RAIL_FLOOR);
    expect(wide.scroll).toBe(false);
  });

  it("lets the rail win and the left scroll when the dials are wider than the bar less the floor and the menu", () => {
    const bar = 620;
    const dials = bar - RAIL_FLOOR - MENU_BUTTON + 40;
    const zones = barZones(bar, dials);
    expect(zones.rail).toBe(RAIL_FLOOR);
    expect(zones.scroll).toBe(true);
    expect(zones.left + zones.rail + zones.right).toBe(bar);
    expect(zones.left).toBeLessThan(dials);
  });

  it("shows the neighbors only on a wide screen with a wide rail", () => {
    expect(railWide(400, false)).toBe(true);
    expect(railWide(400, true)).toBe(false);
    expect(railWide(200, false)).toBe(false);
  });
});
