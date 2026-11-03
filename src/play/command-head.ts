// The room the command column's head has (docs/design-system-table.md, Command column): the victory display and the quest meter stand above the
// dock in whatever the dock leaves free, never pushing it, and give way by height: the full meter, then a compact one, then nothing (the
// dock's readout takes the numbers back). Pure, so a test reads it. Lengths are Medium's points times the UI scale.

/** Medium's points: the full head from here, the compact head from here, a victory header line, a victory name row, and the full meter's least height. */
export const HEAD_FULL = 150;
export const HEAD_COMPACT = 70;
export const VICTORY_HEADER = 20;
export const VICTORY_ROW = 22;
export const METER_FULL_LEAST = 100;
/** The gap between the head and the dock's top. */
export const HEAD_GAP = 4;
/** The most name rows the victory strip takes, so the meter keeps its height. */
const MAX_ROWS = 3;

export type HeadMode = "full" | "compact" | "hidden";

/**
 * What the head draws in `room` points of free height. `rows` is how many lines the victory names get below its header and `more` how many
 * cards wait past them ("+n more": its own line when `moreLine`, else at the end of the one name row). `strip` is the strip's height.
 */
export type HeadPlan = { mode: HeadMode; rows: number; more: number; moreLine: boolean; strip: number };

export function headPlan(room: number, victoryCount: number, scale = 1): HeadPlan {
  if (room < HEAD_COMPACT * scale) return { mode: "hidden", rows: 0, more: 0, moreLine: false, strip: 0 };
  const header = VICTORY_HEADER * scale;
  if (room < HEAD_FULL * scale) {
    // One line: the header, and the newest name beside it when there is one.
    return { mode: "compact", rows: 0, more: 0, moreLine: false, strip: header };
  }
  if (victoryCount === 0) return { mode: "full", rows: 0, more: 0, moreLine: false, strip: header };
  const row = VICTORY_ROW * scale;
  const fit = Math.max(1, Math.min(MAX_ROWS, Math.floor((room - METER_FULL_LEAST * scale - header) / row)));
  if (victoryCount <= fit) return { mode: "full", rows: victoryCount, more: 0, moreLine: false, strip: header + victoryCount * row };
  // Past the room: the newest names, then "+n more" on the last line (its own when two or more lines fit).
  const rows = Math.max(1, fit - 1);
  return { mode: "full", rows, more: victoryCount - rows, moreLine: fit >= 2, strip: header + (fit >= 2 ? fit : 1) * row };
}

/** The free height above the dock: the column less its foot padding, the dock and a gap above the dock. */
export function headRoom(column: number, foot: number, dock: number, gap: number): number {
  return Math.max(0, column - foot - dock - gap);
}
