// The card preview's horizontal swipe (card-preview.tsx; docs/design-system-table.md, Cards): a swipe to the left shows the next card
// with it, to the right the one before, one card a swipe and never past either end. Pure, so a test reads it.

// How far a finger moves sideways before the swipe counts, and the flick speed that counts without the distance, in points (times
// the UI scale).
export const SWIPE_DISTANCE = 48;
export const SWIPE_FLICK = 600;

/** The card `by` places from `at` among `count` cards, never past either end (a swipe, and the screen reader's adjust). */
export function clampStep(at: number, count: number, by: number): number {
  return Math.min(count - 1, Math.max(0, at + by));
}

/** The card shown after a swipe that moved `dx` points at `vx` points a second, among `count` cards from `at`; `at` when it falls short. */
export function swipeStep(at: number, count: number, dx: number, vx: number, s: number): number {
  const far = Math.abs(dx) >= SWIPE_DISTANCE * s || Math.abs(vx) >= SWIPE_FLICK * s;
  if (!far || count <= 1) return at;
  const direction = Math.sign(dx === 0 ? vx : dx);
  return clampStep(at, count, -direction);
}
