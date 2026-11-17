// The mouse's way into the hand (docs/design-system-table.md, Pointer and keys; the web and desktop build only, hand-gestures.canvaskit.ts): a pointer resting over the
// hand raises and spreads it as the press-and-hold scrub does, and lifts the card under it; the wheel steps the lifted card. Pure geometry on the scrub's own
// (hand-scrub.ts); nothing here sends an intent or plays a haptic.
import type { CardSlot, Rect } from "../layout/layout.ts";
import { contains, hitSlot } from "../layout/hits.ts";
import { cardAt, SCRUB_SLOP, startsScrub, type Spread } from "./hand-scrub.ts";
import { SHAPE } from "../../ui/motion-tokens.ts";

/**
 * The rectangle the lifted copy of card `index` is drawn in once it has risen: the spread's slot grown by `room.lift` from its foot, the foot raised as
 * scrub-pose.ts raises it, and held inside the room the way an end card is moved in.
 */
export function liftedRect(spread: Spread, index: number): Rect | null {
  const slot = spread.slots[index];
  if (!slot) return null;
  const { room } = spread;
  const w = slot.w * room.lift;
  const h = slot.h * room.lift;
  const rise = Math.min(slot.h * SHAPE.scrubLiftRise, Math.max(0, slot.y + slot.h - h - room.top));
  const centre = Math.min(Math.max(slot.x + slot.w / 2, room.left + w / 2), Math.max(room.left + w / 2, room.right - w / 2));
  return { x: centre - w / 2, y: slot.y + slot.h - rise - h, w, h };
}

/**
 * The card a pointer is on in the risen hand as it is drawn, or -1 when the pointer is outside it: on the lifted card's rectangle (the card `lifted`, which
 * stands above the others and keeps the pointer while it is on it), else on the topmost spread card there, a gap's half either side included, down to the foot of
 * the hand's strip, else in a gap's end of the row's span (the nearest center). The hand is closed above its highest card, so it never covers the rows over it.
 */
export function risenCardAt(spread: Spread, x: number, y: number, lifted: number): number {
  const rect = lifted >= 0 ? liftedRect(spread, lifted) : null;
  if (rect && contains(rect, x, y)) return lifted;
  const slack = ((spread.slots[1]?.x ?? 0) - (spread.slots[0]?.x ?? 0) - (spread.slots[0]?.w ?? 0)) / 2;
  const foot = spread.strip.y + spread.strip.h;
  for (let index = spread.slots.length - 1; index >= 0; index -= 1) {
    const slot = spread.slots[index];
    if (!slot) continue;
    const half = Math.max(0, slack);
    if (contains({ x: slot.x - half, y: slot.y, w: slot.w + 2 * half, h: Math.max(slot.h, foot - slot.y) }, x, y)) return index;
  }
  return -1;
}

/**
 * The card the pointer lifts, or -1 for none. A hand that is not open opens only for a pointer on a hand card or on the hand strip between cards (the press
 * that starts the scrub, `startsScrub`), on the card the spread will have under that x. An open hand stays open only while the pointer is inside the drawn
 * risen hand (`risenCardAt`): the lifted card keeps the pointer while it is on it, so a few pixels do not pass the lift to a neighbour, and the card under the
 * pointer is lifted once it leaves.
 */
export function hoverCard(spread: Spread, slots: readonly CardSlot[], x: number, y: number, open: boolean, lifted = -1): number {
  if (open) return risenCardAt(spread, x, y, lifted);
  return startsScrub(spread, slots, x, y, hitSlot(slots, x, y)) ? cardAt(spread, x) : -1;
}

// Where on a resting hand card a press is sure to land on that card: the top of its visible part, the card's own middle first. A later card of the fan covers
// up to half of the one under it, so the card's center can belong to its neighbour.
const GRAB_X = [0.5, 0.3, 0.7, 0.15, 0.85];
const GRAB_Y = [0.12, 0.2, 0.3, 0.45];

/** How far below the grab point the drag's first move goes: the phone's drag starts counting from where it has gone past the slop (`SCRUB_SLOP`, 6 pt), so that point is on the card too. */
export const GRAB_STEP = SCRUB_SLOP + 2;

/**
 * The point on the resting card `id` (the hand's layout, with the phone's own hit test) where a press, and the step of `GRAB_STEP` below it, pick that card, or null when no
 * point of it is free: the place the phone's drag is handed to start from when a press began on the risen hand's copy of the card.
 */
export function grabPoint(slots: readonly CardSlot[], id: string): { x: number; y: number } | null {
  const slot = slots.find((candidate) => candidate.id === id && candidate.kind === "card");
  if (!slot) return null;
  for (const fy of GRAB_Y) {
    for (const fx of GRAB_X) {
      const x = slot.x + slot.w * fx;
      const y = slot.y + slot.h * fy;
      if (slots[hitSlot(slots, x, y)]?.id === id && slots[hitSlot(slots, x, y + GRAB_STEP)]?.id === id) return { x, y };
    }
  }
  return null;
}

/** A wheel step is this much `deltaY` in pixels; a mouse notch is at least that, so it is one card, and a trackpad's smaller deltas add up to one (`wheelAdvance`). */
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

/**
 * What a wheel event does to the hand: a mouse notch (a delta of at least one step, or a line or page delta) is exactly one step and clears what was left, so
 * a notch's remainder never makes the next one two; only a trackpad's smaller deltas add up.
 */
export function wheelAdvance(rest: number, delta: number, deltaMode: number): { steps: number; rest: number } {
  const pixels = wheelPixels(delta, deltaMode);
  if (deltaMode !== 0 || Math.abs(pixels) >= WHEEL_STEP) return { steps: Math.sign(pixels), rest: 0 };
  return wheelSteps(rest + pixels);
}

/** The card `steps` along from `index`, kept inside the hand; the hand's first card when none is lifted. */
export function stepCard(index: number, count: number, steps: number): number {
  if (count <= 0) return -1;
  if (index < 0) return 0;
  return Math.min(count - 1, Math.max(0, index + steps));
}
