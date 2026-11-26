import { describe, expect, it } from "vitest";

import { ROUND_PHASES, STEP_WORDS } from "../phases/rail.ts";
import { UI_SCALES } from "../../ui/ui-scale.ts";
import {
  badgeFoot,
  barZones,
  chipCompact,
  DIAL_GAP,
  DIAL_LABEL_GAP,
  DIAL_PAD,
  dialScale,
  DIAL_SIZE,
  CAPTION_LINE,
  CAPTION_OVER,
  CAPTION_WORDS,
  captionOf,
  dialZones,
  keepWidest,
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
  TOP_BAR,
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
  const SCALES = [UI_SCALES.small, UI_SCALES.medium, UI_SCALES.large, UI_SCALES.xlarge] as const;

  // The dials row of a two-handed game with the Heading dial, as the bar lays it out: the seat dials, a gap, the Heading dial (compact or not).
  function barOf(screen: (typeof SCREENS)[number], scale: number, seats: number) {
    const bar = screen.width - 2 * screen.inset - 2 * 8;
    const center = bar / 2;
    const before = seats * SEAT_DIAL * dialScale(scale) + seats * DIAL_GAP * scale;
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
  const SCALES = [UI_SCALES.small, UI_SCALES.medium, UI_SCALES.large, UI_SCALES.xlarge] as const;

  // The dials row of a two-handed game on the map: the seat dials, a gap, the chip right after them (with the word "Map", or without it where the full chip would make the row scroll).
  function barOf(screen: (typeof SCREENS)[number], scale: number, seats: number) {
    const bar = screen.width - 2 * screen.inset - 2 * 8;
    const center = bar / 2;
    const before = seats * SEAT_DIAL * dialScale(scale) + (seats - 1) * DIAL_GAP * scale;
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

describe("badgeFoot", () => {
  it("ends a change badge inside the bar's foot at every scale", () => {
    for (const scale of Object.values(UI_SCALES)) {
      const row = Math.max(44, DIAL_SIZE * scale);
      const rowTop = (TOP_BAR * scale - row) / 2;
      const badgeBottom = rowTop + row + badgeFoot(scale);
      expect(badgeBottom, `${scale}`).toBeLessThanOrEqual(TOP_BAR * scale);
      expect(badgeFoot(scale)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("the seat dials at Extra large", () => {
  it("draws the seat dials at Large's size at most", () => {
    expect(dialScale(UI_SCALES.small)).toBe(UI_SCALES.small);
    expect(dialScale(UI_SCALES.large)).toBe(UI_SCALES.large);
    expect(dialScale(UI_SCALES.xlarge)).toBe(UI_SCALES.large);
  });

  it("fits both dials of a two-handed game in the window at Extra large on 667 x 375, the rail on the middle, where the full size scrolled", () => {
    const scale = UI_SCALES.xlarge;
    const bar = 667 - 2 * 8;
    const full = barZones(bar, 2 * SEAT_DIAL * scale + DIAL_GAP * scale, scale, bar / 2);
    expect(full.scroll).toBe(true);
    const content = 2 * SEAT_DIAL * dialScale(scale) + DIAL_GAP * scale;
    const zones = barZones(bar, content, scale, bar / 2);
    expect(zones.scroll).toBe(false);
    expect(content).toBeLessThanOrEqual(zones.left);
    expect(Math.abs(zones.left + zones.rail / 2 - bar / 2)).toBeLessThanOrEqual(0.5);
  });
});

describe("the scenario dials' names (dialZones)", () => {
  // The Hunt for the Dreadnaught at stage 1B on 844 x 390: two seats, the Action dial and the Cap dial, each with its name beside the ring, then under it.
  const bar = 844 - 2 * 8;
  const word = DIAL_LABEL_GAP + 36;
  const seats = 2 * SEAT_DIAL + DIAL_GAP;
  const dial = 2 * DIAL_PAD + DIAL_SIZE;
  const scenario = 2 * dial + 2 * DIAL_GAP;
  const labelled = seats + scenario + 2 * word + DIAL_GAP;
  const bare = seats + scenario + DIAL_GAP;

  it("captions the names when the row with them beside the rings would scroll, so the last dial stands whole and the rail keeps its size", () => {
    const beside = barZones(bar, labelled, 1, bar / 2);
    expect(beside.scroll).toBe(true);
    const zones = dialZones(bar, bare, labelled, 1, bar / 2);
    expect(zones.captioned).toBe(true);
    expect(zones.scroll).toBe(false);
    expect(zones.rail).toBe(beside.rail);
    expect(zones.left).toBe(beside.left);
  });

  it("keeps the names beside the rings when the row with them fits, and answers the same whichever width the row has now", () => {
    expect(dialZones(bar, seats, seats, 1, bar / 2).captioned).toBe(false);
    expect(dialZones(bar, labelled, 0, 1, bar / 2).captioned).toBe(false);
    expect(dialZones(bar, labelled, labelled, 1, bar / 2).captioned).toBe(dialZones(bar, bare, labelled, 1, bar / 2).captioned);
  });

  it("still scrolls when the row is too wide even with the rings alone", () => {
    expect(dialZones(bar, 600, labelled, 1, bar / 2).scroll).toBe(true);
    expect(dialZones(bar, 600, labelled, 1, bar / 2).captioned).toBe(true);
  });

  // Two seats and two scenario dials (The Antlered Crown's stage and location, To Catch an Orc's Time and Out of play, The Three Trials' Guardians): the steps by width.
  const four = (names: number) => 2 * SEAT_DIAL + 2 * dial + 2 * names + 3 * DIAL_GAP;
  it("steps from names beside the rings, to captions, at the widths of a phone and a tablet", () => {
    const beside = four(DIAL_LABEL_GAP + 30);
    const rings = four(0);
    // 844 pt: the names beside the rings do not fit, the rings with their captions do and need no scroll.
    const phone = dialZones(844 - 2 * 8, rings, beside, 1, (844 - 2 * 8) / 2);
    expect(phone.captioned).toBe(true);
    expect(phone.scroll).toBe(false);
    // 1180 pt: the names fit beside the rings.
    const tablet = dialZones(1180 - 2 * 8, beside, beside, 1, (1180 - 2 * 8) / 2);
    expect(tablet.captioned).toBe(false);
    expect(tablet.scroll).toBe(false);
  });

  it("captions the seats too, so the five-dial Crown row (two seats, three scenario dials) fits the zone at 844 pt without scrolling", () => {
    const five = (seat: number, names: number) => 2 * seat + 3 * (dial + names) + 4 * DIAL_GAP;
    const beside = five(SEAT_DIAL, DIAL_LABEL_GAP + 36);
    const rings = five(dial, 0);
    expect(barZones(bar, beside, 1, bar / 2).scroll).toBe(true);
    const zones = dialZones(bar, rings, beside, 1, bar / 2);
    expect(zones.captioned).toBe(true);
    expect(zones.scroll).toBe(false);
    // With the seat labels left beside their rings the same row would still scroll.
    expect(dialZones(bar, 2 * SEAT_DIAL + 3 * dial + 4 * DIAL_GAP, beside, 1, bar / 2).scroll).toBe(true);
  });

  it("hangs the caption from the row's foot inside the bar, at every UI scale", () => {
    for (const scale of [1, UI_SCALES.large, UI_SCALES.xlarge]) {
      const row = Math.max(44 * scale, DIAL_SIZE * scale);
      // The caption's foot is the badge's: badgeFoot below the row, which ends inside the bar's foot.
      expect(row + badgeFoot(scale)).toBeLessThanOrEqual(row + (TOP_BAR * scale - row) / 2);
      expect(CAPTION_LINE * scale).toBeLessThan(row / 2);
    }
  });

  it("keeps the captions on the narrowest phone, where the rings alone may scroll", () => {
    const small = dialZones(667 - 2 * 8, four(0), four(DIAL_LABEL_GAP + 30), 1, (667 - 2 * 8) / 2);
    expect(small.captioned).toBe(true);
  });
});

describe("captionOf", () => {
  it("shows the label whole when it fits under the ring", () => {
    for (const label of ["Time", "Stage", "Village", "War-camp", "Key", "Boar"]) expect(captionOf(label)).toBe(label);
  });
  it("shows a dial's own short name first", () => {
    expect(captionOf("Out of play", "Aside")).toBe("Aside");
    expect(captionOf("Battlefield", "Battle")).toBe("Battle");
  });
  it("cuts a name from its detail when the label is too long", () => {
    expect(captionOf("Gollum \u00b7 HP")).toBe("Gollum");
    expect(captionOf("Watchers \u00b7 HP")).toBe("Watchers");
    expect(captionOf("Time \u00b7 staging 1")).toBe("Time");
  });
  it("leaves the shorts the dials carry within the caption's room, and the caption within the gap between two dials", () => {
    for (const short of ["Aside", "Battle", "Round", "Losing"]) expect(Math.ceil(short.length * 5.9)).toBeLessThanOrEqual(CAPTION_WORDS);
    expect(2 * CAPTION_OVER).toBeLessThanOrEqual(DIAL_GAP + 2 * DIAL_PAD + 2 * DIAL_PAD);
  });
});

describe("keepWidest", () => {
  const was = { key: "a|Time", width: 300 };
  it("keeps the wider width for the same key: the captioned row's narrower event is kept out", () => {
    expect(keepWidest(was, "a|Time", 200)).toBe(was);
    expect(keepWidest(was, "a|Time", 300)).toBe(was);
  });
  it("takes a wider width for the same key", () => {
    expect(keepWidest(was, "a|Time", 320)).toEqual({ key: "a|Time", width: 320 });
  });
  it("takes the new width for a new key, even a narrower one: a dial whose label got shorter under the same id is measured again", () => {
    expect(keepWidest(was, "a|Time left", 200)).toEqual({ key: "a|Time left", width: 200 });
  });
});
