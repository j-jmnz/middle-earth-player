// The table's motion tokens (docs/design-system.md, Table, Motion; phase 23): every duration, easing and spring in src/play is
// named here and nowhere else. Pure numbers and names, so a Vitest reads them and the canvas worklets share them
// (motion-curves.ts draws a curve from a name; motion-run.ts hands the same names to Reanimated).
//
// Every duration passes through `motionScale(speed, reduced)`: 1 for Normal, 0.6 for Quick, 0 under reduced motion (then
// everything snaps). Each token is at most 500 ms; the sweep and the combat spotlight (phase 24) are the two exceptions.
// What is not motion stays out of the scale: a gate or a timer (the top bar's 400 ms measure fallback, the dock's second-tap
// window, the banner's beats, the 350 ms settle after a new moment) is not a token.

/** The Animation speed setting (table-settings.ts). */
export type Speed = "normal" | "quick";

export const SPEEDS: readonly Speed[] = ["normal", "quick"];

/** 1 for Normal, 0.6 for Quick, 0 under reduced motion. */
export function motionScale(speed: Speed, reduced: boolean): number {
  "worklet";
  if (reduced) return 0;
  return speed === "quick" ? 0.6 : 1;
}

/** A token's length in ms at a scale, whole milliseconds. */
export function ms(token: { ms: number }, scale: number): number {
  "worklet";
  return Math.round(token.ms * scale);
}

/** What a layout animation class (Reanimated's FadeIn, SlideInDown, ...) offers: a length, and a copy of itself that has it. */
export type Timeable<B> = { duration(ms: number): B };

/**
 * A layout animation of a token's length at a scale. The one place in src/play that gives a layout animation its length, so a
 * grep for the call finds no literal anywhere else.
 */
export function timed<B>(base: Timeable<B>, token: { ms: number }, scale: number): B {
  return base.duration(ms(token, scale));
}

/** A curve, by name (motion-curves.ts evaluates it; motion-run.ts gives Reanimated the same one). */
export type EasingName = "linear" | "outCubic" | "inCubic" | "outQuad" | "inQuad" | "outBack";

/** A timed motion. `easing` null keeps the layout animation's own default. */
export type Tween = { readonly ms: number; readonly easing: EasingName | null };

/**
 * A spring, by its damping ratio and the time it takes to settle (within about 2%). Reanimated gets stiffness and damping
 * worked out from them (springTune); the canvas evaluates the same curve (motion-curves.ts, springStep).
 */
export type Spring = { readonly ms: number; readonly zeta: number };

const tween = (length: number, easing: EasingName | null): Tween => ({ ms: length, easing });
const spring = (length: number, zeta: number): Spring => ({ ms: length, zeta });

export const MOTION = {
  // Cards on the canvas.
  cardArrive: tween(420, "outBack"),
  cardDepart: tween(300, "inCubic"),
  cardFlip: tween(240, "linear"),
  stagger: tween(90, null),
  lift: tween(120, "outCubic"),
  glide: tween(380, "outCubic"),
  land: spring(260, 0.5),
  popRise: tween(60, "outCubic"),
  popHold: tween(120, null),
  popSettle: spring(280, 0.55),
  exhaust: spring(350, 0.6),
  shakeStep: tween(50, "linear"),
  cardLeave: tween(420, "inCubic"),
  // Tokens on cards.
  tokenPopRise: tween(80, "outCubic"),
  tokenPopSettle: spring(220, 0.5),
  floatRise: tween(500, "outCubic"),
  floatFade: tween(300, "inQuad"),
  // Chrome.
  sweep: tween(900, "linear"),
  seatPulse: tween(300, "outCubic"),
  seatPulseHalf: tween(150, "outCubic"),
  seatHand: tween(300, "outCubic"),
  bannerIn: tween(260, null),
  bannerOut: tween(260, null),
  sheetIn: tween(220, null),
  trayEnter: tween(260, "outCubic"),
  trayLeave: tween(180, "inCubic"),
  menuEnter: tween(200, "outCubic"),
  menuLeave: tween(150, "inCubic"),
  carouselEnter: tween(240, "outCubic"),
  carouselLeave: tween(180, "inCubic"),
  railSlide: tween(280, "outCubic"),
  railFlashIn: tween(60, null),
  railFlashOut: tween(240, null),
  railFlash: tween(300, null),
  railStep: tween(200, null),
  previewIn: spring(280, 0.74),
  previewOut: tween(150, "inQuad"),
  dragLift: tween(90, null),
  dragReturn: tween(160, null),
  dialPopRise: tween(140, null),
  dialPopSettle: spring(350, 0.5),
  threatBadgeIn: tween(160, null),
  threatBadgeOut: tween(400, null),
  toastIn: tween(160, null),
  toastOut: tween(120, null),
} as const;

/** The tokens that may pass 500 ms (a title sweep across the canvas; phase 24 adds the combat spotlight). */
export const LONG_TOKENS: readonly string[] = ["sweep", "spotlight"];

/** The longest a token runs, apart from LONG_TOKENS. */
export const MAX_TOKEN_MS = 500;

// The shapes the durations move through: distances in points, scales, counts. Not durations, so the scale leaves them alone.
export const SHAPE = {
  // Easing.out(Easing.back(1.2)): the slight overshoot of an arrival.
  backOvershoot: 1.2,
  // A drawn card rises this far at mid-path.
  arc: 24,
  // A played card lifts to this, and lands squashed to the second.
  lift: 1.12,
  squash: 0.96,
  // A revealed card pops to this.
  popScale: 1.12,
  // A destroyed or discarded card shakes this many times, this far.
  shakeCount: 3,
  shakeAmplitude: 4,
  // A token pops to this; a floating number rises this far.
  tokenPop: 1.4,
  floatRise: 20,
  // The floating number is fully shown this long, then fades: 700 ms in all.
  floatFadeFrom: 400,
  // The sweep slides this far.
  sweepSlide: 40,
  // The acting seat's dial pulses to this, and its hand slides up from this far below.
  seatPulse: 1.12,
  seatHandRise: 0.6,
  // The dial pops to this when its number changes.
  dialPop: 1.22,
  // Drawn cards leave one after another, at most this many places apart.
  maxStagger: 5,
} as const;

/** The curve of the dock's armed bar: it runs down the whole second-tap window, which is a timer and not a token. */
export const ARM_BAR_EASING: EasingName = "linear";

/** Stiffness and damping (mass 1) for a spring token: settles in `ms` at damping ratio `zeta`. */
export function springTune(token: Spring): { mass: number; stiffness: number; damping: number } {
  const omega = springOmega(token);
  return { mass: 1, stiffness: omega * omega, damping: 2 * token.zeta * omega };
}

/** The spring's natural frequency in radians per second: the envelope falls to about 2% at `ms`. */
export function springOmega(token: Spring): number {
  "worklet";
  return 4 / (token.zeta * (token.ms / 1000));
}
