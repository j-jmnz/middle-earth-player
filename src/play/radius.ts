// The corner radii of the chrome (docs/design-system.md, Spacing, radius, border), in points at Medium. tailwind.config.js writes the same
// four as rem (`rounded-control`, `rounded-item`, `rounded-container`, `rounded-sheet`); tailwind-config.test.ts fails when they drift.
// A style written by hand multiplies the three sizes by the UI scale (`useUiScale()`); the control is a capsule at any size.

/** Every control: a capsule, half its height whatever that is. */
export const CONTROL_RADIUS = 999;
/** An item inside a container: a list row, a radio tile, a stat tile, a cover, a poster or book tile. */
export const ITEM_RADIUS = 12;
/** A floating container: the dock, the popover, the carousel, a reading panel, the toast, a banner. */
export const CONTAINER_RADIUS = 20;
/** The top corners of a parchment sheet. */
export const SHEET_RADIUS = 24;
