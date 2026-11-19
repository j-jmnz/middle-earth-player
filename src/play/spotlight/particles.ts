// The combat spotlight's particles as closed-form arithmetic (docs/design-system-table.md, Spotlight). Pure and worklet-safe:
// `particleAt` works one sprite's pose out from its index, its seed and a time alone (no per-frame state), so the UI thread
// evaluates a whole emitter from one clock and a Vitest reads it. Positions are screen points; every length is a share of `at.size`
// (the height of the card the effect belongs to), so the effect scales with the stage. `t` is ms since the emitter began, at
// Normal speed (the beats hand it over unscaled, so Quick plays the same picture faster).
import { MOTION } from "../../ui/motion-tokens.ts";
import { burnField, burnFront } from "./burn.ts";
import { SPOT } from "./shape.ts";

export type ParticleKind = "converge" | "spark" | "deflect" | "ember" | "ash";

/**
 * How many sprites each kind has. A charge, a strike (sparks or deflection), the sparks of the gauge's lit hearts and a burn come one
 * after another; the heart sparks share the glow draw with the converging embers, which are out by then.
 */
export const PARTICLE_COUNT: Readonly<Record<ParticleKind, number>> = { converge: 16, spark: 28, deflect: 18, ember: SPOT.embers, ash: 36 };

/** The most sprites visible at once (a strike and the ash of a kill) and the Atlas draw each kind goes in: glow, sparks, ash. All are added to the picture. */
export const PARTICLE_BUDGET = 70;
export const PARTICLE_DRAW: Readonly<Record<ParticleKind, number>> = { converge: 0, spark: 1, deflect: 1, ember: 0, ash: 2 };
export const ATLAS_DRAWS = 3;

// How long sprites live, as shares of the tokens that say so (src/ui/motion-tokens.ts): a converging ember is born within the first 0.24 of its flight and lives 0.64 to 1 of it; a spark lives 2/3 to
// 14/15 of the sparks' token and a deflection 11/15 to 1 of it; an ash lives 7/11 to 1 of the ash token.
const CONVERGE = { born: 0.24, life: 0.64, spread: 0.36 };
const ASH_LIFE = { life: 7 / 11, spread: 4 / 11 };
const SPARK_LIFE = { spark: 2 / 3, deflect: 11 / 15, spread: 4 / 15 };

/** The ms (at Normal) after which no sprite of a kind shows, for an ash burn of `burnMs` (a heart spark: the last heart's, at most). */
export function particleEnd(kind: ParticleKind, burnMs: number): number {
  "worklet";
  if (kind === "converge") return MOTION.spotlightConverge.ms * (1 + CONVERGE.born);
  if (kind === "ember") return (SPOT.embers - 1) * MOTION.spotlightBurstStep.ms + MOTION.spotlightEmber.ms;
  if (kind === "ash") return burnMs + MOTION.spotlightAsh.ms;
  return MOTION.spotlightSparks.ms;
}

/**
 * Where an effect is: its anchor point, the length it scales with, and its direction in radians (sparks and deflection; 0 points right).
 * `w` is the width of the card the ash rises from. Heart sparks rise from each of `xs` in turn (at `y`), `gap` ms apart at Normal (the
 * damage tokens' landings), `per` from each; with no `xs`, from `x` alone.
 */
export type Anchor = { x: number; y: number; size: number; dir?: number; w?: number; xs?: readonly number[]; gap?: number; per?: number };

/** How many sparks rise from each lit heart when `hearts` of them light: 3, fewer when that would pass 9 in all. */
export function emberPer(hearts: number): number {
  "worklet";
  return hearts <= 0 ? 0 : Math.max(1, Math.min(SPOT.emberPer, Math.floor(SPOT.embers / hearts)));
}

export type Particle = { x: number; y: number; turn: number; scale: number; alpha: number };

const NONE: Particle = { x: 0, y: 0, turn: 0, scale: 0, alpha: 0 };
const TAU = Math.PI * 2;

/** A number in [0, 1) from an index and a seed (an integer hash with `Math.imul`, so it is the same on every JavaScript engine). */
export function hash(i: number, seed: number): number {
  "worklet";
  let h = Math.imul((i | 0) + 1, 0x9e3779b1) ^ Math.imul((seed | 0) + 0x7f4a7c15, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// The `channel`th random number of particle `i`.
function rnd(i: number, channel: number, seed: number): number {
  "worklet";
  return hash(i * 8 + channel, seed);
}

/** The card position (shares of its width and height, 0..1) ash number `i` rises from. */
export function ashCell(i: number, seed: number): { u: number; v: number } {
  "worklet";
  return { u: 0.08 + 0.84 * rnd(i, 0, seed), v: 0.08 + 0.84 * rnd(i, 1, seed) };
}

/** When ash number `i` is born, ms after the burn begins at Normal: the moment the burn front passes its cell (spotlight/burn.ts). */
export function ashBirth(i: number, seed: number, burnMs: number): number {
  "worklet";
  const cell = ashCell(i, seed);
  return burnFront(burnField(cell.u, cell.v, seed)) * burnMs;
}

/**
 * Sprite `i` of a kind at `t` ms. `converge` flies in from a ring around the point to it;
 * `spark` flies out from the point with drag and gravity, its streak turned along its velocity; `deflect` is a cone of the same
 * back along `at.dir`; `ember` rises from a lit heart of the gauge as its token lands, drifting a little; `ash` rises from the card cell
 * the burn front has just passed. Alpha is 0 before the sprite is born and after it dies.
 */
export function particleAt(kind: ParticleKind, i: number, t: number, seed: number, at: Anchor, burnMs: number): Particle {
  "worklet";
  if (t < 0 || i < 0 || i >= PARTICLE_COUNT[kind]) return NONE;
  const size = at.size;
  const dir = at.dir ?? 0;
  if (kind === "converge") {
    const flight = MOTION.spotlightConverge.ms;
    const born = rnd(i, 0, seed) * CONVERGE.born * flight;
    const life = (CONVERGE.life + CONVERGE.spread * rnd(i, 1, seed)) * flight;
    const age = (t - born) / life;
    if (age < 0 || age >= 1) return NONE;
    const angle = TAU * rnd(i, 2, seed);
    const reach = (0.55 + 0.35 * rnd(i, 3, seed)) * size;
    const pull = age * age;
    return { x: at.x + Math.cos(angle) * reach * (1 - pull), y: at.y + Math.sin(angle) * reach * (1 - pull) * 1.2, turn: angle, scale: 0.3 + 0.3 * rnd(i, 4, seed), alpha: Math.sin(Math.PI * Math.min(1, age * 0.9 + 0.1)) };
  }
  if (kind === "ember") {
    const xs = at.xs ?? [at.x];
    const per = at.per ?? emberPer(xs.length);
    const heart = per > 0 ? Math.floor(i / per) : xs.length;
    if (heart >= xs.length) return NONE;
    const born = heart * (at.gap ?? 0) + rnd(i, 0, seed) * 60;
    const life = (0.7 + 0.3 * rnd(i, 1, seed)) * MOTION.spotlightEmber.ms;
    const age = (t - born) / life;
    if (age < 0 || age >= 1) return NONE;
    const side = (rnd(i, 2, seed) - 0.5) * 0.08 * size;
    return { x: (xs[heart] ?? at.x) + side + Math.sin(TAU * (age * 0.8 + rnd(i, 3, seed))) * 0.012 * size, y: at.y - age * (0.12 + 0.08 * rnd(i, 4, seed)) * size, turn: 0, scale: 0.22 + 0.14 * rnd(i, 5, seed), alpha: Math.sin(Math.PI * Math.min(1, age * 1.1 + 0.05)) };
  }
  if (kind === "ash") {
    const born = ashBirth(i, seed, burnMs);
    const life = (ASH_LIFE.life + ASH_LIFE.spread * rnd(i, 2, seed)) * MOTION.spotlightAsh.ms;
    const age = (t - born) / life;
    if (age < 0 || age >= 1) return NONE;
    const cell = ashCell(i, seed);
    const w = at.w ?? size * 0.72;
    return { x: at.x + (cell.u - 0.5) * w + Math.sin(TAU * (age * 0.7 + rnd(i, 3, seed))) * 0.05 * size, y: at.y + (cell.v - 0.5) * size - age * (0.35 + 0.35 * rnd(i, 4, seed)) * size, turn: age * 2 * (rnd(i, 5, seed) - 0.5), scale: 0.3 + 0.3 * rnd(i, 6, seed), alpha: 0.8 * Math.sin(Math.PI * Math.min(1, age * 1.2)) * (1 - age * 0.4) };
  }
  // spark and deflect: a burst from the point with drag and a little gravity, in closed form.
  const deflect = kind === "deflect";
  const life = ((deflect ? SPARK_LIFE.deflect : SPARK_LIFE.spark) + SPARK_LIFE.spread * rnd(i, 0, seed)) * MOTION.spotlightSparks.ms;
  const age = t / life;
  if (age >= 1) return NONE;
  const spread = deflect ? 0.65 : Math.PI * 0.9;
  const angle = dir + (rnd(i, 1, seed) - 0.5) * spread;
  const speed = (deflect ? 1.7 : 2.6) * (0.45 + 0.55 * rnd(i, 2, seed)) * size;
  const drag = 4.2;
  const gravity = deflect ? 0.4 * size : 1.6 * size;
  const sec = t / 1000;
  const run = (1 - Math.exp(-drag * sec)) / drag;
  const vx = Math.cos(angle) * speed * Math.exp(-drag * sec);
  const vy = Math.sin(angle) * speed * Math.exp(-drag * sec) + gravity * run;
  const fall = (sec - run) / drag;
  const fast = Math.min(1, Math.hypot(vx, vy) / (speed + 1e-6));
  return { x: at.x + Math.cos(angle) * speed * run, y: at.y + Math.sin(angle) * speed * run + gravity * fall, turn: Math.atan2(vy, vx), scale: (0.45 + 0.9 * fast) * (0.6 + 0.4 * rnd(i, 3, seed)), alpha: Math.pow(1 - age, 1.5) };
}

/** How many sprites of a kind show (alpha above 0) at `t`. */
export function visibleCount(kind: ParticleKind, t: number, seed: number, at: Anchor, burnMs: number): number {
  let shown = 0;
  for (let i = 0; i < PARTICLE_COUNT[kind]; i += 1) if (particleAt(kind, i, t, seed, at, burnMs).alpha > 0) shown += 1;
  return shown;
}
