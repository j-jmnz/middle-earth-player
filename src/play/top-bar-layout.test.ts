import { describe, expect, it } from "vitest";

import { ROUND_PHASES, STEP_WORDS } from "./rail.ts";
import { UI_SCALES } from "./ui-scale.ts";
import {
  barZones,
  chipCompact,
  DIAL_GAP,
  DIAL_LABEL_GAP,
  DIAL_PAD,
  DIAL_SIZE,
  EDGE_FADE,
  HEADING_BADGE_OVER,
  HEADING_BADGE_W,
  HEADING_LABEL_W,
  headingCompact,
  headingDialWidth,
  headingOffset,
  headlineWidth,
  MAP_WORD_W,
  mapChipWidth,
  MENU_BUTTON,
  RAIL_FLOOR,
  RAIL_MAX,
  RAIL_WIDE,
  railWide,
  SEAT_DIAL,
  TICK,
  TICK_GAP,
} from "./top-bar-layout.ts";

// The rail names a phase over its ticks and nothing longer, so it never needs more than this.
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

// Rules: dcce.heading (data/rules/entries.json). The Heading dial joins the dials at the left, after the seat dials (docs/design-system-table.md, Top bar). The bar measures its dials, so its zones
// take their natural width: a dial is its 46 pt frame with 4 pt of padding each side, and the Heading dial a label column as wide as its widest word. While the bar scrolls the dial drops its
// word and lays its badge under the disc, and the row scrolls to it.
describe("the Heading dial in the top bar (phase 39b)", () => {
  const SCREENS = [{ width: 667, inset: 0 }, { width: 844, inset: 47 }, { width: 1024, inset: 0 }] as const;
  const SCALES = [UI_SCALES.small, UI_SCALES.medium, UI_SCALES.large] as const;

  // The dials row of a two-handed game with the Heading dial, as the bar lays it out: the seat dials, a gap, the Heading dial (compact or not).
  function barOf(screen: (typeof SCREENS)[number], scale: number, seats: number) {
    const bar = screen.width - 2 * screen.inset - 2 * 8;
    const center = bar / 2;
    const before = (seats * SEAT_DIAL + seats * DIAL_GAP) * scale;
    const compact = headingCompact(bar, before - DIAL_GAP * scale, scale, center);
    const w = headingDialWidth(compact) * scale;
    // The dial's place in the row includes the room its compact badge reaches into after it.
    const placed = w + (compact ? HEADING_BADGE_OVER * scale : 0);
    const content = before + placed;
    const zones = barZones(bar, content, scale, center);
    const offset = headingOffset(zones, { x: before, w: placed }, content, scale);
    return { bar, center, compact, zones, content, x: before, w, offset };
  }

  it("keeps the label column as wide as the widest of Heading, Toward Sun and Toward Storm, so the width does not move with the badge", () => {
    for (const word of ["Heading", "Toward Sun", "Toward Storm"]) expect(HEADING_LABEL_W, word).toBeGreaterThanOrEqual(Math.ceil(word.length * 0.55 * 11));
    expect(headingDialWidth(false)).toBe(2 * DIAL_PAD + DIAL_SIZE + DIAL_LABEL_GAP + HEADING_LABEL_W);
    expect(headingDialWidth(true)).toBe(2 * DIAL_PAD + DIAL_SIZE);
    expect(HEADING_BADGE_W).toBeGreaterThanOrEqual(Math.ceil("Toward Storm".length * 0.55 * 11));
    // The badge reaches no further past the dial than the gap and padding before the next dial's disc.
    expect(HEADING_BADGE_OVER).toBeLessThanOrEqual(DIAL_GAP + DIAL_PAD);
  });

  it("keeps the rail on the screen's middle at 667 x 375 and 844 x 390 with two seats and the Heading dial, at every scale", () => {
    for (const screen of SCREENS) {
      for (const scale of SCALES) {
        const { zones, center, bar } = barOf(screen, scale, 2);
        const at = `${screen.width} at ${scale}`;
        expect(Math.abs(zones.left + zones.rail / 2 - center), at).toBeLessThanOrEqual(0.5);
        expect(zones.rail, at).toBeGreaterThanOrEqual(RAIL_FLOOR * scale - 0.5);
        expect(zones.right, at).toBeGreaterThanOrEqual(MENU_BUTTON);
        expect(Math.abs(bar - zones.left - zones.rail - zones.right), at).toBeLessThan(1);
      }
    }
  });

  it("shows the Heading dial's disc and its badge whole inside the dials zone, clear of the fade, at Small, Medium and Large", () => {
    for (const screen of SCREENS) {
      for (const scale of SCALES) {
        const { zones, compact, x, w, offset, content } = barOf(screen, scale, 2);
        const at = `${screen.width} at ${scale}`;
        const fade = zones.scroll ? EDGE_FADE * scale : 0;
        const window = { from: offset, to: offset + zones.left - fade };
        const disc = { from: x + DIAL_PAD * scale, to: x + (DIAL_PAD + DIAL_SIZE) * scale };
        // The badge: under the disc when compact (centred, reaching past the dial each side), in the label column otherwise.
        const badge = compact ? { from: x + w / 2 - (HEADING_BADGE_W / 2) * scale, to: x + w / 2 + (HEADING_BADGE_W / 2) * scale } : { from: x + (2 * DIAL_PAD + DIAL_SIZE + DIAL_LABEL_GAP) * scale, to: x + w };
        for (const part of [disc, badge]) {
          expect(part.from, at).toBeGreaterThanOrEqual(window.from - 0.5);
          expect(part.to, at).toBeLessThanOrEqual(window.to + 0.5);
        }
        // The row never scrolls past its end, and not at all while it fits.
        expect(offset, at).toBeLessThanOrEqual(Math.max(0, content + fade - zones.left) + 0.5);
        if (!zones.scroll) expect(offset, at).toBe(0);
      }
    }
  });

  it("drops the word and lays the badge under the disc where the full dial would make the bar scroll, and keeps the word where it fits", () => {
    expect(barOf(SCREENS[0], UI_SCALES.medium, 2).compact).toBe(true);
    expect(barOf(SCREENS[0], UI_SCALES.large, 2).compact).toBe(true);
    // A tablet holds a solo player's seat and the full dial; a two-seat tablet may or may not, but its rail never narrows with the badge.
    expect(barOf(SCREENS[2], UI_SCALES.medium, 1).compact).toBe(false);
  });

  it("keeps a tablet's rail wide enough for the neighbor phases whether or not the badge shows", () => {
    // 1024 x 768 at Large with two seats: the badge cannot widen the dials, so the rail stays where it was (it had dropped below RAIL_WIDE with a word-wide badge).
    const { zones } = barOf(SCREENS[2], UI_SCALES.large, 2);
    expect(railWide(zones.rail, false, UI_SCALES.large)).toBe(true);
  });

  it("scrolls the dials at Large on a 667 pt phone and cuts none of the Heading dial, the rail still on the middle", () => {
    const large = barOf(SCREENS[0], UI_SCALES.large, 2);
    expect(large.zones.scroll).toBe(true);
    expect(large.offset).toBeGreaterThan(0);
    expect(Math.abs(large.zones.left + large.zones.rail / 2 - large.center)).toBeLessThanOrEqual(0.5);
  });
});

describe("the Island Map chip in the top bar", () => {
  const SCREENS = [{ width: 667, inset: 0 }, { width: 844, inset: 47 }, { width: 1024, inset: 0 }] as const;
  const SCALES = [UI_SCALES.small, UI_SCALES.medium, UI_SCALES.large] as const;

  // The dials row of a two-handed game on the map: the seat dials, a gap, the chip right after them (with the word "Map", or without it where the full chip would make the row scroll).
  function barOf(screen: (typeof SCREENS)[number], scale: number, seats: number) {
    const bar = screen.width - 2 * screen.inset - 2 * 8;
    const center = bar / 2;
    const before = seats * SEAT_DIAL * scale + (seats - 1) * DIAL_GAP * scale;
    const compact = chipCompact(bar, before, scale, center);
    const content = before + (DIAL_GAP + mapChipWidth(compact)) * scale;
    return { bar, center, compact, content, zones: barZones(bar, content, scale, center), full: barZones(bar, before + (DIAL_GAP + mapChipWidth(false)) * scale, scale, center) };
  }

  it("is wider with the word Map than without it, by the word and its gap", () => {
    expect(mapChipWidth(false) - mapChipWidth(true)).toBe(DIAL_LABEL_GAP + MAP_WORD_W);
    expect(MAP_WORD_W).toBeGreaterThanOrEqual(Math.ceil("Map".length * 0.55 * 11));
  });

  it("counts the chip in the zones for two seats at Small, Medium and Large: the rail stays on the screen's middle at its floor, and the word goes only where the row would scroll with it", () => {
    for (const screen of SCREENS) {
      for (const scale of SCALES) {
        const { zones, full, compact, center, bar } = barOf(screen, scale, 2);
        const at = `${screen.width} at ${scale}`;
        expect(Math.abs(zones.left + zones.rail / 2 - center), at).toBeLessThanOrEqual(0.5);
        expect(zones.rail, at).toBeGreaterThanOrEqual(RAIL_FLOOR * scale - 0.5);
        expect(zones.right, at).toBeGreaterThanOrEqual(MENU_BUTTON);
        expect(Math.abs(bar - zones.left - zones.rail - zones.right), at).toBeLessThan(1);
        // The word is dropped exactly when the full chip would scroll the row; a chip that fits keeps it, and a compact chip is never wider than the room.
        expect(compact, at).toBe(full.scroll);
        if (!compact) expect(zones.scroll, at).toBe(false);
      }
    }
  });

  it("drops the word on a 667 pt phone with two seats at Medium and Large, and keeps it on a tablet", () => {
    expect(barOf(SCREENS[0], UI_SCALES.medium, 2).compact).toBe(true);
    expect(barOf(SCREENS[0], UI_SCALES.large, 2).compact).toBe(true);
    expect(barOf(SCREENS[2], UI_SCALES.medium, 2).compact).toBe(false);
  });
});
