// Where a hand card is while the scrub runs (phase 25): from its place in the peeking, fanned hand at progress 0 to its place in the
// risen, spread hand (hand-scrub.ts) at 1. The rise lifts the cards, grows them and turns the fan to the risen hand's own (the lifted
// card straightens, so it can be read); the spread slides them apart sideways; the card under the finger lifts above the others and
// grows again, and its neighbours grow a little, as a dock magnifies (user request, 2026-10-29). Pure, run on the UI thread by the
// canvas.
import type { Rect } from "./layout.ts";
import { SHAPE } from "./motion-tokens.ts";

/** The three clocks the scrub runs, each 0 to 1: the rise, the spread, and the lift of the card under the finger. */
export type ScrubClock = { rise: number; apart: number; lift: number };

/** A translation and scale about the card's own center, and a turn in radians, added to what the layout gives it. */
export type ScrubPose = { dx: number; dy: number; scale: number; rot: number };

/** The room a grown card stays in (the canvas less its edge), and the lifted card's grow there (hand-scrub.ts, `spreadLayout`). */
export type ScrubRoom = { left: number; right: number; top: number; lift: number };

/** How much a card `distance` places from the one under the finger grows: `lift` for that card, then the falloff; 1 for none (-1). */
export function magnify(distance: number, lift: number): number {
  "worklet";
  if (distance === 0) return lift;
  if (distance === 1) return SHAPE.scrubNear;
  if (distance === 2) return SHAPE.scrubNearer;
  return 1;
}

/**
 * The pose of one hand card. `slot` is where the layout puts it (with its fan `tilt`), `target` where the spread puts it (with its
 * fan `tilt`); `distance` how many places it is from the card under the finger (0 for the lifted copy, -1 when there is none). A
 * grown card grows from its foot, so it never reaches under the canvas, and is held inside `room`.
 */
export function scrubPose(slot: Rect & { tilt: number }, target: Rect & { tilt: number }, clock: ScrubClock, distance: number, room: ScrubRoom): ScrubPose {
  "worklet";
  const lifted = distance === 0;
  const lift = lifted ? clock.lift * clock.rise : 0;
  // The lifted card grows on the lift's clock; its neighbours with the hand's rise, and they change with the card under the finger
  // at once, as the card it left drops at once.
  const full = magnify(distance, room.lift);
  const grow = 1 + (full - 1) * (lifted ? lift : distance > 0 ? clock.rise : 0);
  const scale = (1 + (target.w / slot.w - 1) * clock.rise) * grow;
  // The lifted card's foot rises, but never so far that the top edge cuts it.
  const rise = lifted ? Math.min(target.h * SHAPE.scrubLiftRise, Math.max(0, target.y + target.h - target.h * full - room.top)) * lift : 0;
  const dx = (target.x + target.w / 2 - (slot.x + slot.w / 2)) * clock.apart;
  const rot = (target.tilt * (1 - lift) - slot.tilt) * clock.rise;
  // Held inside the room: an end card grown past the edge (its turned corners too) is moved in.
  const turn = Math.abs(slot.tilt + rot);
  const half = ((slot.w * scale) / 2) * Math.cos(turn) + ((slot.h * scale) / 2) * Math.sin(turn);
  const cx = slot.x + slot.w / 2 + dx;
  const inside = grow > 1 && 2 * half <= room.right - room.left ? Math.min(Math.max(cx, room.left + half), room.right - half) - cx : 0;
  return {
    dx: dx + inside,
    dy: (target.y + target.h / 2 - (slot.y + slot.h / 2)) * clock.rise - ((grow - 1) * target.h) / 2 - rise,
    scale,
    rot,
  };
}
