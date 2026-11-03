// The room the command column's head has (docs/design-system-table.md, Command column): the victory display and the quest meter stand above the
// dock in whatever the dock leaves free, never pushing it, and give way by height: the full meter, then a compact one, then nothing (the
// dock's readout takes the numbers back). The meter is drawn only in the Quest phase; without it the victory strip alone takes the room. Pure, so a test reads it. Lengths are Medium's points times the UI scale.

/** Medium's points: the full head from here, the compact head from here, a victory header line, a victory name row, and the full meter's least height. */
export const HEAD_FULL = 150;
export const HEAD_COMPACT = 70;
export const VICTORY_HEADER = 20;
export const VICTORY_ROW = 22;
export const METER_FULL_LEAST = 100;
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

export function headPlan(room: number, victoryCount: number, scale = 1, meter = true): HeadPlan {
  if (room < (meter ? HEAD_COMPACT : STRIP_LEAST) * scale) return { mode: "hidden", rows: 0, more: 0, moreLine: false, strip: 0 };
  const header = VICTORY_HEADER * scale;
  const row = VICTORY_ROW * scale;
  if (room < (meter ? HEAD_FULL * scale : header + row)) {
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
