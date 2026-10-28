// Where a hand card is while the scrub runs (phase 25): from its place in the peeking, fanned hand at progress 0 to its place in the
// risen, spread hand (hand-scrub.ts) at 1. The rise lifts the cards, grows them and turns the fan to the risen hand's own (the lifted
// card straightens, so it can be read); the spread slides them
// apart sideways; the card under the finger lifts above the others and grows again. Pure, run on the UI thread by the canvas.
import type { Rect } from "./layout.ts";
import { SHAPE } from "./motion-tokens.ts";

/** The three clocks the scrub runs, each 0 to 1: the rise, the spread, and the lift of the card under the finger. */
export type ScrubClock = { rise: number; apart: number; lift: number };

/** A translation and scale about the card's own center, and a turn in radians, added to what the layout gives it. */
export type ScrubPose = { dx: number; dy: number; scale: number; rot: number };

/** The pose of one hand card. `slot` is where the layout puts it (with its fan `tilt`), `target` where the spread puts it (with its fan `tilt`). */
export function scrubPose(slot: Rect & { tilt: number }, target: Rect & { tilt: number }, clock: ScrubClock, lifted: boolean): ScrubPose {
  "worklet";
  const lift = lifted ? clock.lift * clock.rise : 0;
  return {
    dx: (target.x + target.w / 2 - (slot.x + slot.w / 2)) * clock.apart,
    dy: (target.y + target.h / 2 - (slot.y + slot.h / 2)) * clock.rise - target.h * SHAPE.scrubLiftRise * lift,
    scale: (1 + (target.w / slot.w - 1) * clock.rise) * (1 + (SHAPE.scrubLiftScale - 1) * lift),
    rot: (target.tilt * (1 - lift) - slot.tilt) * clock.rise,
  };
}
