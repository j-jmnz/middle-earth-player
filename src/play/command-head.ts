// The room the command column's head has (docs/design-system-table.md, Command column): the quest meter stands above the dock in whatever the
// dock leaves free, never pushing it, and gives way by height: the full meter, then a compact one, then nothing (the dock's readout takes the
// numbers back). The meter is drawn only in the Quest phase; outside it the head is empty. The victory display is a pile on the table
// (layout.ts). Pure, so a test reads it. Lengths are Medium's points times the UI scale.

/** Medium's points: the compact meter from here (its one line and bar), the full meter's least height. */
export const HEAD_COMPACT = 44;
export const METER_FULL_LEAST = 100;
/** The dock's numbers row when none was measured (Medium's points): the readout's stats line, which the dock drops while the meter shows them. */
export const NUMBERS_ROW = 28;
/** The gap between the head and the dock's top. */
export const HEAD_GAP = 4;

export type HeadMode = "full" | "compact" | "hidden";

/** What the head draws in `room` points of free height: nothing outside the Quest phase (`meter` false) or under the compact meter's height. */
export function headPlan(room: number, scale = 1, meter = true): HeadMode {
  if (!meter || room < HEAD_COMPACT * scale) return "hidden";
  return room < METER_FULL_LEAST * scale ? "compact" : "full";
}

/** The free height above the dock: the column less its foot padding, the dock and a gap above the dock. */
export function headRoom(column: number, foot: number, dock: number, gap: number): number {
  return Math.max(0, column - foot - dock - gap);
}

/**
 * The dock's height as it stands with its numbers row. While the meter shows the numbers the dock has dropped that row (`dropped`) and
 * measures shorter by `numbers`; planning the head against this one height gives the same answer in both states, so the head's room never
 * depends on whether the meter is up (no flip between the two when the dock changes height under it, and no dependence on which was measured first).
 */
export function dockWithNumbers(measured: number, numbers: number, dropped: boolean): number {
  return dropped ? measured + numbers : measured;
}
