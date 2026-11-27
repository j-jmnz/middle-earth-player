// The room the command column's head has (docs/design-system-table.md, Command column): the quest meter stands above the dock in whatever the
// dock leaves free, never pushing it, and gives way by height: the full meter, then a compact one, then nothing (the dock's readout takes the
// numbers back). The last move's line (Last move) stands over the meter in the room the meter's mode does not need, whole, folded to one row, or not at all. The meter is drawn only in the Quest phase; outside it the head is empty. The victory display is a pile on the table
// (layout.ts). Pure, so a test reads it. Lengths are Medium's points times the UI scale.

/** Medium's points: the compact meter from here (its one line and bar), the full meter's least height. */
export const HEAD_COMPACT = 44;
export const METER_FULL_LEAST = 100;
/** The dock's numbers row when none was measured (Medium's points): the readout's stats line, which the dock drops while the meter shows them. */
export const NUMBERS_ROW = 28;
/** The gap between the head and the dock's top. */
export const HEAD_GAP = 4;
/** The tallest the full meter grows (Medium's points). */
export const METER_MOST = 230;

export type HeadMode = "full" | "compact" | "hidden";

/** Medium's points: the last move's line with its title and two rows of words, the line folded into one run of text on two rows, and the gap under it. */
export const MOVE_FULL = 72;
export const MOVE_ROW = 46;
export const MOVE_GAP = 6;

export type MoveMode = "full" | "row" | "hidden";
/** `inside`: the line stands in the head's own room, and the meter gives it that height; else it stands over the band a covered row holds. */
export type MovePlan = { mode: MoveMode; inside: boolean };

/**
 * How the last move's line stands beside a meter in `meter` mode. In the head's `room` the meter keeps the least height of its mode and the line
 * takes what is left: whole, or folded. With less left than the folded line needs, it still stands folded, over the band of the column's top that a
 * row holds, just above the meter or the dock, while the column has that height free above them (`bare`: the room with no row counted): what it says
 * is nowhere else on the table, and it goes with the player's next send. Under that, nothing.
 */
export function movePlan(room: number, bare: number, meter: HeadMode, scale = 1): MovePlan {
  const kept = meter === "full" ? METER_FULL_LEAST : meter === "compact" ? HEAD_COMPACT : 0;
  const left = room - kept * scale;
  const row = (MOVE_ROW + MOVE_GAP) * scale;
  if (left >= (MOVE_FULL + MOVE_GAP) * scale) return { mode: "full", inside: true };
  if (left >= row) return { mode: "row", inside: true };
  // A meter with less than that left takes all of the head's room.
  return bare - (meter === "hidden" ? 0 : room) >= row ? { mode: "row", inside: false } : { mode: "hidden", inside: false };
}

/** The room the line holds of the head, its gap included: none when it stands outside it. */
export function moveRoom(plan: MovePlan, scale = 1): number {
  if (plan.mode === "hidden" || !plan.inside) return 0;
  return ((plan.mode === "full" ? MOVE_FULL : MOVE_ROW) + MOVE_GAP) * scale;
}

/** What the head draws in `room` points of free height: nothing outside the Quest phase (`meter` false) or under the compact meter's height. */
export function headPlan(room: number, scale = 1, meter = true): HeadMode {
  if (!meter || room < HEAD_COMPACT * scale) return "hidden";
  return room < METER_FULL_LEAST * scale ? "compact" : "full";
}

/** The height the head takes of its `room`: the full meter up to its tallest and its top padding, the compact one all of it, nothing hidden. */
export function headHeight(mode: HeadMode, room: number, scale = 1): number {
  if (mode === "hidden") return 0;
  return mode === "full" ? Math.min(METER_MOST * scale, room) + 2 * scale : room;
}

/**
 * The free height above the dock: the column less its foot padding, the dock and a gap above the dock, and less `covered`, the part of the
 * column's top that a row running on under it holds (column-reach.ts): the head never stands over a row, so the row keeps its reach.
 */
export function headRoom(column: number, foot: number, dock: number, gap: number, covered: number): number {
  return Math.max(0, column - foot - dock - gap - covered);
}

/**
 * The dock's height as it stands with its numbers row. While the meter shows the numbers the dock has dropped that row (`dropped`) and
 * measures shorter by `numbers`; planning the head against this one height gives the same answer in both states, so the head's room never
 * depends on whether the meter is up (no flip between the two when the dock changes height under it, and no dependence on which was measured first).
 */
export function dockWithNumbers(measured: number, numbers: number, dropped: boolean): number {
  return dropped ? measured + numbers : measured;
}
