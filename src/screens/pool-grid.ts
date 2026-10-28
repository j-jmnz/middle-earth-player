// The card pool grid's geometry (docs/design-system.md, Card pool). FlashList makes each column exactly a share of the list's width,
// so a card is narrower than its column by the gaps shared over the columns, and each card sits a little into its column: the gaps
// come out equal and the last card ends at the list's edge. Pure, so a test reads it.
// `scale` is the UI scale (docs/plans/settings-theme-and-ui-scale.md): the grid is laid out in logical points, the list's width over
// the scale with a 10 point gap, and the results come back times the scale, so a card keeps its share of the screen at any size.

export const GRID_GAP = 10;

/** A grid card's width, for `columns` cards across a list `width` wide. */
export function gridCardWidth(width: number, columns: number, scale = 1): number {
  return Math.floor((width / scale - GRID_GAP * (columns - 1)) / columns) * scale;
}

/** How far a card sits into its column, by its index in the list. */
export function gridOffset(index: number, columns: number, scale = 1): number {
  return (((index % columns) * GRID_GAP) / columns) * scale;
}
