// The card pool grid's geometry (docs/design-system.md, Card pool). FlashList makes each column exactly a share of the list's width,
// so a card is narrower than its column by the gaps shared over the columns, and each card sits a little into its column: the gaps
// come out equal and the last card ends at the list's edge. Pure, so a test reads it.
// `scale` is the UI scale (docs/plans/settings-theme-and-ui-scale.md): the grid is laid out in logical points, the list's width over
// the scale with a 10 point gap, and the results come back times the scale, so a card keeps its share of the screen at any size.

import { columnsFor } from "../play/size-class";

export const GRID_GAP = 10;

/** A grid card's width, for `columns` cards across a list `width` wide. */
export function gridCardWidth(width: number, columns: number, scale = 1): number {
  return Math.floor((width / scale - GRID_GAP * (columns - 1)) / columns) * scale;
}

/** How far a card sits into its column, by its index in the list. */
export function gridOffset(index: number, columns: number, scale = 1): number {
  return (((index % columns) * GRID_GAP) / columns) * scale;
}

// A card's target width in the grid, in logical points, to browse (three across on a phone) and while adding (two, so each card's
// stepper fits under it). A phone's list is 312 to 392 points wide, so it gets exactly 3 and 2 whatever its size or scale; a tablet's
// list holds more (docs/design-system.md, Tablets).
const BROWSE_TARGET = 107;
const ADDING_TARGET = 166;

/** The grid's columns for a list `width` wide: 3 (browse) or 2 (adding) at least, more where the room allows. */
export function poolColumns(width: number, adding: boolean, scale = 1): number {
  return columnsFor(width, adding ? ADDING_TARGET : BROWSE_TARGET, GRID_GAP, scale, adding ? 2 : 3);
}

// FlashList keeps recycled views per type; the floor is the pool a phone has always had.
const RECYCLE_FLOOR = 24;

/** How many recycled cells FlashList may keep: the floor, or the cells in view plus two rows each way when a wider grid shows more. */
export function recyclePool(columns: number, listHeight: number, cellHeight: number): number {
  const rows = cellHeight > 0 ? Math.ceil(listHeight / cellHeight) : 0;
  return Math.max(RECYCLE_FLOOR, columns * (rows + 2));
}
