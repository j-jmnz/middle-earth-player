/**
 * Fog as data (docs/design-system.md, Backdrops): the screens' backdrop scenes (src/screens/art/backdrop-scenes.ts) and the combat
 * spotlight's black fog (src/play/spotlight/fog.ts) both draw it. Coordinates are fractions of the box the fog fills.
 *
 * Fog is fractal noise (the SVG feTurbulence algorithm, which Skia's FractalNoise shares) turned into a colour by a matrix that keeps
 * one hue and takes its alpha from the noise's own alpha, so the clouds are the noise and the hue is the fog's. A bank of fog is three
 * layers of it: a soft haze, the banks themselves (a steep alpha, so they have edges), and their lit crests (the same noise, paler, a
 * steeper alpha and nudged up). The banks keep to three octaves, since their steep alpha turns finer octaves into grain (user
 * request, 2026-10-29). Each layer is faded out at its edges by an elliptical mask, or, inverted, faded in toward them.
 */

/** A fog texture: the noise and the colour it is mapped to. `freq` is cycles per point across and down. */
export type FogTexture = {
  freq: readonly [x: number, y: number];
  octaves: number;
  seed: number;
  rgb: readonly [number, number, number];
  // alpha = gain × noise alpha + bias (the noise alpha is about 0.5 on average), clamped to 0..1 by the renderer
  gain: number;
  bias: number;
  // The size of one tile on the web, where the noise is an SVG drawn as a repeating background (its tiles are stitched).
  tile: readonly [w: number, h: number];
  // Points the noise is moved by: a crest sits a little above the bank it lights.
  offset?: readonly [dx: number, dy: number];
  // Points a second it drifts across (negative is leftward); 0 holds it still.
  drift: number;
  // Pixels per point the phone draws its tile at once, before it drifts: the haze is soft enough for half.
  bake?: number;
};

export type Ellipse = { cx: number; cy: number; rx: number; ry: number };

/**
 * One fog layer: a texture, how strong, and the ellipse it fades out from (rx and ry as fractions of width and height). `invert` turns
 * the mask inside out: clear inside the ellipse and dense toward its rim and beyond (the spotlight's fog closing in from the edges).
 */
export type FogLayer = {
  texture: FogTexture;
  opacity: number;
  mask: Ellipse | null;
  blend?: "multiply";
  invert?: boolean;
};

/** A bank's three textures. */
export type FogSet = { haze: FogTexture; bank: FogTexture; crest: FogTexture };

/** A bank of fog in one ellipse: its haze, the banks and their crests, at `opacity` and in proportion to it. */
export function banks(fog: FogSet, opacity: number, mask: Ellipse, invert?: boolean): FogLayer[] {
  const flip = invert ? { invert } : {};
  return [
    { texture: fog.haze, opacity: opacity * 0.6, mask, ...flip },
    { texture: fog.bank, opacity, mask, ...flip },
    { texture: fog.crest, opacity: opacity * 0.7, mask, ...flip },
  ];
}

/** The mask's gradient stops, as (position, alpha): opaque in the middle and gone at 85% of the radius, or inverted, clear to 30% and full at the rim. */
export function maskStops(invert: boolean | undefined): { positions: number[]; alphas: number[] } {
  return invert ? { positions: [0.3, 1], alphas: [0, 1] } : { positions: [0.1, 0.85], alphas: [1, 0] };
}

/** Fine grey noise laid over a whole scene. */
export const gritTexture: FogTexture = { freq: [0.85, 0.85], octaves: 2, seed: 2, rgb: [128, 128, 128], gain: 0, bias: 1, tile: [260, 260], drift: 0 };

/**
 * A fog texture's colour matrix, row by row (feColorMatrix's values and Skia's ColorMatrix alike): the hue in the first three rows
 * as constant offsets, the alpha from the noise's alpha. Offsets are fractions of 1.
 */
export function fogMatrix(texture: FogTexture): number[] {
  const [r, g, b] = texture.rgb.map((channel) => channel / 255) as [number, number, number];
  if (texture === gritTexture) {
    // Grit is grey noise: each channel the noise's red, fully opaque.
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1];
  }
  return [0, 0, 0, 0, r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, 0, 0, 0, texture.gain, texture.bias];
}

/** "r,g,b" for a CSS or Skia rgba(). */
export const rgbOf = (rgb: readonly [number, number, number]) => rgb.join(",");
