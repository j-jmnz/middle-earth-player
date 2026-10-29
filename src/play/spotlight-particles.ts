// The combat spotlight's particles as closed-form arithmetic (docs/plans/combat-spotlight-redesign.md, §4). Pure and worklet-safe:
// `particleAt` works one sprite's pose out from its index, its seed and a time alone (no per-frame state), so the UI thread
// evaluates a whole emitter from one clock and a Vitest reads it. Positions are screen points; every length is a share of `at.size`
// (the height of the card the effect belongs to), so the effect scales with the stage. `t` is ms since the emitter began, at
// Normal speed (the beats hand it over unscaled, so Quick plays the same picture faster).
import { burnField, burnFront } from "./spotlight-burn.ts";

export type ParticleKind = "ember" | "converge" | "spark" | "deflect" | "ash";

/** How many sprites each kind has. Embers run the whole attack; a charge, a strike (sparks or deflection) and a burn come one after another. */
export const PARTICLE_COUNT: Readonly<Record<ParticleKind, number>> = { ember: 24, converge: 16, spark: 28, deflect: 18, ash: 36 };

/** The most sprites visible at once (embers, a strike, and the ash of a kill) and the Atlas draw each kind goes in: glow, sparks, ash. */
export const PARTICLE_BUDGET = 90;
export const PARTICLE_DRAW: Readonly<Record<ParticleKind, number>> = { ember: 0, converge: 0, spark: 1, deflect: 1, ash: 2 };
export const ATLAS_DRAWS = 3;

/** How long each kind's sprite lives, ms at Normal, at most (the slowest sprite). */
export const PARTICLE_LIFE: Readonly<Record<ParticleKind, number>> = { ember: 2000, converge: 520, spark: 450, deflect: 450, ash: 1100 };

/** Where an effect is: its anchor point, the length it scales with, and its direction in radians (sparks and deflection; 0 points right). `w` is the width of the card the ash rises from. */
export type Anchor = { x: number; y: number; size: number; dir?: number; w?: number };

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

/** When ash number `i` is born, ms after the burn begins at Normal: the moment the burn front passes its cell (spotlight-burn.ts). */
export function ashBirth(i: number, seed: number, burnMs: number): number {
  "worklet";
  const cell = ashCell(i, seed);
  return burnFront(burnField(cell.u, cell.v, seed)) * burnMs;
}

/**
 * Sprite `i` of a kind at `t` ms. `ember` drifts up around the point, looping; `converge` flies in from a ring around the point to it;
 * `spark` flies out from the point with drag and gravity, its streak turned along its velocity; `deflect` is a cone of the same
 * back along `at.dir`; `ash` rises from the card cell the burn front has just passed. Alpha is 0 before the sprite is born and after it dies.
 */
export function particleAt(kind: ParticleKind, i: number, t: number, seed: number, at: Anchor, burnMs = 450): Particle {
  "worklet";
  if (t < 0 || i < 0 || i >= PARTICLE_COUNT[kind]) return NONE;
  const size = at.size;
  const dir = at.dir ?? 0;
  if (kind === "ember") {
    const born = rnd(i, 0, seed) * 800;
    const life = 1200 + 800 * rnd(i, 1, seed);
    if (t < born) return NONE;
    const age = ((t - born) % life) / life;
    const x0 = (rnd(i, 2, seed) - 0.5) * 1.6 * size;
    const y0 = (rnd(i, 3, seed) - 0.2) * 0.9 * size;
    const sway = Math.sin(TAU * (age + rnd(i, 4, seed))) * 0.04 * size;
    return { x: at.x + x0 + sway, y: at.y + y0 - age * 0.55 * size, turn: 0, scale: 0.35 + 0.35 * rnd(i, 5, seed), alpha: 0.85 * Math.sin(Math.PI * age) };
  }
  if (kind === "converge") {
    const born = rnd(i, 0, seed) * 120;
    const life = 320 + 200 * rnd(i, 1, seed);
    const age = (t - born) / life;
    if (age < 0 || age >= 1) return NONE;
    const angle = TAU * rnd(i, 2, seed);
    const reach = (0.55 + 0.35 * rnd(i, 3, seed)) * size;
    const pull = age * age;
    return { x: at.x + Math.cos(angle) * reach * (1 - pull), y: at.y + Math.sin(angle) * reach * (1 - pull) * 1.2, turn: angle, scale: 0.3 + 0.3 * rnd(i, 4, seed), alpha: Math.sin(Math.PI * Math.min(1, age * 0.9 + 0.1)) };
  }
  if (kind === "ash") {
    const born = ashBirth(i, seed, burnMs);
    const life = 700 + 400 * rnd(i, 2, seed);
    const age = (t - born) / life;
    if (age < 0 || age >= 1) return NONE;
    const cell = ashCell(i, seed);
    const w = at.w ?? size * 0.72;
    return { x: at.x + (cell.u - 0.5) * w + Math.sin(TAU * (age * 0.7 + rnd(i, 3, seed))) * 0.05 * size, y: at.y + (cell.v - 0.5) * size - age * (0.35 + 0.35 * rnd(i, 4, seed)) * size, turn: age * 2 * (rnd(i, 5, seed) - 0.5), scale: 0.3 + 0.3 * rnd(i, 6, seed), alpha: 0.8 * Math.sin(Math.PI * Math.min(1, age * 1.2)) * (1 - age * 0.4) };
  }
  // spark and deflect: a burst from the point with drag and a little gravity, in closed form.
  const deflect = kind === "deflect";
  const life = (deflect ? 330 : 300) + 120 * rnd(i, 0, seed);
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
export function visibleCount(kind: ParticleKind, t: number, seed: number, at: Anchor, burnMs = 450): number {
  let shown = 0;
  for (let i = 0; i < PARTICLE_COUNT[kind]; i += 1) if (particleAt(kind, i, t, seed, at, burnMs).alpha > 0) shown += 1;
  return shown;
}
