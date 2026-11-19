// The table's motion tokens (docs/design-system-table.md, Motion; phase 23): every duration, easing and spring in src/play is
// named here and nowhere else. Pure numbers and names, so a Vitest reads them and the canvas worklets share them
// (motion/curves.ts draws a curve from a name; src/ui/motion-run.ts hands the same names to Reanimated).
//
// Every duration passes through `motionScale(speed, reduced)`: 1 for Normal, 0.6 for Quick, 1.5 for Slow, 0 under reduced motion (then
// everything snaps). Each token is at most 500 ms; the sweep, the spotlight's hold and its whole run (phase 24), and the lives
// of its ash are the exceptions.
// What is not motion stays out of the scale: a gate or a timer (the top bar's 400 ms measure fallback, the dock's second-tap
// window, the banner's beats, the 350 ms settle after a new moment) is not a token.

/** The Animation speed setting (table-settings.ts). */
export type Speed = "normal" | "quick" | "slow";

export const SPEEDS: readonly Speed[] = ["normal", "quick", "slow"];

/** 1 for Normal, 0.6 for Quick, 1.5 for Slow, 0 under reduced motion. */
export function motionScale(speed: Speed, reduced: boolean): number {
  "worklet";
  if (reduced) return 0;
  if (speed === "slow") return 1.5;
  return speed === "quick" ? 0.6 : 1;
}

/** How much longer the banner's beats and hold last: 1.5 for Slow, 1 otherwise (they are timers, not tokens, so Quick leaves them and reduced motion does not snap the hold). */
export function paceScale(speed: Speed): number {
  return speed === "slow" ? 1.5 : 1;
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

/** A curve, by name (motion/curves.ts evaluates it; src/ui/motion-run.ts gives Reanimated the same one). */
export type EasingName = "linear" | "outCubic" | "inCubic" | "outQuad" | "inQuad" | "outBack" | "inOutSine";

/** A timed motion. `easing` null keeps the layout animation's own default. */
export type Tween = { readonly ms: number; readonly easing: EasingName | null };

/**
 * A spring, by its damping ratio and the time it takes to settle (within about 2%). Reanimated gets stiffness and damping
 * worked out from them (springTune); the canvas evaluates the same curve (motion/curves.ts, springStep).
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
  previewIn: spring(280, 0.74),
  previewOut: tween(150, "inQuad"),
  dragLift: tween(90, null),
  dragReturn: tween(160, null),
  // One swing of the shake a card pushed out of the hand scrub gives when it cannot be played and is let go (four swings, then
  // `dragReturn` home).
  dragRefuse: tween(45, "outQuad"),
  dialPopRise: tween(140, null),
  dialPopSettle: spring(350, 0.5),
  // The quest meter's bars (quest-meter-view.tsx) rise and fall to each new value.
  meterFill: tween(220, "outCubic"),
  threatBadgeIn: tween(160, null),
  threatBadgeOut: tween(400, null),
  toastIn: tween(160, null),
  toastOut: tween(120, null),
  // The combat spotlight, one attack (docs/design-system-table.md, Spotlight): the dark comes in and the cards arc to the center
  // (enter), the attack value and the gauge pop and a shadow card flips (read), the attacker draws back and glows (charge), strikes (lunge),
  // everything holds at the hit (stop), the target takes it (impact, with burstStep and burstFly inside it), the cards and the
  // result stay (hold) and both go back (return). A destroyed target burns inside the return (burn). The eight beats add up to `spotlight`.
  spotlightEnter: tween(350, "outCubic"),
  spotlightRead: tween(300, "outCubic"),
  spotlightCharge: tween(350, "outQuad"),
  spotlightLunge: tween(120, "inCubic"),
  spotlightStop: tween(100, null),
  spotlightImpact: tween(480, "linear"),
  // After the impact the cards, the gauge and the result stay so they can be read (user request, 2026-10-30).
  spotlightHold: tween(1000, null),
  spotlightReturn: tween(500, "inCubic"),
  spotlightBurn: tween(450, "inQuad"),
  // Several attacks in one state: the dark is already in, so the second and later attacks come in over a swap (no flight from the
  // slots) with a shorter read and charge, and only the last goes back. Swap, readAgain, chargeAgain, lunge, stop, impact and
  // hold add up to `SPOTLIGHT_AGAIN`.
  spotlightSwap: tween(200, "outCubic"),
  spotlightReadAgain: tween(100, "outCubic"),
  spotlightChargeAgain: tween(200, "outQuad"),
  // Inside the impact: the flash and the shockwave ring, the sparks and the trauma shake, the damage number's rise and settle, the
  // damage tokens' step and flight, the result word and the attacker's recoil, the shadow card's flip and glint, and the gap between
  // the afterimages of the lunge.
  spotlightFlash: tween(160, "outQuad"),
  spotlightRing: tween(360, "outCubic"),
  spotlightSparks: tween(450, "outCubic"),
  spotlightShake: tween(420, "linear"),
  spotlightNumberRise: tween(140, "outCubic"),
  spotlightNumberSettle: spring(260, 0.5),
  spotlightBurstStep: tween(90, null),
  spotlightBurstFly: tween(220, "outCubic"),
  spotlightResult: tween(160, "outCubic"),
  spotlightRecoil: spring(320, 0.5),
  spotlightFlip: tween(300, "outCubic"),
  spotlightGlint: tween(260, "linear"),
  spotlightTrailStep: tween(16, null),
  // A kill holds longer at the hit (a boss stop): this replaces `spotlightStop` for it and the extra is taken from `spotlightImpact`,
  // so the return and the run keep their times.
  spotlightStopKill: tween(160, null),
  // The particles' lives at Normal speed (spotlight/particles.ts): the slowest converging ember's flight, the slowest spark's rise
  // from a heart the attack filled, and the slowest ash's rise; each sprite lives a seeded share of its token.
  spotlightConverge: tween(500, "linear"),
  spotlightEmber: tween(480, "linear"),
  spotlightAsh: tween(1100, "linear"),
  spotlight: tween(3200, "linear"),
  // The hand scrub (phase 25): the held hand rises (and grows and turns its fan) over `scrubRise` and spreads sideways over `scrubSpread`,
  // together; the card under the finger lifts over `scrubLift`; the hand settles back over `scrubFall`. The table's 35% night
  // rides the rise. The 150 ms hold and the 6 pt slop that start it are gesture thresholds (hand-scrub.ts), not tokens.
  scrubRise: tween(220, "outCubic"),
  scrubSpread: tween(220, "outCubic"),
  scrubLift: tween(120, "outCubic"),
  scrubFall: tween(180, "inCubic"),
  // The splash ring's glow while the app opens (docs/design-system.md, Splash): the halo comes in over `splashRampIn`, then swells and
  // fades, each half of a breath `splashBreath`, until the databases are open; it flares over `splashFlare` while the black fades
  // over `splashFade`, both starting together.
  splashRampIn: tween(350, "outCubic"),
  splashBreath: tween(800, "inOutSine"),
  splashFlare: tween(160, "outCubic"),
  splashFade: tween(380, "inQuad"),
} as const;

/** The eight beats of one attack in order; their lengths add up to `MOTION.spotlight` (the run of a lone attack). Read by the tests. */
export const SPOTLIGHT_BEATS = ["spotlightEnter", "spotlightRead", "spotlightCharge", "spotlightLunge", "spotlightStop", "spotlightImpact", "spotlightHold", "spotlightReturn"] as const;

/** The beats of an attack that follows another in the same state, which add up to `SPOTLIGHT_AGAIN` (ms, unscaled): it swaps in, and does not go back unless it is the last. */
export const SPOTLIGHT_AGAIN_BEATS = ["spotlightSwap", "spotlightReadAgain", "spotlightChargeAgain", "spotlightLunge", "spotlightStop", "spotlightImpact", "spotlightHold"] as const;
export const SPOTLIGHT_AGAIN = 2200;

/** The tokens that may pass 500 ms (a title sweep across the canvas, the combat spotlight's hold and its whole run, phase 24, the life of its ash, and half of the splash ring's breath, which loops and holds nothing up). */
export const LONG_TOKENS: readonly string[] = ["sweep", "spotlight", "spotlightHold", "spotlightAsh", "splashBreath"];

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
  // The acting seat's dial pulses to this.
  seatPulse: 1.12,
  // The dial pops to this when its number changes.
  dialPop: 1.22,
  // Drawn cards leave one after another, at most this many places apart.
  maxStagger: 5,
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
