// The card pool grid's geometry (docs/design-system.md, Card pool). FlashList makes each column exactly a share of the list's width,
// so a card is narrower than its column by the gaps shared over the columns, and each card sits a little into its column: the gaps
// come out equal and the last card ends at the list's edge. Pure, so a test reads it.

export const GRID_GAP = 10;

/** A grid card's width, for `columns` cards across a list `width` wide. */
export function gridCardWidth(width: number, columns: number): number {
  return Math.floor((width - GRID_GAP * (columns - 1)) / columns);
}

/** How far a card sits into its column, by its index in the list. */
export function gridOffset(index: number, columns: number): number {
  return ((index % columns) * GRID_GAP) / columns;
}
