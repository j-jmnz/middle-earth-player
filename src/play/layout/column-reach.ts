// How many of the table's top rows lie wholly above the command column's dock and head (docs/design-system-table.md, Command column): the
// column lies over the canvas's right edge, and a crowded row it does not reach down to runs on under its empty top (row-reach.ts). The
// count is what the layout reads, so the dock growing or shrinking by a few points lays nothing out again: only crossing a row's foot does.
// Pure, so a test reads it. Lengths are in points, the canvas's and the column's tops level unless `top` says otherwise.
import type { TableLayout } from "./layout.ts";

export type Reach = 0 | 1 | 2;

/** Each top row's foot on the canvas: staging's (its deepest peek) and the engagement area's. */
export type RowFeet = { staging: number; engaged: number };

/** The feet of the staging and engagement rows of a layout, peeks included (the engagement band is as deep as its deepest stack, folded or not). */
export function rowFeet(layout: Pick<TableLayout, "zones" | "slots" | "stagingFoot">): RowFeet {
  const foot = (zone: "staging" | "engaged") => Math.max(layout.zones[zone].y + layout.zones[zone].h, ...layout.slots.filter((slot) => slot.zone === zone).map((slot) => slot.y + slot.h));
  // Staging's foot counts every staging card's peeks, whether the row folded the card away or not: it must not move with the reach it decides.
  return { staging: Math.ceil(Math.max(foot("staging"), layout.stagingFoot ?? 0)), engaged: Math.ceil(foot("engaged")) };
}

type Column = { height: number; foot: number; dock: number; margin: number; top: number };

/**
 * The rows wholly above the column's dock and `margin`, measured up from the column's foot padding. The head is not counted: it is given
 * the room left under the rows this count covers (`coveredTop`), so the meter coming and going never moves a row. `top` is how far the
 * canvas starts below the column's top (the peek pill's room). 0 before the column and the dock are measured.
 */
export function columnReach(column: Column, feet: RowFeet | null): Reach {
  if (!feet || column.height <= 0 || column.dock <= 0) return 0;
  const free = column.height - column.foot - column.dock - column.margin - column.top;
  if (free >= feet.engaged) return 2;
  return free >= feet.staging ? 1 : 0;
}

/** How far down the column the covered rows reach, its margin included: the head stands below it (0 with no covered row). */
export function coveredTop(column: Pick<Column, "margin" | "top">, feet: RowFeet | null, reach: Reach): number {
  if (!feet || reach === 0) return 0;
  return column.top + (reach === 2 ? feet.engaged : feet.staging) + column.margin;
}
