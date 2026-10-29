// The combat spotlight's effect curves (docs/plans/combat-spotlight-redesign.md, §4): the flash, the shockwave ring, the stamp, the
// trauma shake (Eiserloh's model), the damage number's pop and the camera push. Pure arithmetic on a time, worklet-safe (the
// functions marked "worklet" run on the UI thread; in Node the directive is an unused string); spotlight-beats.ts reads them into a
// frame. Lengths are logical points (the layer multiplies by the UI scale) or shares of a card's height.
import { clamp01, ease, length, popScale } from "./motion-curves.ts";
import { MOTION } from "./motion-tokens.ts";
import { hash } from "./spotlight-particles.ts";
import { SPOT } from "./spotlight-shape.ts";

export const FX = {
  // The flash: its peak opacity (warm white, over the target only), its radius as a share of a card's height, how much of the peak a
  // blocked attack keeps, and the share of its length it takes to reach the peak.
  flashPeak: 0.7,
  flashRadius: 0.55,
  flashBlocked: 0.6,
  flashRise: 0.12,
  // The shake's limits: 9 pt and 1.2 degrees at full trauma. Trauma starts at `base` plus `perDamage` for each damage (at most 1),
  // 1 on a kill and `blocked` when the attack was blocked, and falls by 1 over the shake's length.
  shakeMax: 9,
  shakeTurn: (1.2 * Math.PI) / 180,
  traumaBase: 0.55,
  traumaPerDamage: 0.12,
  traumaKill: 1,
  traumaBlocked: 0.35,
  // The camera pushes in to this scale over the charge.
  push: 1.06,
  // The ring: it starts at this share of a card's height in radius and grows by `ringGrow` more.
  ringStart: 0.15,
  ringGrow: 0.75,
} as const;

/** The flash opacity `u` (0..1) of the way through the flash: a quick rise to the peak, then a quadratic fall to 0. One bump per attack. */
export function flashAt(u: number, blocked: boolean): number {
  "worklet";
  if (u <= 0 || u >= 1) return 0;
  const peak = FX.flashPeak * (blocked ? FX.flashBlocked : 1);
  if (u < FX.flashRise) return (peak * u) / FX.flashRise;
  const down = 1 - (u - FX.flashRise) / (1 - FX.flashRise);
  return peak * down * down;
}

/** The shockwave ring `u` (0..1) of the way through: its radius as a share of a card's height, and its opacity. */
export function ringAt(u: number): { r: number; alpha: number } {
  "worklet";
  if (u <= 0 || u >= 1) return { r: 0, alpha: 0 };
  const fall = 1 - u;
  return { r: FX.ringStart + FX.ringGrow * ease("outCubic", u), alpha: 0.9 * fall * Math.sqrt(fall) };
}

/** A stamp ("Blocked", "Destroyed") at progress `p` (0..1, the frame's `stamp`): it lands from 1.35 down to 1 as it fades in. */
export function stampLook(p: number): { scale: number; alpha: number } {
  "worklet";
  const x = clamp01(p);
  return { scale: 1 + 0.35 * (1 - ease("outCubic", x)), alpha: Math.min(1, x * 1.6) };
}

/** The trauma an attack starts with: 0.55 plus 0.12 for each damage (at most 1), 1 on a kill, 0.35 when it was blocked. */
export function traumaStart(damage: number, destroyed: boolean): number {
  "worklet";
  if (destroyed) return FX.traumaKill;
  if (damage <= 0) return FX.traumaBlocked;
  return Math.min(1, FX.traumaBase + FX.traumaPerDamage * damage);
}

/** The trauma `u` of the way through the shake (0..1 over its length): `start` less `u`, and never under 0. */
export function traumaAt(start: number, u: number): number {
  "worklet";
  return Math.max(0, start - Math.max(0, u));
}

// A smooth seeded wobble in [-1, 1]: two sines of seeded frequency and phase, `sec` seconds in, for one axis.
function wobble(sec: number, seed: number, axis: number): number {
  "worklet";
  const first = 2 * Math.PI * (14 + 6 * hash(axis * 4 + 1, seed)) * sec + 2 * Math.PI * hash(axis * 4 + 2, seed);
  const second = 2 * Math.PI * (23 + 9 * hash(axis * 4 + 3, seed)) * sec + 2 * Math.PI * hash(axis * 4 + 4, seed);
  return (Math.sin(first) + 0.5 * Math.sin(second)) / 1.5;
}

/**
 * The stage's shake `hit` ms after the impact (at Normal speed, so Quick plays the same picture): the offset in points
 * (max · trauma² · wobble) and the turn in radians, from this attack's seed. Zero before the impact and once the trauma is spent.
 */
export function shakeAt(start: number, hit: number, k: number, seed: number): { x: number; y: number; turn: number } {
  "worklet";
  if (hit <= 0) return { x: 0, y: 0, turn: 0 };
  const trauma = traumaAt(start, hit / length(MOTION.spotlightShake, k));
  const power = trauma * trauma;
  const sec = hit / k / 1000;
  return { x: FX.shakeMax * power * wobble(sec, seed, 0), y: FX.shakeMax * power * wobble(sec, seed, 1), turn: FX.shakeTurn * power * wobble(sec, seed, 2) };
}

/** The damage number `hit` ms after the impact (scaled by `k`): it pops in on `popScale` (to 1.4, then a spring settle), fades in, and drifts up. */
export function numberAt(hit: number, k: number): { scale: number; alpha: number; rise: number } {
  "worklet";
  if (hit <= 0) return { scale: 0, alpha: 0, rise: 0 };
  const alpha = clamp01(hit / length(MOTION.spotlightNumberRise, k));
  return {
    scale: popScale(hit, k, SPOT.numberPeak, MOTION.spotlightNumberRise, 0, MOTION.spotlightNumberSettle) * (0.6 + 0.4 * alpha),
    alpha,
    rise: ease("outCubic", hit / length(MOTION.spotlightImpact, k)),
  };
}

/** The camera's push-in `x` (0..1) of the way through the charge: 1 at 0, 1.06 at 1. */
export function cameraPush(x: number): number {
  "worklet";
  return 1 + (FX.push - 1) * clamp01(x);
}
