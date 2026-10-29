// The top bar's three zones (docs/design-system.md, Table): the dials at the left, the phase rail centered on the bar, one
// menu button at the right. The rail is centered by giving both sides the same width, so it does not drift toward the
// space the dials leave over. The rail never truncates its words: its floor is the widest it can be, counted from its own words
// (the phase, "Round 99 · Optional engagement") at their type sizes and its seven ticks. Pure, so a test reads it.
import { ROUND_PHASES, STEP_WORDS } from "./rail.ts";
import { touch } from "./ui-scale.ts";

// The bar's height: the 46 pt threat dial with 3 pt above and below; its pop (1.22) and the peek's bone ring may reach past the bar
// over the canvas's own top gutter. The rail's three lines (phase, ticks, round and step) fit in it.
export const TOP_BAR = 52;
export const MENU_BUTTON = 44;
// The bar's side padding (px-2 in table-top-bar.tsx).
export const BAR_PAD = 8;
const GAP = 8;
// Wide enough for the widest pill with both neighbor phases inline (RAIL_WIDE), with room over.
export const RAIL_MAX = 460;

// The rail is three lines (phase-rail.tsx): the phase, the round's seven phases as ticks under it, and "Round 3 · Staging" under
// those. Its floor comes from those words and marks, never from a guess about the bar:
// - the phase is Marcellus SC at 17 pt tracked 4 pt, its lower case drawn as small capitals. A letter of the phase words averages
//   up to 0.61 em ("Combat"; "Encounter" 0.54); 0.62 leaves a margin, plus the tracking;
// - the ticks are seven 22 pt bars 5 pt apart;
// - "Round 99 · " and the step are label size (11 pt) in Barlow Semi Condensed, which averages under 0.48 em a letter; 0.55 leaves
//   a margin;
// - neither counts shrinking (PhaseRail may shrink the phase to 85%), which is more margin, nor the glow;
// - the rail adds 4 pt each side, and the phase line keeps the room of the accent S that marks a stop ahead (STOP_MARK, counted
//   whether or not it shows).
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
// The dot between "Round 3" and the step, with its spaces.
const DOT = " · ";
// A chevron drawn as views (phase-rail.tsx), and the accent S that marks a stop ahead at the end of the phase's line.
export const CHEVRON = 14;
export const STOP_MARK = 14;
/** The gap on each side of the phase between it and a neighbor phase's name, inline on the phase's line (rail wide). */
export const NEIGHBOR_GAP = 8;
// Words the rail shows beside the engine's steps.
const EXTRA_STEPS = ["Victory", "Defeat"] as const;
// The widest neighbor phase's name at label size.
const PHASE_SLOT = Math.max(...ROUND_PHASES.map((name) => Math.ceil(name.length * LABEL_EM * LABEL_SIZE)));
// The rounds the rail can name: two digits.
const ROUND_WORDS = "Round 99";
// The phase words the rail shows (rail.ts: the seven phases, "Beginning" and "End").
const PILL_PHASES = [...ROUND_PHASES, "Beginning", "End"];

const labelWidth = (word: string) => Math.ceil(word.length * LABEL_EM * LABEL_SIZE);
const phaseLine = (word: string) => Math.ceil(word.length * (PHASE_EM * PHASE_SIZE + PHASE_TRACK)) + STOP_MARK;

/** The width the rail needs for the phase over the ticks over "Round 3 · step": the widest of its three lines, plus its chrome. */
export function pillWidth(round: string, phase: string, step: string): number {
  const foot = labelWidth(step ? `${round}${DOT}${step}` : round);
  return Math.max(phase ? phaseLine(phase) : 0, TICKS, foot) + RAIL_CHROME;
}

/** The width the rail needs to show a step name whole, under its widest top line. */
export function stepWidth(word: string): number {
  return pillWidth(ROUND_WORDS, "", word);
}

/** The width the rail needs to show a phase name whole, over its widest step. */
export function phaseWidth(phase: string): number {
  return pillWidth(ROUND_WORDS, phase, "");
}

/** The rail's floor: the widest it can be, by its own words and ticks (a step name, a phase, the seven ticks). */
export const RAIL_FLOOR = Math.max(...[...Object.values(STEP_WORDS), ...EXTRA_STEPS].map(stepWidth), ...PILL_PHASES.map(phaseWidth));

// The rail shows the neighbor phases, inline on the phase's line, when it can hold the widest phase with both of them.
export const RAIL_WIDE = Math.max(RAIL_FLOOR, Math.max(...PILL_PHASES.map(phaseLine)) + 2 * (PHASE_SLOT + NEIGHBOR_GAP) + RAIL_CHROME);

export type BarZones = {
  left: number;
  rail: number;
  right: number;
  // The dials are wider than the left zone: the left zone scrolls sideways, and no dial is cut.
  scroll: boolean;
};

/**
 * `bar` is the bar's width inside the side insets; `dials` the natural width of the dials (0 until measured). While the dials
 * fit, both sides are equal, so the rail is centered on the bar. When they are too wide for that (two seats with Life and the
 * Burden deck on a small phone), the left grows at the rail's expense, down to the rail's floor: the rail then sits off center.
 * If the dials still do not fit, the rail wins and the left zone scrolls. At a UI `scale` the widths come in and go out in screen
 * points, and the arithmetic is the Medium one in logical points.
 */
export function barZones(bar: number, dials: number, scale = 1): BarZones {
  // The bar is worked out in logical points (the sizes above, at Medium) and drawn at `scale`; the menu button keeps its 44 pt floor.
  const menu = touch(scale, MENU_BUTTON) / scale;
  const room = bar / scale;
  const natural = dials / scale;
  const need = Math.max(menu, Math.ceil(natural)) + GAP;
  const rail = Math.max(RAIL_FLOOR, Math.min(RAIL_MAX, room - 2 * need));
  const even = Math.max(0, Math.floor((room - rail) / 2));
  if (even >= need) return { left: even * scale, rail: rail * scale, right: even * scale, scroll: false };
  const right = menu + GAP;
  const left = Math.max(0, Math.min(need, room - RAIL_FLOOR - right));
  return { left: left * scale, rail: Math.max(0, room - left - right) * scale, right: right * scale, scroll: Math.ceil(natural) > left };
}

/** The pill shows the neighbor phases only when it has room, and the phone is 760 pt or wider inside the insets. */
export function railWide(rail: number, narrowScreen: boolean, scale = 1): boolean {
  return !narrowScreen && rail / scale >= RAIL_WIDE;
}
