// How many of the table's top rows lie wholly above the command column's dock and head (docs/design-system-table.md, Command column): the
// column lies over the canvas's right edge, and a crowded row it does not reach down to runs on under its empty top (row-reach.ts). The
// count is what the layout reads, so the dock growing or shrinking by a few points lays nothing out again: only crossing a row's foot does.
// Pure, so a test reads it. Lengths are in points, the canvas's and the column's tops level unless `top` says otherwise.
import type { TableLayout } from "./layout.ts";

export type Reach = 0 | 1 | 2;

/** Each top row's foot on the canvas: staging's (its deepest peek) and the engagement area's. */
export type RowFeet = { staging: number; engaged: number };

/** The feet of the staging and engagement rows of a layout, peeks included. */
export function rowFeet(layout: Pick<TableLayout, "zones" | "slots">): RowFeet {
  const foot = (zone: "staging" | "engaged") => Math.max(layout.zones[zone].y + layout.zones[zone].h, ...layout.slots.filter((slot) => slot.zone === zone).map((slot) => slot.y + slot.h));
  return { staging: Math.ceil(foot("staging")), engaged: Math.ceil(foot("engaged")) };
}

/**
 * The rows wholly above the column's occupied part: the dock, the head when it shows (with its gap) and `margin`, measured up from the
 * column's foot padding. `top` is how far the canvas starts below the column's top (the peek pill's room). 0 before the column and the dock
 * are measured.
 */
export function columnReach(column: { height: number; foot: number; dock: number; head: number; margin: number; top: number }, feet: RowFeet | null): Reach {
  if (!feet || column.height <= 0 || column.dock <= 0) return 0;
  const free = column.height - column.foot - column.dock - column.head - column.margin - column.top;
  if (free >= feet.engaged) return 2;
  return free >= feet.staging ? 1 : 0;
}
