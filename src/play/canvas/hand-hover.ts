// The mouse's way into the hand (docs/design-system-table.md, Pointer and keys; the web and desktop build only, hand-gestures.canvaskit.ts): a pointer resting over the
// hand raises and spreads it as the press-and-hold scrub does, and lifts the card under it; the wheel steps the lifted card. Pure geometry on the scrub's own
// (hand-scrub.ts); nothing here sends an intent or plays a haptic.
import type { CardSlot } from "../layout/layout.ts";
import { hitSlot } from "../layout/hits.ts";
import { pick, startCard, startsScrub, type Spread } from "./hand-scrub.ts";

/**
 * The card the pointer lifts, or -1 for none. A hand that is not open opens only for a pointer on a hand card or on the hand strip between cards (the press
 * that starts the scrub, `startsScrub`); an open hand stays open while the pointer is anywhere the scrub's `pick` still answers, so the lifted card, which stands
 * above the resting hand, keeps the pointer.
 */
export function hoverCard(spread: Spread, slots: readonly CardSlot[], x: number, y: number, open: boolean): number {
  if (open) return pick(spread, x, y);
  return startsScrub(spread, slots, x, y, hitSlot(slots, x, y)) ? startCard(spread, slots, x, y) : -1;
}

/** A wheel step is this much `deltaY` in pixels; a notch of a mouse wheel is 100, so one notch is one card and a trackpad's small deltas add up to one. */
export const WHEEL_STEP = 60;

// `deltaMode` 1 is lines and 2 is pages (WheelEvent); a line is about 16 px and a page one step.
const LINE = 16;

/** What a wheel event adds to the running total, in pixels. */
export function wheelPixels(deltaY: number, deltaMode: number): number {
  if (deltaMode === 1) return deltaY * LINE;
  if (deltaMode === 2) return Math.sign(deltaY) * WHEEL_STEP;
  return deltaY;
}

/** The whole steps in a running total of pixels (a wheel turned down is positive: toward the hand's right) and what is left of it. */
export function wheelSteps(total: number): { steps: number; rest: number } {
  const steps = Math.trunc(total / WHEEL_STEP);
  return { steps, rest: total - steps * WHEEL_STEP };
}

/** The card `steps` along from `index`, kept inside the hand; the hand's first card when none is lifted. */
export function stepCard(index: number, count: number, steps: number): number {
  if (count <= 0) return -1;
  if (index < 0) return 0;
  return Math.min(count - 1, Math.max(0, index + steps));
}
