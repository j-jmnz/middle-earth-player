// The combat spotlight's black fog (docs/design-system-table.md, Spotlight; user request, 2026-11-04: the spotlight's shadow looks like
// the backdrop's fog, but black). The same banks the screens' backdrops draw (src/ui/fog/fog.ts), in the night and a soot grey crest:
// the dark is a light flat dark under banks that are dense at the screen's edges and clear around the stage, and a low bank lies along
// the cards' feet of each attack, rising and swelling a little as the dark comes in. Pure data and arithmetic; spotlight/fog.native.tsx
// draws it.
import { banks, type FogLayer, type FogSet, type FogTexture } from "../../ui/fog/fog.ts";
import { SPOT } from "./shape.ts";

// The night for the haze and the banks, a soot grey for the crest so a bank keeps a lit edge. They drift faster than the backdrop's
// fog (2 and 5 pt a second), so the fog rolls visibly over an attack of a few seconds.
const blackHaze: FogTexture = { freq: [0.003, 0.004], octaves: 2, seed: 13, rgb: [2, 3, 4], gain: 1.4, bias: -0.3, tile: [1200, 900], drift: 4, bake: 0.5 };
const blackBank: FogTexture = { freq: [0.009, 0.012], octaves: 3, seed: 17, rgb: [3, 4, 5], gain: 3, bias: -1.12, tile: [900, 900], drift: 10 };
const blackCrest: FogTexture = { ...blackBank, rgb: [46, 52, 50], gain: 6, bias: -3.75, offset: [0, -3] };
export const BLACK_FOG: FogSet = { haze: blackHaze, bank: blackBank, crest: blackCrest };

export const SPOT_FOG = {
  // The flat dark under the fog at full dark, by the screen's theme: the Light theme's parchment needs more of it to read as the same
  // dark stage (the layer draws with the Dark tokens on either theme).
  flat: { dark: 0.4, light: 0.7 },
  // The rim: the night from `rimFrom` of the ellipse's radius (75% of the width, 85% of the height, about the stage's middle) to
  // `rim` at its edge.
  rim: 0.75,
  rimFrom: 0.7,
  // The feet bank: its ellipse's radii are `feetWidth` of the group's width and `feetHeight` of a card's height (the fog is gone at 85%
  // of them), its middle `feetDrop` card heights below the cards' feet; it rises `feetRise` card heights and swells by `feetSwell` of its
  // height as the dark comes in.
  feetWidth: 0.95,
  feetHeight: 0.34,
  feetDrop: 0.05,
  feetRise: 0.06,
  feetSwell: 0.15,
} as const;

/**
 * The edge fog's layers over the whole screen: two inverted banks about the stage's middle, the inner one clear over the cards and the
 * outer one thickening toward the screen's edge. Fractions of the screen. They hold every black texture, so baking their tiles bakes
 * the feet bank's too.
 */
export const EDGE_FOG: readonly FogLayer[] = [
  ...banks(BLACK_FOG, 1, { cx: 0.5, cy: SPOT.centerY, rx: 0.62, ry: 0.72 }, true),
  ...banks(BLACK_FOG, 0.9, { cx: 0.5, cy: SPOT.centerY, rx: 0.85, ry: 0.95 }, true),
];

/** Where the group stands: its left and right edges and the cards' feet, in screen points. */
export type Feet = { left: number; right: number; feet: number; cardH: number };

/** The feet bank's layers over a screen of `width` × `height`, as fractions of it. */
export function feetFog(at: Feet, width: number, height: number): FogLayer[] {
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  const mask = { cx: (at.left + at.right) / 2 / w, cy: (at.feet + SPOT_FOG.feetDrop * at.cardH) / h, rx: (SPOT_FOG.feetWidth * (at.right - at.left)) / w, ry: (SPOT_FOG.feetHeight * at.cardH) / h };
  return banks(BLACK_FOG, 1, mask);
}
