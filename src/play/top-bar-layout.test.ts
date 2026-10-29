import { describe, expect, it } from "vitest";

import { ROUND_PHASES, STEP_WORDS } from "./rail.ts";
import { barZones, MENU_BUTTON, phaseWidth, pillWidth, RAIL_FLOOR, RAIL_MAX, RAIL_WIDE, railWide, stepWidth, TICK, TICK_GAP } from "./top-bar-layout.ts";

// Phase 19's floor, from the longest step name alone: the two-seat bar must not get worse than it was.
const PHASE_19_FLOOR = 232;

describe("top bar zones", () => {
  it("puts the rail as far from the last dial as from the menu button while the dials fit", () => {
    for (const [bar, dials] of [[800, 120], [800, 200], [620, 100], [1000, 0], [1200, 46]] as const) {
      const { left, rail, right, scroll } = barZones(bar, dials);
      expect(Math.abs(left - dials - (right - MENU_BUTTON))).toBeLessThanOrEqual(1);
      expect(scroll).toBe(false);
      expect(left + rail + right).toBeLessThanOrEqual(bar);
      expect(bar - left - rail - right).toBeLessThan(2);
    }
  });

  it("floors the rail at the widest pill, so no step name and no phase is cut", () => {
    const phases = [...ROUND_PHASES, "Beginning", "End"];
    for (const word of [...Object.values(STEP_WORDS), "Victory", "Defeat"]) {
      expect(RAIL_FLOOR).toBeGreaterThanOrEqual(stepWidth(word));
      // Every rail it can show: the phase over the ticks over "Round 99 · step".
      for (const phase of phases) expect(RAIL_FLOOR).toBeGreaterThanOrEqual(pillWidth("Round 99", phase, word));
    }
    // The floor holds the widest phase and the seven ticks under it.
    expect(RAIL_FLOOR).toBeGreaterThanOrEqual(phaseWidth("Encounter"));
    expect(RAIL_FLOOR).toBeGreaterThanOrEqual(7 * TICK + 6 * TICK_GAP);
    expect(RAIL_FLOOR).toBeLessThanOrEqual(PHASE_19_FLOOR);
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

  it("is no worse than phase 19 with two seats, Life and Burden (dials about 426 pt)", () => {
    // 844 x 390 and 667 x 375 with 47 pt insets: the bar inside the insets and the bar's own 16 pt padding.
    for (const width of [844, 667]) {
      const bar = width - 94 - 16;
      const now = barZones(bar, 426);
      const before = (() => {
        const right = MENU_BUTTON + 8;
        const left = Math.max(0, Math.min(426 + 8, bar - PHASE_19_FLOOR - right));
        return { left, rail: bar - left - right, scroll: 426 > left };
      })();
      expect(now.left).toBeGreaterThanOrEqual(before.left);
      expect(now.scroll && !before.scroll).toBe(false);
    }
  });

  it("shows the neighbor phases inline only on a wide screen with a rail that holds the widest pill with both", () => {
    expect(RAIL_WIDE).toBeGreaterThan(RAIL_FLOOR);
    expect(RAIL_WIDE).toBeLessThanOrEqual(RAIL_MAX);
    expect(railWide(RAIL_WIDE, false)).toBe(true);
    expect(railWide(RAIL_WIDE - 1, false)).toBe(false);
    expect(railWide(RAIL_MAX, false)).toBe(true);
    expect(railWide(400, true)).toBe(false);
    expect(railWide(200, false)).toBe(false);
  });
});
