// The table's motion tokens (docs/design-system.md, Table, Motion; phase 23): every duration, easing and spring in src/play is
// named here and nowhere else. Pure numbers and names, so a Vitest reads them and the canvas worklets share them
// (motion-curves.ts draws a curve from a name; motion-run.ts hands the same names to Reanimated).
//
// Every duration passes through `motionScale(speed, reduced)`: 1 for Normal, 0.6 for Quick, 0 under reduced motion (then
// everything snaps). Each token is at most 500 ms; the sweep and the whole run of the combat spotlight (phase 24) are the two
// exceptions.
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
  // The combat spotlight (phase 24), one attack: the table dims and the cards fly to the center (dim), the attacker draws back
  // (draw), lunges (lunge), everything holds at the hit (hold), the target shakes while the damage tokens fly or the defense
  // bounces (impact, with burstStep and burstFly inside it), and both go back (return). A destroyed target greys and drops (fall)
  // as the attacker returns; a turned shadow card flips with `cardFlip`. The six beats add up to `spotlight`.
  spotlightDim: tween(250, "outCubic"),
  spotlightDraw: tween(250, "outCubic"),
  spotlightLunge: tween(150, "inCubic"),
  spotlightHold: tween(80, null),
  spotlightImpact: tween(370, "linear"),
  spotlightReturn: tween(400, "inCubic"),
  spotlightBurstStep: tween(90, null),
  spotlightBurstFly: tween(190, "outCubic"),
  spotlightBounceRise: tween(120, "outCubic"),
  spotlightBounceSettle: spring(250, 0.5),
  spotlightFall: tween(250, "outCubic"),
  // Several attacks in one state: the table is already dark, so the second and later attacks come in over a swap (no dim, no
  // flight from the slots) with a shorter draw back, and only the last goes back. The scrim over the bar and the dock fades in and,
  // when a tap skips the spotlight, out over `spotlightScrim`.
  spotlightSwap: tween(150, "outCubic"),
  spotlightDrawAgain: tween(125, "outCubic"),
  spotlightScrim: tween(100, "outCubic"),
  spotlight: tween(1500, "linear"),
  // The hand scrub (phase 25): the held hand rises (and grows and turns its fan) over `scrubRise` and spreads sideways over `scrubSpread`,
  // together; the card under the finger lifts over `scrubLift`; the hand settles back over `scrubFall`. The table's 35% night
  // rides the rise. The 150 ms hold and the 6 pt slop that start it are gesture thresholds (hand-scrub.ts), not tokens.
  scrubRise: tween(220, "outCubic"),
  scrubSpread: tween(220, "outCubic"),
  scrubLift: tween(120, "outCubic"),
  scrubFall: tween(180, "inCubic"),
} as const;

/** The six beats of one attack in order; their lengths add up to `MOTION.spotlight` (the run of a lone attack). Read by the tests. */
export const SPOTLIGHT_BEATS = ["spotlightDim", "spotlightDraw", "spotlightLunge", "spotlightHold", "spotlightImpact", "spotlightReturn"] as const;

/** The tokens that may pass 500 ms (a title sweep across the canvas, and the whole run of the combat spotlight, phase 24). */
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
  // The combat spotlight: the cards stand at this share of the canvas's height with this gap (pt) between them; the attacker
  // draws back this far (pt) and tilts this many degrees away; the target shakes this far (pt) in this many swings; a blocked
  // attack bounces its defense to this scale; a destroyed target drops this far (pt) under a night veil of this opacity; the
  // table dims to this night opacity; up to this many attackers stand as a fan; a turned shadow card stands at this scale; the
  // damage token art flies at this size (pt).
  spotlightHeight: 0.42,
  spotlightGap: 24,
  spotlightDrawBack: 10,
  spotlightTilt: 4,
  spotlightShake: 5,
  spotlightSwings: 3,
  // A blocked defender shakes this share as far as one that was hit.
  spotlightShakeBlocked: 0.4,
  // A destroyed target's veil is full by this share of its fall; it fades out over the rest.
  spotlightVeilBy: 0.4,
  spotlightBounce: 1.25,
  spotlightDrop: 12,
  spotlightVeil: 0.5,
  spotlightNight: 0.65,
  spotlightFan: 3,
  spotlightShadow: 0.8,
  spotlightToken: 28,
  // The hand scrub: the risen hand's cards grow to this scale (a hand too wide for a 44 pt slice of each at this scale gets a
  // smaller one), the card under the finger grows to this much more from its foot and its foot rises this share of its height
  // (less where the canvas's top edge would cut it), and the rest of the table dims to this night opacity. Its neighbours keep
  // their size (user request, 2026-10-29: no wave).
  scrubScale: 1.5,
  scrubLiftScale: 1.55,
  scrubLiftRise: 0.25,
  scrubNight: 0.35,
  // The risen hand is fanned like a held hand (user request, 2026-10-28): the cards turn this many radians apart, but the whole
  // fan spans at most `fanMax` radians (about 26 degrees); the arc they sit on has a radius of this many card heights.
  fanStep: 0.07,
  fanMax: 0.45,
  fanRadius: 3,
  // The peek: the peeked hand carries a night veil of this opacity.
  peekVeil: 0.3,
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
