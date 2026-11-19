// The combat spotlight's beats as arithmetic on a time (docs/design-system-table.md, Spotlight; docs/design-system-table.md,
// Spotlight). Pure: the layer's UI thread calls `frameAt`, `burstAt`, `darkAt` and `punchAt` once per frame from one clock, and a
// Vitest reads them (the functions marked "worklet" run there; in Node the directive is an unused string). src/ui/motion-tokens.ts says how
// long each beat is, spotlight/shape.ts how far things move, spotlight/stage.ts where the cards stand and spotlight/fx.ts the
// shape of each effect. `t` is ms since the attack's run began and `k` the motion scale (Quick 0.6), so every length passes
// through the scale: a gate or a timer is not in here.
//
// One attack, at Normal (ms), when it is the only one (or the first of several, then without the last row):
//   0    enter   the dark comes in, the cards arc from their slots to the center and overshoot, the black fog rolls in
//   350  read    the attack value and the gauge pop in; a turned shadow card flips in 3D with a glint
//   650  charge  the attacker draws back and tilts, a rim glow builds, embers converge, the camera pushes in
//   1000 lunge   a fast strike with three fading afterimages
//   1120 stop    hit stop: everything holds; the flash peaks and the impact haptic plays
//   1220 impact  ring, sparks, shake, knock-back and tint, the damage number and the tokens (each lights a heart of the gauge as it
//                lands, and the result word follows the last); or deflection, recoil, the shields that held and "Blocked"
//   1700 hold    the cards, the gauge and the result stay so they can be read
//   2700 return  both go back and the dark lifts; a destroyed target burns instead, with ash
//   3200
// A kill holds longer (a boss stop): 160 ms, the extra 60 taken from the impact, so the return and the run keep their times.
// Several attacks in one state play under one dark: the second and later swap in over 200 ms (no flight from the slots, a read of
// 100 ms and a charge of 200), the one before them fades out in the same 200 ms, and only the last goes back. Three attacks run 7600 ms.
import { clamp01, ease, length, popScale, springStep, scaledSpring } from "../motion/curves.ts";
import { MOTION, type Tween } from "../../ui/motion-tokens.ts";
import { cameraPush, flashAt, numberAt, ringAt, shakeAt, traumaStart } from "./fx.ts";
import { SPOT } from "./shape.ts";
import { tokenPopScale } from "../motion/token-fx.ts";

const TILT = (SPOT.tilt * Math.PI) / 180;

/** How many afterimages follow a lunge, and each one's lag is `spotlightTrailStep` more than the one before. */
export const TRAIL = 3;

function curve(token: Tween, x: number): number {
  "worklet";
  return ease(token.easing ?? "linear", x);
}

/** Where an attack stands among the attacks of its state: the first enters, the last goes back. A kill (`destroyed`) holds longer at the hit. */
export type Place = { first: boolean; last: boolean; destroyed?: boolean };

/** How long the impact lasts at a scale: the token's, less the extra hit stop of a kill. */
function impactLength(k: number, destroyed: boolean): number {
  "worklet";
  const impact = length(MOTION.spotlightImpact, k);
  return destroyed ? impact - (length(MOTION.spotlightStopKill, k) - length(MOTION.spotlightStop, k)) : impact;
}

/**
 * The beats of one attack at a scale: each one's length and where it starts, in ms. `intro` is the first attack's enter or a later
 * one's swap, `ret` is 0 unless it is the last, `end` is the attack's own length, and `exit` is how long it fades out into the next attack.
 */
export type Beats = { intro: number; read: number; charge: number; lunge: number; stop: number; impact: number; hold: number; ret: number; readAt: number; chargeAt: number; lungeAt: number; stopAt: number; impactAt: number; retAt: number; end: number; exit: number };

export function beatsAt(k: number, place: Place = { first: true, last: true }): Beats {
  "worklet";
  const intro = length(place.first ? MOTION.spotlightEnter : MOTION.spotlightSwap, k);
  const read = length(place.first ? MOTION.spotlightRead : MOTION.spotlightReadAgain, k);
  const charge = length(place.first ? MOTION.spotlightCharge : MOTION.spotlightChargeAgain, k);
  const lunge = length(MOTION.spotlightLunge, k);
  const stop = length(place.destroyed ? MOTION.spotlightStopKill : MOTION.spotlightStop, k);
  const impact = impactLength(k, place.destroyed === true);
  const hold = length(MOTION.spotlightHold, k);
  const ret = place.last ? length(MOTION.spotlightReturn, k) : 0;
  const readAt = intro;
  const chargeAt = readAt + read;
  const lungeAt = chargeAt + charge;
  const stopAt = lungeAt + lunge;
  const impactAt = stopAt + stop;
  const retAt = impactAt + impact + hold;
  return { intro, read, charge, lunge, stop, impact, hold, ret, readAt, chargeAt, lungeAt, stopAt, impactAt, retAt, end: retAt + ret, exit: place.last ? 0 : length(MOTION.spotlightSwap, k) };
}

function placeOf(index: number, count: number): Place {
  "worklet";
  return { first: index === 0, last: index === count - 1 };
}

/** Where attack `index` of `count` begins, ms into the whole run at a scale: the lengths of the attacks before it. */
export function runStart(index: number, count: number, k: number): number {
  "worklet";
  let at = 0;
  for (let before = 0; before < index; before += 1) at += beatsAt(k, placeOf(before, count)).end;
  return at;
}

/** How long `count` attacks run one after another at a scale, in ms: a lone attack is 3200 at Normal, each later one 2200, and the last of them also goes back. */
export function spotlightRun(count: number, k: number): number {
  return Math.ceil(runStart(count - 1, count, k) + beatsAt(k, placeOf(count - 1, count)).end);
}

/** The run of `count` attacks, unscaled. */
export function spotlightSpan(count: number): number {
  return spotlightRun(count, 1);
}

/** Attack `index` of `count`: where it begins in the run and how long it stays drawn (its own length and the fade into the next one). */
export function windowOf(index: number, count: number, k: number): { start: number; length: number } {
  "worklet";
  const beats = beatsAt(k, placeOf(index, count));
  return { start: runStart(index, count, k), length: beats.end + beats.exit };
}

/** The ms, from the start of the whole run at a scale, at which the strike of attack `index` lands (its hit stop begins). */
export function hitTime(index: number, count: number, k: number): number {
  return runStart(index, count, k) + beatsAt(k, placeOf(index, count)).stopAt;
}

/** The ms at which the last attack begins to go back. */
export function leaveTime(count: number, k: number): number {
  return runStart(count - 1, count, k) + beatsAt(k, placeOf(count - 1, count)).retAt;
}

/** What one attack needs to know to be drawn: the damage placed, whether the target is destroyed, a turned shadow card, and its place among the attacks. */
export type ClashShape = { damage: number; destroyed: boolean; shadow: boolean; first: boolean; last: boolean };

/**
 * The pose of one attack at a time. Lengths here are shares (of a stroke, a card, the burn) or logical points (the shake), never
 * layout points: the layer turns a share into points with the stage (`strikeOffset`) and multiplies logical points by the UI scale.
 * The `...T` fields are ms since an effect began at Normal speed (-1 before it), so Quick plays the same picture.
 */
export type Frame = {
  // 0 at their slots, 1 at the center: the attackers (and the shadow card), and the target, which stays when it is destroyed.
  // Past 1 for a moment: the cards overshoot as they arrive.
  flyAttackers: number;
  flyTarget: number;
  // The whole attack's opacity (a later attack swaps in, an earlier one swaps out). The dark and the camera's push belong to the run
  // (`darkAt`, `punchAt`), not to one attack.
  fade: number;
  // The scale of the attack value and of the gauge: they pop in; the shields that held a blocked attack bounce (`badgeD` is theirs).
  badgeA: number;
  badgeD: number;
  // The attack has struck (from the impact on): the gauge shows the shields it broke.
  struck: boolean;
  // The attacker's pose, as `strikeOffset` reads it: how far it has drawn back (0..1), how far it has lunged (0..1), and how far
  // the block threw it back (0..1, a spring); and its tilt in radians.
  back: number;
  strike: number;
  recoil: number;
  tilt: number;
  // The target's knock-back (0..1, a spring) and its red tint (0..1).
  knock: number;
  tint: number;
  // The attacker's rim glow (0..1) and whether the afterimages show (1 during the lunge).
  charge: number;
  trail: number;
  // The flash opacity (at most 0.7; one bump per attack) and the shockwave ring: its radius as a share of a card's height and its opacity.
  flash: number;
  ring: { r: number; alpha: number };
  // The effect clocks, ms at Normal speed (-1 before): the feet bank's fog (the whole attack; it drifts on it), converging embers (from
  // the charge), sparks or deflection (from the impact), the sparks of the gauge's lit hearts (from the first token's landing) and ash
  // (from the burn). The fog's and the charge's clocks stand still through the hit stop.
  fogT: number;
  convergeT: number;
  sparkT: number;
  emberT: number;
  ashT: number;
  // The stage's trauma shake: x and y in logical points, the turn in radians.
  shakeX: number;
  shakeY: number;
  shakeTurn: number;
  // The damage number: its scale, opacity, and how far it has drifted up (0..1).
  number: { scale: number; alpha: number; rise: number };
  // The caption's result word ("1 damage", "Blocked", "Destroyed"; 0..1, spotlight/fx.ts, resultLook): it comes in at the impact
  // when the attack was blocked, else as the last damage token lands.
  result: number;
  // The shadow card's flip about its vertical axis (0 the back, pi the face) and the glint's sweep across it (0..1, 0 when off).
  flipAngle: number;
  glint: number;
  // How far a destroyed target has burned (0..1); the shader's threshold is burnThreshold(dissolve).
  dissolve: number;
  // The count in the target's damage corner: the last token has landed (it shows the new count), and its pop.
  landed: boolean;
  pop: number;
};

/** The ms between two damage tokens leaving the point of contact at a scale: 90, less when many would not land by the end of the impact (shorter on a kill). */
export function burstGap(count: number, k: number, destroyed = false): number {
  "worklet";
  if (count < 2) return 0;
  return Math.max(1, Math.min(length(MOTION.spotlightBurstStep, k), (impactLength(k, destroyed) - length(MOTION.spotlightBurstFly, k)) / (count - 1)));
}

// When damage token `index` of `count` lands, ms into the attack. Declared before the worklets that call it: the worklet transform
// makes each one a constant that captures what it calls, so a callee declared later is not there yet.
function tokenLandOf(index: number, count: number, destroyed: boolean, b: Beats, k: number): number {
  "worklet";
  return b.impactAt + index * burstGap(count, k, destroyed) + length(MOTION.spotlightBurstFly, k);
}

/** When the last damage token lands, ms into the attack; 0 when there is no damage. */
function landAt(damage: number, destroyed: boolean, b: Beats, k: number): number {
  "worklet";
  return damage > 0 ? tokenLandOf(damage - 1, damage, destroyed, b, k) : 0;
}

/** When damage token `index` of `count` lands in the target's corner, ms into its attack at a scale: the gauge lights its heart then. */
export function tokenLandAt(index: number, count: number, k: number, place: Place = { first: true, last: true }): number {
  "worklet";
  return tokenLandOf(index, count, place.destroyed === true, beatsAt(k, place), k);
}

// A spring kick `hit` ms after the impact: 0 before it, a short ramp to the peak, then back to 0 on the recoil spring.
function kick(hit: number, k: number): number {
  "worklet";
  if (hit <= 0) return 0;
  return (1 - springStep(hit, scaledSpring(MOTION.spotlightRecoil, k))) * clamp01(hit / length(MOTION.spotlightTrailStep, k));
}

/** The pose of one attack's cards at `t`. Before 0 or past the run it is the rest: nothing flown out. `seed` is the plan's (it seeds the shake). */
export function frameAt(shape: ClashShape, t: number, k: number, seed = 0): Frame {
  "worklet";
  const b = beatsAt(k, shape);
  const blocked = shape.damage === 0;
  const hit = t - b.impactAt;
  const goes = shape.last && t >= b.retAt;
  const leave = goes ? clamp01((t - b.retAt) / b.ret) : 0;
  const out = goes ? curve(MOTION.spotlightReturn, leave) : 0;
  const appear = curve(shape.first ? MOTION.spotlightEnter : MOTION.spotlightSwap, t / b.intro);
  // Only the first attack flies out from the slots; a later one is already in the middle of the dark table. The cards overshoot a little.
  const flyAttackers = goes ? 1 - out : shape.first ? Math.max(0, ease("outBack", t / b.intro)) : 1;
  const flyTarget = shape.destroyed && t >= b.retAt ? 1 : flyAttackers;
  const fade = (shape.first ? 1 : appear) * (shape.last ? 1 : 1 - clamp01((t - b.retAt) / b.exit));
  // What goes with the cards as they go back: the attack value, the gauge, the number and the result fade out over the first half of the return.
  const halfOut = goes ? 1 - clamp01((t - b.retAt) / (b.ret / 2)) : 1;

  const bounce = blocked && hit > 0 ? popScale(hit, k, SPOT.bounce, MOTION.spotlightNumberRise, 0, MOTION.spotlightNumberSettle) : 1;
  const badgeA = Math.max(0, ease("outBack", (t - b.readAt) / b.read)) * halfOut;
  const badgeD = badgeA * bounce;

  // The attacker draws back and tilts away (the charge), lunges to touch the target, is thrown back if it was blocked, and goes home with the rest.
  const chargeToken = shape.first ? MOTION.spotlightCharge : MOTION.spotlightChargeAgain;
  const build = t >= b.chargeAt ? curve(chargeToken, (t - b.chargeAt) / b.charge) : 0;
  const lunged = t >= b.lungeAt ? curve(MOTION.spotlightLunge, (t - b.lungeAt) / b.lunge) : 0;
  const kicked = kick(hit, k);
  const glow = build * (1 - clamp01(hit / length(MOTION.spotlightFlash, k)));

  // The shadow card turns over from the read on (about its vertical axis), and a glint sweeps across it as it shows its face.
  const flipLength = length(MOTION.spotlightFlip, k);
  const glintAt = (t - b.readAt - flipLength / 2) / length(MOTION.spotlightGlint, k);

  // The clocks of the feet bank's fog and the charge hold through the hit stop and carry on from where they stood.
  const running = t - clamp01((t - b.stopAt) / b.stop) * b.stop;
  const shaken = shakeAt(traumaStart(shape.damage, shape.destroyed), hit, k, seed);
  const num = shape.damage > 0 ? numberAt(hit, k) : { scale: 0, alpha: 0, rise: 0 };
  // A destroyed target burns for the burn token on the last attack; on an earlier one it burns as fast as the next attack swaps in.
  const burnLength = shape.last ? length(MOTION.spotlightBurn, k) : b.exit;
  const lands = landAt(shape.damage, shape.destroyed, b, k);
  const landed = shape.damage > 0 && t >= lands;
  const firstLand = shape.damage > 0 ? tokenLandOf(0, shape.damage, shape.destroyed, b, k) : -1;
  const resultAt = blocked ? hit : t - lands;
  return {
    flyAttackers,
    flyTarget,
    fade,
    badgeA,
    badgeD,
    struck: hit > 0,
    back: build * (1 - out),
    strike: lunged * (1 - out),
    recoil: blocked ? kicked : 0,
    tilt: -TILT * build * (1 - lunged),
    knock: kicked * (blocked ? SPOT.knockBlocked : 1),
    tint: !blocked && hit > 0 ? (1 - clamp01(hit / b.impact)) * (1 - clamp01(hit / b.impact)) : 0,
    charge: glow,
    trail: t >= b.lungeAt && t < b.stopAt ? 1 : 0,
    flash: flashAt((t - b.stopAt) / length(MOTION.spotlightFlash, k), blocked),
    ring: ringAt(hit / length(MOTION.spotlightRing, k)),
    fogT: t >= 0 ? running / k : -1,
    convergeT: t >= b.chargeAt ? (running - b.chargeAt) / k : -1,
    sparkT: hit >= 0 ? hit / k : -1,
    emberT: firstLand >= 0 && t >= firstLand ? (t - firstLand) / k : -1,
    ashT: shape.destroyed && t >= b.retAt ? (t - b.retAt) / k : -1,
    shakeX: shaken.x,
    shakeY: shaken.y,
    shakeTurn: shaken.turn,
    number: { scale: num.scale, alpha: num.alpha * halfOut, rise: num.rise },
    result: resultAt > 0 ? clamp01(resultAt / length(MOTION.spotlightResult, k)) * halfOut : 0,
    flipAngle: shape.shadow ? Math.PI * curve(MOTION.spotlightFlip, (t - b.readAt) / flipLength) : 0,
    glint: shape.shadow && glintAt > 0 && glintAt < 1 ? glintAt : 0,
    dissolve: shape.destroyed && t >= b.retAt ? curve(MOTION.spotlightBurn, (t - b.retAt) / burnLength) : 0,
    landed,
    pop: landed ? tokenPopScale(t - landAt(shape.damage, shape.destroyed, b, k), k) : 1,
  };
}

/**
 * Afterimage `j` (1 to TRAIL) of the attacker during the lunge: the pose the same clock read `j` trail steps ago, and its opacity
 * (0 outside the lunge, where it is not worked out; fainter the older it is).
 */
export function trailAt(shape: ClashShape, t: number, k: number, j: number): { back: number; strike: number; tilt: number; alpha: number } {
  "worklet";
  const b = beatsAt(k, shape);
  // Outside the lunge there is no afterimage: nothing is worked out for it.
  if (t < b.lungeAt || t >= b.stopAt) return { back: 0, strike: 0, tilt: 0, alpha: 0 };
  const then = frameAt(shape, t - j * length(MOTION.spotlightTrailStep, k), k);
  return { back: then.back, strike: then.strike, tilt: then.tilt, alpha: 0.5 * (1 - (j - 1) / TRAIL) };
}

/** One damage token on its way from the point of contact to the target's corner: how far (0..1), and whether it is in the air. */
export function burstAt(index: number, count: number, t: number, k: number, place: Place = { first: true, last: true }): { u: number; flying: boolean } {
  "worklet";
  const b = beatsAt(k, place);
  const start = b.impactAt + index * burstGap(count, k, place.destroyed === true);
  const fly = length(MOTION.spotlightBurstFly, k);
  const x = (t - start) / fly;
  return { u: curve(MOTION.spotlightBurstFly, x), flying: x >= 0 && x < 1 };
}

/** The dark over the screen, 0..1 of its opacity, `t` ms into a run of `count` attacks: in over the first enter, out over the last return. */
export function darkAt(t: number, k: number, count: number): number {
  "worklet";
  const first = beatsAt(k, placeOf(0, count));
  if (t < first.intro) return curve(MOTION.spotlightEnter, t / first.intro);
  const last = runStart(count - 1, count, k) + beatsAt(k, placeOf(count - 1, count)).retAt;
  if (t >= last) return 1 - clamp01((t - last) / length(MOTION.spotlightReturn, k));
  return 1;
}

/** The camera's scale, `t` ms into a run of `count` attacks: it pushes in over the first charge, holds, and lets go over the last return. */
export function punchAt(t: number, k: number, count: number): number {
  "worklet";
  const first = beatsAt(k, placeOf(0, count));
  const push = cameraPush(t >= first.chargeAt ? curve(MOTION.spotlightCharge, (t - first.chargeAt) / first.charge) : 0);
  const last = runStart(count - 1, count, k) + beatsAt(k, placeOf(count - 1, count)).retAt;
  return 1 + (push - 1) * (t >= last ? 1 - clamp01((t - last) / length(MOTION.spotlightReturn, k)) : 1);
}
