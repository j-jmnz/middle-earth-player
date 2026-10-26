// The top bar's three zones (docs/design-system.md, Table): the dials at the left, the phase rail centered on the bar, one
// menu button at the right. The rail is centered by giving both sides the same width, so it does not drift toward the
// space the dials leave over. Pure, so a test reads it.

export const MENU_BUTTON = 44;
const GAP = 8;
const RAIL_MAX = 420;
const RAIL_MIN = 120;
// Under this width the rail keeps the current step alone.
export const RAIL_WIDE = 320;

export type BarZones = { left: number; rail: number; right: number };

/**
 * `bar` is the bar's width inside the side insets; `dials` the natural width of the dials (0 until measured). While the dials
 * fit, both sides are equal, so the rail is centered on the bar. When they are too wide for that (two seats with Life and the
 * Burden deck on a small phone), the left grows at the rail's expense, down to RAIL_MIN: the rail then sits off center rather
 * than hide a dial.
 */
export function barZones(bar: number, dials: number): BarZones {
  const need = Math.max(MENU_BUTTON, Math.ceil(dials)) + GAP;
  const rail = Math.max(RAIL_MIN, Math.min(RAIL_MAX, bar - 2 * need));
  const even = Math.max(0, Math.floor((bar - rail) / 2));
  if (even >= need) return { left: even, rail, right: even };
  const right = MENU_BUTTON + GAP;
  const left = Math.max(0, Math.min(need, bar - RAIL_MIN - right));
  return { left, rail: Math.max(0, bar - left - right), right };
}
/** The rail shows its neighbors and the round only when it has room. */
export function railWide(rail: number, narrowScreen: boolean): boolean {
  return !narrowScreen && rail >= RAIL_WIDE;
}
