// Where the outcome banner hangs across the screen (moment-banner.tsx): centered on the screen (user request, 2026-10-29; it was
// centered over the canvas's columns before, off the middle), as wide as it may be without reaching into the left inset or over the
// command column and its tray at the right. Pure, so a test reads it.

/** The banner's band: `left` and `right` from the screen's edges, centered on the screen and at most `want` wide. */
export function bannerSpan(screenWidth: number, want: number, leftClear: number, rightClear: number): { left: number; right: number } {
  const middle = screenWidth / 2;
  const half = Math.max(0, Math.min(want / 2, middle - leftClear, middle - rightClear));
  return { left: middle - half, right: middle - half };
}
