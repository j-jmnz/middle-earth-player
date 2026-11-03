// The room the command column's head has (docs/design-system-table.md, Command column): the victory display and the quest meter stand above the
// dock in whatever the dock leaves free, never pushing it, and give way by height: the full meter, then a compact one, then nothing (the
// dock's readout takes the numbers back). The meter is drawn only in the Quest phase; without it the victory strip alone takes the room. Pure, so a test reads it. Lengths are Medium's points times the UI scale.
import { touch } from "./ui-scale.ts";

/** Medium's points: the compact head from here, a victory header line, a victory name row (a 44 pt target at every scale), and the full meter's least height. */
export const HEAD_COMPACT = 70;
export const VICTORY_HEADER = 20;
export const VICTORY_ROW = 44;
export const METER_FULL_LEAST = 100;
/** The least gap between the strip and the meter (Medium's points). */
export const STRIP_GAP = 6;
/** The full head from here, in Medium's points: the header, one name row, the gap and the meter's least height. */
export const HEAD_FULL = VICTORY_HEADER + VICTORY_ROW + STRIP_GAP + METER_FULL_LEAST;
/** The dock's numbers row when none was measured (Medium's points): the readout's stats line, which the dock drops while the meter shows them. */
export const NUMBERS_ROW = 28;
/** The gap between the head and the dock's top. */
export const HEAD_GAP = 4;
/** The most name rows the victory strip takes beside the meter, so the meter keeps its height. */
const MAX_ROWS = 3;
/** The most name rows it takes alone, and the least room that draws it (a header line and a little air; Medium's points). */
const MAX_ROWS_ALONE = 5;
export const STRIP_LEAST = 30;

export type HeadMode = "full" | "compact" | "hidden";

/**
 * What the head draws in `room` points of free height. `rows` is how many lines the victory names get below its header and `more` how many
 * cards wait past them ("+n more": its own line when `moreLine`, else at the end of the one name row). `strip` is the strip's height.
 * With `meter` false (outside the Quest phase) only the strip is drawn: it is hidden under STRIP_LEAST, header-only ("compact") until a name row
 * fits, then "full" with up to MAX_ROWS_ALONE rows.
 */
export type HeadPlan = { mode: HeadMode; rows: number; more: number; moreLine: boolean; strip: number };

/** A victory name row's height at `scale`: scaled, never under a 44 pt target. */
export function victoryRow(scale: number): number {
  return touch(scale, VICTORY_ROW);
}

/** The room the full head needs at `scale`. */
export function headFull(scale: number): number {
  return (VICTORY_HEADER + STRIP_GAP + METER_FULL_LEAST) * scale + victoryRow(scale);
}

export function headPlan(room: number, victoryCount: number, scale = 1, meter = true): HeadPlan {
  if (room < (meter ? HEAD_COMPACT : STRIP_LEAST) * scale) return { mode: "hidden", rows: 0, more: 0, moreLine: false, strip: 0 };
  const header = VICTORY_HEADER * scale;
  const row = victoryRow(scale);
  if (room < (meter ? headFull(scale) : header + row)) {
    // One line: the header, and the newest name beside it when there is one.
    return { mode: "compact", rows: 0, more: 0, moreLine: false, strip: header };
  }
  if (victoryCount === 0) return { mode: "full", rows: 0, more: 0, moreLine: false, strip: header };
  const left = room - (meter ? METER_FULL_LEAST * scale : 0) - header;
  const fit = Math.max(1, Math.min(meter ? MAX_ROWS : MAX_ROWS_ALONE, Math.floor(left / row)));
  if (victoryCount <= fit) return { mode: "full", rows: victoryCount, more: 0, moreLine: false, strip: header + victoryCount * row };
  // Past the room: the newest names, then "+n more" on the last line (its own when two or more lines fit).
  const rows = Math.max(1, fit - 1);
  return { mode: "full", rows, more: victoryCount - rows, moreLine: fit >= 2, strip: header + (fit >= 2 ? fit : 1) * row };
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
