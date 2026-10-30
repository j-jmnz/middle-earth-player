// The combat spotlight's particles laid out for Skia's Atlas (docs/plans/done/combat-spotlight-redesign.md, §4 and §5). Two draws, each
// one buffer of sprites (spotlight-particles.ts, PARTICLE_DRAW): the streaks (sparks, or the silver deflection of a block) and the ash.
// `spriteAt` works one slot's transform and color out from a time alone, so the UI thread fills the buffers (useRSXformBuffer,
// useColorBuffer) from the frame; a slot with nothing alive has alpha 0. Pure and worklet-safe.
import { PARTICLE_COUNT, particleAt, particleEnd, type Anchor, type ParticleKind } from "./spotlight-particles.ts";

/** The sprite texture: a soft dot on the left, a streak (bright head at the right) on the right, each a `CELL` square. */
export const CELL = 64;
export const TEXTURE = { width: 2 * CELL, height: CELL } as const;

/** The slots of each draw: the streaks the larger of sparks and deflection, the ash its own. */
export const ATLAS_SLOTS: readonly [number, number] = [Math.max(PARTICLE_COUNT.spark, PARTICLE_COUNT.deflect), PARTICLE_COUNT.ash];
/** The texture cell each draw reads: 0 the dot, 1 the streak. */
export const ATLAS_CELL: readonly [number, number] = [1, 0];

// The size of a sprite at scale 1, as a share of the anchor's size (a card's height): the dot's width and the streak's length.
const DOT = 0.1;
const STREAK = 0.17;

// Colors, as linear 0..1 triples: warm for fire (the burn's hot color), silver for a block's, ash dimmer.
const WARM: Rgb = [1, 0.78, 0.4];
const SILVER: Rgb = [0.82, 0.88, 0.92];
const ASH: Rgb = [0.78, 0.42, 0.22];
type Rgb = readonly [number, number, number];

/** What the emitters are: the anchors (screen points), whether the attack was blocked, the plan's seed and the burn's length. */
export type Emitters = { seed: number; burnMs: number; blocked: boolean; hit: Anchor; ash: Anchor };

/** The effect clocks of a frame: ms since each began at Normal speed, -1 before. */
export type Times = { sparkT: number; ashT: number };

/** One Atlas slot: the RSXform (`scos`, `ssin`, `tx`, `ty`) and the color's red, green, blue and alpha. */
export type Slot = { scos: number; ssin: number; tx: number; ty: number; r: number; g: number; b: number; a: number };

const NONE: Slot = { scos: 0, ssin: 0, tx: 0, ty: 0, r: 0, g: 0, b: 0, a: 0 };

/** Whether anything in a draw can show at these clocks: a draw that cannot is left empty without working a sprite out. */
export function drawLive(draw: number, times: Times, e: Emitters): boolean {
  "worklet";
  if (draw === 0) return times.sparkT >= 0 && times.sparkT < particleEnd(e.blocked ? "deflect" : "spark", e.burnMs);
  return times.ashT >= 0 && times.ashT < particleEnd("ash", e.burnMs);
}

/** Slot `i` of draw `draw` (0 streaks, 1 ash) at the given clocks. */
export function spriteAt(draw: number, i: number, times: Times, e: Emitters): Slot {
  "worklet";
  const streak = draw === 0;
  const kind: ParticleKind = streak ? (e.blocked ? "deflect" : "spark") : "ash";
  const at: Anchor = streak ? e.hit : e.ash;
  const strike = e.blocked ? SILVER : WARM;
  const rgb: Rgb = streak ? strike : ASH;
  const p = particleAt(kind, i, streak ? times.sparkT : times.ashT, e.seed, at, e.burnMs);
  if (p.alpha <= 0 || p.scale <= 0) return NONE;
  // The sprite's center is its cell's center: the transform turns it about there and puts that point at (p.x, p.y).
  const scale = (p.scale * (streak ? STREAK : DOT) * at.size) / CELL;
  const turn = streak ? p.turn : 0;
  const scos = scale * Math.cos(turn);
  const ssin = scale * Math.sin(turn);
  const half = CELL / 2;
  return { scos, ssin, tx: p.x - (scos * half - ssin * half), ty: p.y - (ssin * half + scos * half), r: rgb[0], g: rgb[1], b: rgb[2], a: p.alpha };
}
