// The top bar's three zones (docs/design-system-table.md): the dials at the left, the phase rail centered on the screen (user request,
// 2026-10-29; it sat between the dials and the menu before, right of the middle), one menu button at the right. The rail never truncates
// its words: its floor is the widest it can be, counted from its own words (the widest phase) at their type size and its seven ticks.
// Pure, so a test reads it.
import { ROUND_PHASES, STEP_WORDS } from "../phases/rail.ts";
import { CHIP, COLS } from "../dream-chaser/island-table.ts";
import { touch, UI_SCALES } from "../../ui/ui-scale.ts";

// The bar's height: the 46 pt threat dial with 3 pt above and below; its pop (1.22) and the peek's bone ring may reach past the bar
// over the canvas's own top gutter. The rail's two lines (phase, ticks) fit in it.
export const TOP_BAR = 52;
// The room above the bar when the screen gives none (the table hides the status bar, so the top inset is 0 in landscape): the dial
// stands 3 pt under the bar's top edge and its pop (1.22) reaches 5 pt above the dial, off the screen and into a phone's rounded
// corner (user report, 2026-10-29).
export const BAR_TOP = 8;
export const MENU_BUTTON = 44;
// The bar's side padding (px-2 in table/top-bar.tsx).
export const BAR_PAD = 8;
const GAP = 8;
// Wide enough for the widest pill with both neighbor phases inline (RAIL_WIDE), with room over.
export const RAIL_MAX = 460;

// The rail is two lines (phase-rail.tsx): the phase, and the round's seven phases as ticks under it. Its floor comes from those words
// and marks, never from a guess about the bar:
// - the phase is Marcellus SC at 17 pt tracked 4 pt, its lower case drawn as small capitals. A letter of the phase words averages
//   up to 0.61 em ("Combat"; "Encounter" 0.54); 0.62 leaves a margin, plus the tracking;
// - Setup and the mulligan have no phase, so their step takes the phase's place, in the same type;
// - the ticks are seven 22 pt bars 5 pt apart;
// - the neighbor phases' names are label size (11 pt) in Barlow Semi Condensed, which averages under 0.48 em a letter; 0.55 leaves
//   a margin;
// - none counts shrinking (PhaseRail may shrink the phase to 85%), which is more margin, nor the glow;
// - the rail adds 4 pt each side, and the phase line keeps the room of the accent S that marks a stop ahead (STOP_MARK, counted
//   whether or not it shows) on both sides of the phase, so the phase stays on the rail's middle (user request, 2026-10-29).
const PHASE_SIZE = 17;
const PHASE_EM = 0.62;
const PHASE_TRACK = 4;
const LABEL_SIZE = 11;
const LABEL_EM = 0.55;
const RAIL_CHROME = 8;
/** The round's seven phases as ticks under the phase: each tick's width and the gap between two. */
export const TICK = 22;
export const TICK_GAP = 5;
const TICKS = 7 * TICK + 6 * TICK_GAP;
// The accent S that marks a stop ahead at the end of the phase's line.
export const STOP_MARK = 14;
/** The gap on each side of the phase between it and a neighbor phase's name, inline on the phase's line (rail wide). */
export const NEIGHBOR_GAP = 8;
// The widest neighbor phase's name at label size.
const PHASE_SLOT = Math.max(...ROUND_PHASES.map((name) => Math.ceil(name.length * LABEL_EM * LABEL_SIZE)));
// The headlines the rail shows: the seven phases, "Beginning" and "End" (rail.ts), and the two steps that have no phase.
const HEADLINES = [...ROUND_PHASES, "Beginning", "End", STEP_WORDS.afterOpening, STEP_WORDS.mulligan];

const phaseLine = (word: string) => Math.ceil(word.length * (PHASE_EM * PHASE_SIZE + PHASE_TRACK)) + 2 * STOP_MARK;

/** The width the rail needs to show a headline (a phase, or a step with no phase) whole over the ticks, plus its chrome. */
export function headlineWidth(word: string): number {
  return Math.max(phaseLine(word), TICKS) + RAIL_CHROME;
}

/** The rail's floor: the widest it can be, by its own words and ticks (the widest headline, the seven ticks). */
export const RAIL_FLOOR = Math.max(...HEADLINES.map(headlineWidth));

// The rail shows the neighbor phases, inline on the phase's line, when it can hold the widest phase with both of them.
export const RAIL_WIDE = Math.max(RAIL_FLOOR, Math.max(...HEADLINES.map(phaseLine)) + 2 * (PHASE_SLOT + NEIGHBOR_GAP) + RAIL_CHROME);

export type BarZones = {
  left: number;
  rail: number;
  right: number;
  // The dials are wider than the left zone: the left zone scrolls sideways, and no dial is cut.
  scroll: boolean;
};

/**
 * `bar` is the bar's width inside the side insets; `dials` the natural width of the dials (0 until measured); `center` where the
 * screen's middle falls on the bar, from its left edge (the bar's own middle when not given). The rail stands on the screen's middle
 * (user request, 2026-10-29, asked three times): as wide as it can be clear of the dials and the menu button, never under its floor.
 * When the dials need more room than that leaves them (two seats with Life and the Burden deck on a phone), the left zone scrolls
 * rather than the rail moving off the middle. Only when the menu side cannot hold half the floor does the rail leave the middle: the
 * room between the dials and the menu button is shared on both sides of it, and when even that is too little, the rail wins and the
 * left zone scrolls. At a UI `scale` the widths come in and go out in screen points, and the arithmetic is the Medium one in
 * logical points.
 */
export function barZones(bar: number, dials: number, scale = 1, center = bar / 2): BarZones {
  // The bar is worked out in logical points (the sizes above, at Medium) and drawn at `scale`; the menu button keeps its 44 pt floor.
  const menu = touch(scale, MENU_BUTTON) / scale;
  const room = bar / scale;
  const natural = dials / scale;
  const need = Math.ceil(natural) + GAP;
  const right = menu + GAP;
  const middle = center / scale;
  const menuHalf = room - right - middle;
  if (Math.min(menuHalf, middle) >= RAIL_FLOOR / 2) {
    const half = Math.min(RAIL_MAX / 2, menuHalf, Math.max(middle - need, RAIL_FLOOR / 2));
    const left = middle - half;
    return { left: left * scale, rail: 2 * half * scale, right: (room - left - 2 * half) * scale, scroll: need > left };
  }
  const free = room - natural - GAP - right;
  if (free >= RAIL_FLOOR) {
    const rail = Math.min(RAIL_MAX, free);
    const side = (free - rail) / 2;
    return { left: (natural + GAP + side) * scale, rail: rail * scale, right: (right + side) * scale, scroll: false };
  }
  const left = Math.max(0, Math.min(need, room - RAIL_FLOOR - right));
  return { left: left * scale, rail: Math.max(0, room - left - right) * scale, right: right * scale, scroll: Math.ceil(natural) > left };
}

// ---- The dials row: the Heading dial (phase 39b, docs/design-system-table.md, Top bar). All sizes are logical points at Medium, as the zones above. ----

/** A dial's disc, the padding either side of a dial, the gap between a disc and its label, and the gap between two dials (table-chrome.tsx, table/top-bar.tsx). */
export const DIAL_SIZE = 46;
export const DIAL_PAD = 4;
export const DIAL_LABEL_GAP = 6;
export const DIAL_GAP = 10;
/**
 * How far below a dial's row (the 46 pt disc, at least a 44 pt target) a change badge's foot sits so it ends inside the bar's foot, not past it:
 * the bar's room under the row, less 1 pt. The badge hangs from the row's bottom edge by this much (`bottom: -badgeFoot(s)`), over the disc's foot.
 */
export function badgeFoot(scale: number): number {
  const row = Math.max(touch(scale, 44), DIAL_SIZE * scale);
  return Math.max(0, (TOP_BAR * scale - row) / 2 - scale);
}
/**
 * The scale the seat dials are drawn at: Large's at most. The bar's words stop growing at Medium (the tab words do), and at Extra large
 * two seats' dials at the full size are wider than the bar leaves them on a 667 pt phone, so they scroll; at Large's size they fit.
 */
export function dialScale(scale: number): number {
  return Math.min(scale, UI_SCALES.large);
}
/** The fade at the right edge of a scrolling dials row, and the room the row keeps clear of it at its end. */
export const EDGE_FADE = 28;
// The seat dial: its disc, its padding and its "P1" label (two letters at label size).
const SEAT_LABEL = Math.ceil(2 * LABEL_EM * LABEL_SIZE);
/** A seat's dial in a two-handed game: padding, disc, gap, "P1". */
export const SEAT_DIAL = 2 * DIAL_PAD + DIAL_SIZE + DIAL_LABEL_GAP + SEAT_LABEL;
/** The Heading dial's label column at its widest: the widest of "Heading", "Toward Sun" and "Toward Storm" (the change badge, with its 6 pt of padding each side), so the dial's width does not move when the badge comes and goes. */
const HEADING_WORD_W = Math.ceil(Math.max(...["Heading", "Toward Sun", "Toward Storm"].map((word) => word.length)) * LABEL_EM * LABEL_SIZE);
export const HEADING_LABEL_W = HEADING_WORD_W + 12;
/** The badge under a compact dial's disc: the widest word with 4 pt of padding each side. */
export const HEADING_BADGE_W = HEADING_WORD_W + 8;

/** The Heading dial's width: with its label column, or compact (the disc alone, the badge laid under it) while the bar scrolls. */
export function headingDialWidth(compact: boolean): number {
  return 2 * DIAL_PAD + DIAL_SIZE + (compact ? 0 : DIAL_LABEL_GAP + HEADING_LABEL_W);
}

/** How far a compact dial's badge reaches past the dial on each side. */
export const HEADING_BADGE_OVER = Math.max(0, Math.ceil((HEADING_BADGE_W - headingDialWidth(true)) / 2));

/**
 * Whether the Heading dial drops its "Heading" word and lays its badge under the disc: when the dials, with the dial at its full width, would make the left zone scroll, or would take the rail
 * below the width that shows its neighbor phases (RAIL_WIDE) where the compact dial keeps it. `others` is the width of the dials row without the Heading dial and the gap before it, in screen
 * points; the answer does not depend on the dial's own current width, so it cannot flip back and forth.
 */
export function headingCompact(bar: number, others: number, scale = 1, center = bar / 2, narrow = false): boolean {
  const full = barZones(bar, others + (DIAL_GAP + headingDialWidth(false)) * scale, scale, center);
  if (full.scroll) return true;
  const small = barZones(bar, others + (DIAL_GAP + headingDialWidth(true)) * scale, scale, center);
  return !railWide(full.rail, narrow, scale) && railWide(small.rail, narrow, scale);
}

// ---- The Island Map chip (docs/design-system-table.md, The Island Map): in the dials row right after the seat dials. ----

/** The chip's width: its 5 × 3 grid with the padding, 4 pt each side of the target, and the word "Map" with its 6 pt gap (label size) unless it is compact. */
export const MAP_WORD_W = Math.ceil(3 * LABEL_EM * LABEL_SIZE);
export function mapChipWidth(compact: boolean): number {
  return 8 + COLS * CHIP.cell + (COLS - 1) * CHIP.gap + 2 * CHIP.pad + (compact ? 0 : DIAL_LABEL_GAP + MAP_WORD_W);
}

/**
 * Whether the chip drops its word "Map": when the dials, with the chip at its full width, would make the left zone scroll. `others` is the width of the dials row without the chip and the gap before it, in screen
 * points; the answer does not depend on the chip's own current width, so it cannot flip back and forth.
 */
export function chipCompact(bar: number, others: number, scale = 1, center = bar / 2): boolean {
  return barZones(bar, others + (DIAL_GAP + mapChipWidth(false)) * scale, scale, center).scroll;
}

/**
 * Where the dials row scrolls to (screen points) so the Heading dial and its badge stand whole inside the zone, clear of the fade at its right edge; 0 while the row does not scroll. `dial` is the
 * dial's left edge and width in the row, with the room its badge reaches into after it (a compact dial's, HEADING_BADGE_OVER); `content` is the row's width.
 */
export function headingOffset(zones: Pick<BarZones, "left" | "scroll">, dial: { x: number; w: number }, content: number, scale = 1): number {
  if (!zones.scroll) return 0;
  const fade = EDGE_FADE * scale;
  const wanted = dial.x + dial.w - (zones.left - fade);
  const end = Math.max(0, content + fade - zones.left);
  return Math.max(0, Math.min(wanted, end));
}

/** The pill shows the neighbor phases only when it has room, and the phone is 760 pt or wider inside the insets. */
export function railWide(rail: number, narrowScreen: boolean, scale = 1): boolean {
  return !narrowScreen && rail / scale >= RAIL_WIDE;
}
