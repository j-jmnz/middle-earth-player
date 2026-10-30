// The combat spotlight's particles laid out for Skia's Atlas (docs/plans/done/combat-spotlight-redesign.md, §4 and §5). Three draws, each
// one buffer of sprites (spotlight-particles.ts, PARTICLE_DRAW): the glow (embers, then the charge's converging embers), the streaks
// (sparks, or the silver deflection of a block) and the ash. `spriteAt` works one slot's transform and color out from a time alone, so the
// UI thread fills the buffers (useRSXformBuffer, useColorBuffer) from the frame; a slot with nothing alive has alpha 0. Pure and worklet-safe.
import { PARTICLE_COUNT, particleAt, particleEnd, type Anchor, type ParticleKind } from "./spotlight-particles.ts";

/** The sprite texture: a soft dot on the left, a streak (bright head at the right) on the right, each a `CELL` square. */
export const CELL = 64;
export const TEXTURE = { width: 2 * CELL, height: CELL } as const;

/** The slots of each draw: the glow holds embers then converging embers, the streaks the larger of sparks and deflection, the ash its own. */
export const ATLAS_SLOTS: readonly [number, number, number] = [PARTICLE_COUNT.ember + PARTICLE_COUNT.converge, Math.max(PARTICLE_COUNT.spark, PARTICLE_COUNT.deflect), PARTICLE_COUNT.ash];
/** The texture cell each draw reads: 0 the dot, 1 the streak. */
export const ATLAS_CELL: readonly [number, number, number] = [0, 1, 0];

// The size of a sprite at scale 1, as a share of the anchor's size (a card's height): the dot's width and the streak's length.
const DOT = 0.1;
const STREAK = 0.17;

// Colors, as linear 0..1 triples: warm for fire (the burn's hot color), silver for the players' and a block's, ash dimmer.
const WARM: Rgb = [1, 0.78, 0.4];
const SILVER: Rgb = [0.82, 0.88, 0.92];
const ASH: Rgb = [0.78, 0.42, 0.22];
type Rgb = readonly [number, number, number];

/** A "#RRGGBB" color as a 0..1 triple. */
export function rgbOf(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

/** What the emitters are: the anchors (screen points), whether the attack was blocked, the plan's seed, the burn's length, and the rim color of the charge. */
export type Emitters = { seed: number; burnMs: number; blocked: boolean; ember: Anchor; converge: Anchor; hit: Anchor; ash: Anchor; rim: Rgb };

/**
 * The effect clocks of a frame (ms since each began at Normal speed, -1 before) and the dark's ramp (0..1, the run's `darkAt`): the glow
 * draw fades with the dark, so the embers go out with it as the cards go back and do not pop off when the layer unmounts.
 */
export type Times = { emberT: number; convergeT: number; sparkT: number; ashT: number; dark: number };

/** One Atlas slot: the RSXform (`scos`, `ssin`, `tx`, `ty`) and the color's red, green, blue and alpha. */
export type Slot = { scos: number; ssin: number; tx: number; ty: number; r: number; g: number; b: number; a: number };

const NONE: Slot = { scos: 0, ssin: 0, tx: 0, ty: 0, r: 0, g: 0, b: 0, a: 0 };

/** Whether anything in a draw can show at these clocks: a draw that cannot is left empty without working a sprite out. */
export function drawLive(draw: number, times: Times, e: Emitters): boolean {
  "worklet";
  if (draw === 0) return (times.emberT >= 0 || times.convergeT >= 0) && times.dark > 0;
  if (draw === 1) return times.sparkT >= 0 && times.sparkT < particleEnd(e.blocked ? "deflect" : "spark", e.burnMs);
  return times.ashT >= 0 && times.ashT < particleEnd("ash", e.burnMs);
}

/** Slot `i` of draw `draw` (0 glow, 1 streaks, 2 ash) at the given clocks. */
export function spriteAt(draw: number, i: number, times: Times, e: Emitters): Slot {
  "worklet";
  let kind: ParticleKind;
  let index = i;
  let t: number;
  let at: Anchor;
  let rgb: Rgb;
  if (draw === 0) {
    const embers = PARTICLE_COUNT.ember;
    kind = i < embers ? "ember" : "converge";
    index = i < embers ? i : i - embers;
    t = kind === "ember" ? times.emberT : times.convergeT;
    at = kind === "ember" ? e.ember : e.converge;
    rgb = kind === "ember" ? WARM : e.rim;
  } else if (draw === 1) {
    kind = e.blocked ? "deflect" : "spark";
    t = times.sparkT;
    at = e.hit;
    rgb = e.blocked ? SILVER : WARM;
  } else {
    kind = "ash";
    t = times.ashT;
    at = e.ash;
    rgb = ASH;
  }
  const p = particleAt(kind, index, t, e.seed, at, e.burnMs);
  if (p.alpha <= 0 || p.scale <= 0) return NONE;
  const streak = draw === 1;
  // The sprite's center is its cell's center: the transform turns it about there and puts that point at (p.x, p.y).
  const scale = (p.scale * (streak ? STREAK : DOT) * at.size) / CELL;
  const turn = streak ? p.turn : 0;
  const scos = scale * Math.cos(turn);
  const ssin = scale * Math.sin(turn);
  const half = CELL / 2;
  // The glow draw (embers) fades with the dark.
  const a = draw === 0 ? p.alpha * times.dark : p.alpha;
  return { scos, ssin, tx: p.x - (scos * half - ssin * half), ty: p.y - (ssin * half + scos * half), r: rgb[0], g: rgb[1], b: rgb[2], a };
}
