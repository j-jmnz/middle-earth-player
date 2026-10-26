// The top bar's three zones (docs/design-system.md, Table): the dials at the left, the phase rail centered on the bar, one
// menu button at the right. The rail is centered by giving both sides the same width, so it does not drift toward the
// space the dials leave over. The rail never truncates the current step: its floor is the longest step name at the rail's
// type size plus the pill's chrome. Pure, so a test reads it.
import { STEP_WORDS } from "./rail.ts";

export const MENU_BUTTON = 44;
const GAP = 8;
const RAIL_MAX = 420;
// Under this width the rail keeps the current step alone.
const RAIL_WIDE = 320;

// The current step is Marcellus caps at the body size (17 pt). A capital averages 0.625 em in Marcellus ("Optional engagement"
// measures 202 pt on the web build); 0.65 leaves a margin, and the floor counts no shrinking (PhaseRail may shrink to 85% on a
// phone, which is more margin). The glow is not counted. The pill adds its 2 x 1 pt edge and 2 x 10 pt padding.
const STEP_SIZE = 17;
const CAP_EM = 0.65;
const PILL_CHROME = 22;
// Words the rail shows beside the engine's steps.
const EXTRA_STEPS = ["Victory", "Defeat"] as const;

/** The width the rail needs to show a step name whole. */
export function stepWidth(word: string): number {
  return Math.ceil(word.length * CAP_EM * STEP_SIZE) + PILL_CHROME;
}

/** The rail's floor: the widest step name the rail can show. */
export const RAIL_FLOOR = Math.max(...[...Object.values(STEP_WORDS), ...EXTRA_STEPS].map(stepWidth));

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

/** The rail shows its neighbors and the round only when it has room. */
export function railWide(rail: number, narrowScreen: boolean): boolean {
  return !narrowScreen && rail >= RAIL_WIDE;
}
