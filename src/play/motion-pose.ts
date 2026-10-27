// Where a card is, and how it looks, at a moment of its motion. Pure: the canvas's UI thread calls `poseAt` and `ghostPoseAt` once
// per frame from one clock, so a flip, a stagger, an arc, a squash or a pop is arithmetic on a time (the functions marked
// "worklet" run there; in Node the directive is an unused string). motion.ts says what each card does, motion-tokens.ts how
// long it takes. `now` is ms since the state was drawn and `k` is motionScale (Quick shortens every length to 0.6).
import { clamp01, ease, length, popScale, scaledSpring, springStep } from "./motion-curves.ts";
import { still, type Ghost, type Motion } from "./motion.ts";
import { MOTION, SHAPE } from "./motion-tokens.ts";

// The slot's own pose is the rest: the card at its slot, upright to its turn, fully shown.
export type Pose = {
  // Where it is, as an offset from its slot, and its size as a multiple of the slot's.
  dx: number;
  dy: number;
  scale: number;
  rot: number;
  opacity: number;
  // Turned about its own vertical axis: 1 face on, 0 edge on.
  flipX: number;
  // The printed back shows instead of the face.
  back: boolean;
};

function tilt(m: Motion, away: number): number {
  "worklet";
  return m.toRot + (m.fromRot - m.toRot) * away;
}

/** Whether a motion is the quarter turn of exhausting or readying alone: the card stays where it is. */
function turnOnly(m: Motion): boolean {
  "worklet";
  return m.dx === 0 && m.dy === 0 && m.scale === 1 && m.fromRot !== m.toRot && !m.flip && m.land == null && !m.slide && !m.peek;
}

/** The pose of a slot `now` ms after the state was drawn. At or past the end of its motion it is the rest pose. */
export function poseAt(m: Motion, now: number, k: number): Pose {
  "worklet";
  const t = now - m.delay * k;
  const startScale = m.scale;
  // Waiting its turn (a drawn card behind the one before it): not there yet.
  if (t < 0) return { dx: m.dx, dy: m.dy, scale: startScale, rot: m.fromRot, opacity: 0, flipX: 1, back: m.flip };

  if (m.land === "squash") {
    // A played card: lifts where it lies, glides to its slot, and lands squashed, springing back.
    const lift = length(MOTION.lift, k);
    const glide = length(MOTION.glide, k);
    if (t < lift) {
      const f = 1 + (SHAPE.lift - 1) * ease("outCubic", t / lift);
      return { dx: m.dx, dy: m.dy, scale: startScale * f, rot: m.fromRot, opacity: 1, flipX: 1, back: false };
    }
    const g = clamp01((t - lift) / glide);
    const q = 1 - ease("outCubic", g);
    const along = (1 + (startScale - 1) * q) * (SHAPE.lift + (1 - SHAPE.lift) * ease("inCubic", g));
    const landed = t - lift - glide;
    const squash = landed < 0 ? 1 : 1 - (1 - SHAPE.squash) * (1 - springStep(landed, scaledSpring(MOTION.land, k)));
    return { dx: m.dx * q, dy: m.dy * q, scale: g < 1 ? along : squash, rot: tilt(m, q), opacity: 1, flipX: 1, back: false };
  }

  if (turnOnly(m)) {
    // Exhaust and ready: the quarter turn is a spring with a light overshoot.
    const s = springStep(t, scaledSpring(MOTION.exhaust, k));
    return { dx: 0, dy: 0, scale: 1, rot: tilt(m, 1 - s), opacity: 1, flipX: 1, back: false };
  }

  if (m.peek) {
    // A seat's zone comes in from the side the peek came from, decelerating, fading in.
    const x = clamp01(t / length(MOTION.peekSlide, k));
    const q = 1 - ease("outCubic", x);
    return { dx: m.dx * q, dy: 0, scale: 1, rot: m.toRot, opacity: m.fromOpacity + (1 - m.fromOpacity) * x, flipX: 1, back: false };
  }

  if (m.slide) {
    // The hand of the acting seat slides up into place.
    const x = clamp01(t / length(MOTION.seatHand, k));
    const q = 1 - ease("outCubic", x);
    return { dx: m.dx * q, dy: m.dy * q, scale: 1, rot: m.toRot, opacity: m.fromOpacity + (1 - m.fromOpacity) * x, flipX: 1, back: false };
  }

  // An arrival: eases out past its slot a little and settles. A drawn or revealed card also rises on an arc, shows its back,
  // and turns over around the midpoint of the way.
  const total = length(MOTION.cardArrive, k);
  const x = clamp01(t / total);
  const q = 1 - ease("outBack", x);
  const arc = m.arc > 0 && x < 1 ? -m.arc * Math.sin(Math.PI * x) : 0;
  let flipX = 1;
  let back = false;
  let factor = 1;
  if (m.flip) {
    const turn = length(MOTION.cardFlip, k);
    const start = (total - turn) / 2;
    const u = clamp01((t - start) / turn);
    flipX = Math.abs(Math.cos(Math.PI * u));
    back = u < 0.5;
    if (m.land === "pop") factor = popScale(t - start - turn, k, SHAPE.popScale, MOTION.popRise, MOTION.popHold.ms, MOTION.popSettle);
  }
  return {
    dx: m.dx * q,
    dy: m.dy * q + arc,
    scale: (1 + (startScale - 1) * q) * factor,
    rot: tilt(m, q),
    opacity: m.fromOpacity + (1 - m.fromOpacity) * x,
    flipX,
    back,
  };
}

// Offset of a shake `t` ms in: three steps of the amplitude, alternating, the last coming back to rest.
function shakeAt(t: number, k: number): number {
  "worklet";
  const step = length(MOTION.shakeStep, k);
  const at = Math.floor(t / step);
  if (at >= SHAPE.shakeCount) return 0;
  const frac = (t - at * step) / step;
  const amp = SHAPE.shakeAmplitude;
  // +amp, -amp, back to 0: step 0 goes 0 to +amp, step 1 +amp to -amp, step 2 -amp to 0.
  const from = at === 0 ? 0 : at === 1 ? amp : -amp;
  const to = at === 0 ? amp : at === 1 ? -amp : 0;
  return from + (to - from) * frac;
}

export type GhostPose = { dx: number; dy: number; scale: number; opacity: number };

/** The pose of a card that left, `now` ms after the state was drawn, as an offset from where it stood. */
export function ghostPoseAt(g: Ghost, now: number, k: number): GhostPose {
  "worklet";
  if (g.leave === "peek") {
    // The seat that was shown slides off to the side, accelerating, fading out.
    const x = clamp01(now / length(MOTION.peekLeave, k));
    return { dx: g.dx * ease("inCubic", x), dy: 0, scale: 1, opacity: 1 - x };
  }
  const shake = g.leave === "shake" ? length(MOTION.shakeStep, k) * SHAPE.shakeCount : 0;
  if (now < shake) return { dx: shakeAt(now, k), dy: 0, scale: 1, opacity: 1 };
  const run = g.leave === "shake" ? length(MOTION.cardLeave, k) : length(MOTION.cardDepart, k);
  const x = clamp01((now - shake) / run);
  if (g.leave === "fade") return { dx: 0, dy: 0, scale: 1 + (g.scale - 1) * x, opacity: 1 - x };
  // It accelerates toward the pile, but fades on the way out (ease out), so it does not linger at full strength.
  const p = ease("inCubic", x);
  return { dx: g.dx * p, dy: g.dy * p, scale: 1 + (g.scale - 1) * p, opacity: 1 - ease("outQuad", x) };
}

/** How long a motion runs from the start of the state, unscaled, its wait included. */
export function motionEnd(m: Motion): number {
  const wait = m.delay;
  if (m.land === "squash") return wait + MOTION.lift.ms + MOTION.glide.ms + MOTION.land.ms;
  if (turnOnly(m)) return wait + MOTION.exhaust.ms;
  if (m.slide) return wait + MOTION.seatHand.ms;
  if (m.peek) return wait + MOTION.peekSlide.ms;
  const arrive = MOTION.cardArrive.ms;
  if (m.land === "pop") {
    const popStart = (arrive - MOTION.cardFlip.ms) / 2 + MOTION.cardFlip.ms;
    return wait + Math.max(arrive, popStart + MOTION.popRise.ms + MOTION.popHold.ms + MOTION.popSettle.ms);
  }
  return wait + arrive;
}

/** How long a ghost runs, unscaled. */
export function ghostEnd(g: Ghost): number {
  if (g.leave === "peek") return MOTION.peekLeave.ms;
  return g.leave === "shake" ? MOTION.shakeStep.ms * SHAPE.shakeCount + MOTION.cardLeave.ms : MOTION.cardDepart.ms;
}

/** How long every motion of a state takes together, unscaled: the clock runs this long, then stops. */
export function motionSpan(moves: { motions: ReadonlyMap<string, Motion>; ghosts: readonly Ghost[] }): number {
  let span = 0;
  for (const motion of moves.motions.values()) if (!still(motion)) span = Math.max(span, motionEnd(motion));
  for (const ghost of moves.ghosts) span = Math.max(span, ghostEnd(ghost));
  return span;
}

/** When the first card played from the hand lands, ms after the state was drawn and unscaled, or null when none is: the tick waits for it. */
export function landAt(motions: ReadonlyMap<string, Motion>): number | null {
  let first: number | null = null;
  for (const motion of motions.values()) {
    if (motion.land !== "squash") continue;
    const at = motion.delay + MOTION.lift.ms + MOTION.glide.ms;
    first = first == null ? at : Math.min(first, at);
  }
  return first;
}
