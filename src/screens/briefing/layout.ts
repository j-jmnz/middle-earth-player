// The briefing's expanded layout numbers (docs/design-system.md, Briefing; docs/plans/done/tablets-and-hand-fan.md, Part 4b). Pure, so a
// test reads them. The scene pane at the left is 360 to 480 points (Medium's); the seats at the right pick from two covers a row once
// that pane is 600 wide.

/** The scene pane's width range, in Medium's points (`TwoPane range`). */
export const BRIEFING_SCENE_RANGE = { min: 360, max: 480 } as const;
/** The right pane is this wide, at least, before the seat picker shows two covers a row. */
export const TWO_COVERS_MIN = 600;
/** The padding at the right pane's trailing edge, which its list does not reach. */
export const BRIEFING_PANE_PAD = 24;
/** The gap between two covers in a row. */
export const COVER_GAP = 12;

/** The covers a seat's deck list shows in a row, for a list `listWidth` screen points wide (the pane less its trailing padding). */
export function coverColumns(listWidth: number, scale = 1): 1 | 2 {
  return (listWidth + BRIEFING_PANE_PAD * scale) / scale >= TWO_COVERS_MIN ? 2 : 1;
}

/** One cover's width, in screen points, for `columns` covers across a list `listWidth` wide. */
export function coverWidth(listWidth: number, columns: 1 | 2, scale = 1): number {
  return Math.floor(columns === 1 ? listWidth : (listWidth - COVER_GAP * scale) / 2);
}
