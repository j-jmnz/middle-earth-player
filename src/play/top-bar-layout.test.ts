import { describe, expect, it } from "vitest";

import { ROUND_PHASES, STEP_WORDS } from "./rail.ts";
import { barZones, headlineWidth, MENU_BUTTON, RAIL_FLOOR, RAIL_MAX, RAIL_WIDE, railWide, TICK, TICK_GAP } from "./top-bar-layout.ts";

// The rail names a phase over its ticks and nothing longer, so it never needs more than this (the old three-line rail needed 232).
const RAIL_CEILING = 232;

describe("top bar zones", () => {
  it("centers the rail on the screen, clear of the dials and the menu button, while they leave it room", () => {
    // `center`: the screen's middle on the bar, off the bar's own middle by a left inset larger than the right.
    for (const [bar, dials, center] of [[800, 120, 400], [800, 200, 380], [620, 100, 310], [1000, 0, 500], [1200, 46, 576]] as const) {
      const { left, rail, right, scroll } = barZones(bar, dials, 1, center);
      expect(Math.abs(left + rail / 2 - center)).toBeLessThanOrEqual(0.5);
      expect(left).toBeGreaterThanOrEqual(dials);
      expect(right).toBeGreaterThanOrEqual(MENU_BUTTON);
      expect(rail).toBeGreaterThanOrEqual(RAIL_FLOOR);
      expect(rail).toBeLessThanOrEqual(RAIL_MAX);
      expect(scroll).toBe(false);
      expect(Math.abs(bar - left - rail - right)).toBeLessThan(1);
    }
  });

  it("keeps the rail on the screen's middle at its floor and scrolls the dials when they leave it less room", () => {
    for (const [bar, dials] of [[620, 260], [700, 330], [734, 426]] as const) {
      const { left, rail, right, scroll } = barZones(bar, dials, 1, bar / 2);
      expect(Math.abs(left + rail / 2 - bar / 2)).toBeLessThanOrEqual(0.5);
      expect(rail).toBe(RAIL_FLOOR);
      expect(scroll).toBe(true);
      expect(Math.abs(bar - left - rail - right)).toBeLessThan(1);
    }
  });

  it("leaves the middle only when the menu side cannot hold half the rail's floor", () => {
    const bar = 320;
    const zones = barZones(bar, 0, 1, bar - MENU_BUTTON - 20);
    expect(zones.left + zones.rail / 2).toBeLessThan(bar - MENU_BUTTON - 20);
    expect(zones.rail).toBeGreaterThanOrEqual(Math.min(RAIL_FLOOR, bar - MENU_BUTTON));
  });

  it("floors the rail at the widest headline, so no phase and no step that stands in for one is cut", () => {
    // The phase over the ticks, and Setup and the mulligan, whose step takes the phase's place.
    for (const word of [...ROUND_PHASES, "Beginning", "End", STEP_WORDS.afterOpening, STEP_WORDS.mulligan]) expect(RAIL_FLOOR, word).toBeGreaterThanOrEqual(headlineWidth(word));
    // The floor holds the widest phase and the seven ticks under it.
    expect(RAIL_FLOOR).toBeGreaterThanOrEqual(headlineWidth("Encounter"));
    expect(RAIL_FLOOR).toBeGreaterThanOrEqual(7 * TICK + 6 * TICK_GAP);
    expect(RAIL_FLOOR).toBeLessThanOrEqual(RAIL_CEILING);
    for (const [bar, dials] of [[800, 0], [800, 460], [620, 460], [500, 900]] as const) expect(barZones(bar, dials).rail).toBeGreaterThanOrEqual(Math.min(RAIL_FLOOR, bar - MENU_BUTTON));
  });

  it("keeps the menu button's room, and the rail on the middle when the dials are wide", () => {
    expect(barZones(800, 0).right).toBeGreaterThanOrEqual(MENU_BUTTON);
    const wide = barZones(800, 400);
    expect(wide.left + wide.rail / 2).toBe(400);
    expect(wide.left + wide.rail + wide.right).toBe(800);
    expect(wide.rail).toBe(RAIL_FLOOR);
    expect(wide.scroll).toBe(true);
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
