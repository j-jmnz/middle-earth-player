// The top bar's three zones (docs/design-system.md, Table): the dials at the left, the phase rail centered on the screen (user request,
// 2026-10-29; it sat between the dials and the menu before, right of the middle), one menu button at the right. The rail never truncates
// its words: its floor is the widest it can be, counted from its own words (the widest phase) at their type size and its seven ticks.
// Pure, so a test reads it.
import { ROUND_PHASES, STEP_WORDS } from "./rail.ts";
import { touch } from "./ui-scale.ts";

// The bar's height: the 46 pt threat dial with 3 pt above and below; its pop (1.22) and the peek's bone ring may reach past the bar
// over the canvas's own top gutter. The rail's two lines (phase, ticks) fit in it.
export const TOP_BAR = 52;
// The room above the bar when the screen gives none (the table hides the status bar, so the top inset is 0 in landscape): the dial
// stands 3 pt under the bar's top edge and its pop (1.22) reaches 5 pt above the dial, off the screen and into a phone's rounded
// corner (user report, 2026-10-29).
export const BAR_TOP = 8;
export const MENU_BUTTON = 44;
// The bar's side padding (px-2 in table-top-bar.tsx).
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

/** The pill shows the neighbor phases only when it has room, and the phone is 760 pt or wider inside the insets. */
export function railWide(rail: number, narrowScreen: boolean, scale = 1): boolean {
  return !narrowScreen && rail / scale >= RAIL_WIDE;
}
