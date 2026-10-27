// The top bar's three zones (docs/design-system.md, Table): the dials at the left, the phase rail centered on the bar, one
// menu button at the right. The rail is centered by giving both sides the same width, so it does not drift toward the
// space the dials leave over. The rail never truncates the pill: its floor is the widest pill, counted from the pill's own words
// ("Round 99 · ENCOUNTER", the longest step name) at its type sizes plus its chrome. Pure, so a test reads it.
import { ROUND_PHASES, STEP_WORDS } from "./rail.ts";

export const MENU_BUTTON = 44;
// The bar's side padding (px-2 in table-top-bar.tsx).
export const BAR_PAD = 8;
const GAP = 8;
// Wide enough for the widest pill and both neighbor phases (RAIL_WIDE), with room over.
export const RAIL_MAX = 460;

// The rail's pill is two lines (phase-rail.tsx): "Round 3 · QUEST" over the step, "Staging". Its floor comes from the pill's
// own words, never from a guess about the bar:
// - the phase is Cinzel Bold capitals at 14 pt with no added tracking. A capital averages up to 0.76 em in Cinzel Bold
//   ("ENCOUNTER" measures 0.759 em, "COMBAT" 0.762 in the web build, untracked); 0.78 leaves a margin;
// - "Round 99" and the step are label size (13 pt) in the system font, which averages under 0.55 em a character; 0.55 leaves a
//   margin;
// - neither counts shrinking (PhaseRail may shrink the phase to 85%), which is more margin, nor the glow;
// - the pill adds its 2 x 1 pt edge and 2 x 10 pt padding, and its top line keeps the room of the gold S that marks a stop ahead
//   when the neighbors are not shown (STOP_MARK, counted whether or not it shows).
const PHASE_SIZE = 14;
const CAP_EM = 0.78;
const LABEL_SIZE = 13;
const LABEL_EM = 0.55;
const PILL_CHROME = 22;
// The dot between "Round 3" and the phase, with its margins.
const DOT = 14;
// Beside the pill (rail wide): a chevron, the neighbor phase's name, the gold S that marks a stop ahead.
export const CHEVRON = 14;
export const SIDE_GAP = 8;
export const STOP_MARK = 14;
// Words the rail shows beside the engine's steps.
const EXTRA_STEPS = ["Victory", "Defeat"] as const;
/** The room the slot for a neighbor phase's name keeps: the widest of the seven at label size. */
export const PHASE_SLOT = Math.max(...ROUND_PHASES.map((name) => Math.ceil(name.length * LABEL_EM * LABEL_SIZE)));
// One side of the wide rail: the chevron, the name's slot and the room for the gold S, a gap between each.
export const SIDE_WIDTH = CHEVRON + PHASE_SLOT + STOP_MARK + 2 * SIDE_GAP;
// The rounds the pill can name: two digits.
const ROUND_WORDS = "Round 99";
// The phase words the pill shows over the step (rail.ts: the seven phases, "Beginning" and "End").
const PILL_PHASES = [...ROUND_PHASES, "Beginning", "End"];

const labelWidth = (word: string) => Math.ceil(word.length * LABEL_EM * LABEL_SIZE);
const capsWidth = (word: string) => Math.ceil(word.length * CAP_EM * PHASE_SIZE);

/** The width the pill needs for the round over the step: the wider of its two lines, plus its chrome. */
export function pillWidth(round: string, phase: string, step: string): number {
  const top = labelWidth(round) + (phase ? DOT + capsWidth(phase) : 0) + STOP_MARK;
  return Math.max(top, labelWidth(step)) + PILL_CHROME;
}

/** The width the rail needs to show a step name whole, under its widest top line. */
export function stepWidth(word: string): number {
  return pillWidth(ROUND_WORDS, "", word);
}

/** The width the rail needs to show a phase name whole, over its widest step. */
export function phaseWidth(phase: string): number {
  return pillWidth(ROUND_WORDS, phase, "");
}

/** The rail's floor: the widest pill, by the pill's own words (a step name, or "Round 99 · ENCOUNTER"). */
export const RAIL_FLOOR = Math.max(...[...Object.values(STEP_WORDS), ...EXTRA_STEPS].map(stepWidth), ...PILL_PHASES.map(phaseWidth));

// The rail shows the neighbor phases when it can hold the widest pill and both neighbors with their chevrons, and the gold S.
export const RAIL_WIDE = RAIL_FLOOR + 2 * (SIDE_WIDTH + SIDE_GAP);

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
 * If the dials still do not fit, the rail wins and the left zone scrolls.
 */
export function barZones(bar: number, dials: number): BarZones {
  const need = Math.max(MENU_BUTTON, Math.ceil(dials)) + GAP;
  const rail = Math.max(RAIL_FLOOR, Math.min(RAIL_MAX, bar - 2 * need));
  const even = Math.max(0, Math.floor((bar - rail) / 2));
  if (even >= need) return { left: even, rail, right: even, scroll: false };
  const right = MENU_BUTTON + GAP;
  const left = Math.max(0, Math.min(need, bar - RAIL_FLOOR - right));
  return { left, rail: Math.max(0, bar - left - right), right, scroll: Math.ceil(dials) > left };
}

/** The rail shows the phases beside the pill only when it has room, and the phone is 760 pt or wider inside the insets. */
export function railWide(rail: number, narrowScreen: boolean): boolean {
  return !narrowScreen && rail >= RAIL_WIDE;
}
