// The room a screen keeps above its head. The status bar is hidden on every screen (docs/design-system.md, Navigation), so the top
// inset is only what the screen's shape takes: a notch or a camera cutout keeps it, a phone without one (an iPhone SE, most Android
// phones in landscape) reports 0, which would put a page's title or a floating Back on the screen's very edge. Pure, so a test reads it.

// At least this much at the UI scale: the breathing room the table's bar keeps over its dials (play/chrome/top-bar-layout.ts, BAR_TOP), and a little more for a page's head.
export const TOP_ROOM = 12;

/** The top inset, never under TOP_ROOM at the UI scale `s`. */
export function topInsetOf(insetTop: number, s: number): number {
  return Math.max(insetTop, TOP_ROOM * s);
}
