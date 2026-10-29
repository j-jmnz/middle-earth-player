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

// How far the falloff reaches past the next card: `scrubNear` within one card of the finger, falling on a smooth curve through
// `scrubNearer` two cards away to nothing about 2.2 cards away.
const FALLOFF = 1 / Math.sqrt(1 - (SHAPE.scrubNearer - 1) / (SHAPE.scrubNear - 1));

/**
 * How much a card grows at `distance` from the finger, in cards (a fraction while the finger slides between two centers): `lift` for
 * the lifted copy (0), then a smooth falloff, `scrubNear` within one card and `scrubNearer` at two; 1 for none (-1).
 */
export function magnify(distance: number, lift: number): number {
  "worklet";
  if (distance === 0) return lift;
  if (distance < 0) return 1;
  const near = distance <= 1 ? 1 : Math.max(0, 1 - ((distance - 1) / FALLOFF) ** 2);
  // A neighbour never grows past the lifted card's own grow (a short canvas holds that one down).
  return Math.min(1 + (SHAPE.scrubNear - 1) * near, lift);
}

/**
 * The pose of one hand card. `slot` is where the layout puts it (with its fan `tilt`), `target` where the spread puts it (with its
 * fan `tilt`); `distance` how far it is from the finger in cards (0 for the lifted copy, -1 when there is none). `drop` (1 to 0) is
 * the card the finger just left settling back from its lift. A grown card grows from its foot, so it never reaches under the canvas,
 * and is held inside `room`.
 */
export function scrubPose(slot: Rect & { tilt: number }, target: Rect & { tilt: number }, clock: ScrubClock, distance: number, room: ScrubRoom, drop = 0): ScrubPose {
  "worklet";
  const lifted = distance === 0;
  // The lifted card grows on the lift's clock, and the card it left settles over the same length; the neighbours grow with the
  // hand's rise, by how near the finger is.
  const lift = (lifted ? clock.lift : drop) * clock.rise;
  const up = 1 + (room.lift - 1) * lift;
  const grow = lifted ? up : Math.max(up, 1 + (magnify(distance, room.lift) - 1) * clock.rise);
  const scale = (1 + (target.w / slot.w - 1) * clock.rise) * grow;
  // The lifted card's foot rises, but never so far that the top edge cuts it.
  const rise = Math.min(target.h * SHAPE.scrubLiftRise, Math.max(0, target.y + target.h - target.h * room.lift - room.top)) * lift;
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
