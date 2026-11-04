/**
 * Backdrop scenes (docs/design-system.md, Backdrops): the ground, the fog or the light over it, the vignette and the grit, as data both
 * backdrops draw (Skia on a phone, CSS on the web). Coordinates are fractions of the screen (x of width, y of height). These are the
 * only colour values outside palette.js, because they are scene art. Screens pick a scene by name, and the theme picks its Dark or Light
 * art (user request, 2026-10-29: Dark's fog as rolling banks in Morgul's light, Light as Rivendell's morning light with no fog).
 *
 * Fog is fractal noise (the SVG feTurbulence algorithm, which Skia's FractalNoise shares) turned into a colour by a matrix that keeps
 * one hue and takes its alpha from the noise's own alpha, so the clouds are the noise and the hue is the fog's. A bank of fog is three
 * layers of it: a soft haze, the banks themselves (a steep alpha, so they have edges), and their lit crests (the same noise, paler, a
 * steeper alpha and nudged up). The banks keep to three octaves, since their steep alpha turns finer octaves into grain (user
 * request, 2026-10-29). Each layer is faded out at its edges by an elliptical mask. Ember fog, the red one, goes only where the enemy
 * lives.
 *
 * Fog drifts sideways, very slowly, like a bank in a light wind (user request, 2026-10-30): each texture moves at its own speed (the
 * haze slower than the banks, so they part a little; the ember the other way), its mask stays put, and a scene can slow it all
 * (`drift`). Reduced motion holds it still.
 */
export type SceneName = "moon" | "hero" | "path" | "ember" | "calm" | "victory" | "table";

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

/** One fog layer: a texture, how strong, and the ellipse it fades out from (rx and ry as fractions of width and height). */
export type FogLayer = {
  texture: FogTexture;
  opacity: number;
  mask: Ellipse | null;
  blend?: "multiply";
};

/** A shaft of light: a quadrilateral in fractions of the box, lit at its top and gone at its foot, blurred soft. */
export type Beam = { points: readonly (readonly [x: number, y: number])[]; opacity: number };

/**
 * Light falling on the ground instead of fog (Light: Rivendell's morning): a sun's glow in a corner, its beams slanting from it, both
 * screened over the ground. `rgb` is the light's colour, `r` the glow's radius as a fraction of the width, `blur` the beams' softness.
 */
export type SceneLight = { sun: { cx: number; cy: number; r: number }; rgb: readonly [number, number, number]; beams: readonly Beam[]; blur: number };

/** A colour multiplied into the ground inside an ellipse: Light's pale rust where the enemy is, since Light has no ember fog. */
export type Wash = Ellipse & { rgb: readonly [number, number, number]; alpha: number };

export type Scene = {
  // The ground under everything: a solid colour, or a radial light in the middle.
  ground: { kind: "solid"; color: string } | { kind: "radial"; cx: number; cy: number; rx: number; ry: number; stops: readonly (readonly [number, string])[] };
  fog: readonly FogLayer[];
  light?: SceneLight;
  wash?: Wash;
  // The rim falling to the ground colour: clear inside `from` (a fraction of the radius), `alpha` of `rgb` at the edge.
  vignette: { rgb: string; alpha: number; from: number };
  // Fine noise over everything, overlaid on Dark and multiplied on Light.
  grit: { opacity: number; blend: "overlay" | "multiply" };
  // How fast the fog drifts, a share of each texture's own speed (1 when left out).
  drift?: number;
};

const GROUND = "#030405";

// Dark: Ringwraiths. Moonlight gone pale and sickly green, as Minas Morgul's corrupted moonlight is told ("paler indeed than the moon
// ailing in some slow eclipse"), only a shade off its old teal; and a deep red ember where the enemy is.
const moonHaze: FogTexture = { freq: [0.003, 0.004], octaves: 2, seed: 5, rgb: [102, 143, 125], gain: 1.4, bias: -0.3, tile: [1200, 900], drift: 2, bake: 0.5 };
const moonBank: FogTexture = { freq: [0.009, 0.012], octaves: 3, seed: 7, rgb: [102, 143, 125], gain: 3, bias: -1.12, tile: [900, 900], drift: 5 };
const moonCrest: FogTexture = { ...moonBank, rgb: [201, 222, 204], gain: 6, bias: -3.75, offset: [0, -3] };
const emberHaze: FogTexture = { freq: [0.003, 0.004], octaves: 2, seed: 9, rgb: [150, 38, 22], gain: 1.4, bias: -0.3, tile: [1200, 900], drift: -1.7, bake: 0.5 };
const emberBank: FogTexture = { freq: [0.008, 0.012], octaves: 3, seed: 11, rgb: [150, 38, 22], gain: 3, bias: -1.18, tile: [1000, 700], drift: -4 };
const emberCrest: FogTexture = { ...emberBank, rgb: [219, 107, 77], gain: 6, bias: -3.8, offset: [0, -3] };
export const gritTexture: FogTexture = { freq: [0.85, 0.85], octaves: 2, seed: 2, rgb: [128, 128, 128], gain: 0, bias: 1, tile: [260, 260], drift: 0 };

const MOON = { haze: moonHaze, bank: moonBank, crest: moonCrest };
const EMBER = { haze: emberHaze, bank: emberBank, crest: emberCrest };

/** A bank of fog in one ellipse: its haze, the banks and their crests, at `opacity` and in proportion to it. */
function banks(fog: typeof MOON, opacity: number, mask: Ellipse): FogLayer[] {
  return [
    { texture: fog.haze, opacity: opacity * 0.6, mask },
    { texture: fog.bank, opacity, mask },
    { texture: fog.crest, opacity: opacity * 0.7, mask },
  ];
}

const darkVignette = { rgb: "3,4,5", alpha: 0.92, from: 0.45 };
const darkGrit = { opacity: 0.18, blend: "overlay" } as const;
// A band through the middle of a screen.
const MIDDLE: Ellipse = { cx: 0.5, cy: 0.52, rx: 0.95, ry: 0.32 };

export const scenes: Record<SceneName, Scene> = {
  // The hubs (Scenarios, Campaigns with nothing open) and the briefing: moonlight high on the right, a bank through the middle.
  moon: {
    ground: { kind: "solid", color: GROUND },
    fog: [...banks(MOON, 0.9, { cx: 0.7, cy: 0.25, rx: 0.65, ry: 0.55 }), ...banks(MOON, 0.4, MIDDLE)],
    vignette: darkVignette,
    grit: darkGrit,
  },
  // A hub over its scene (HeroArt draws the fog under the title itself): fog only below the picture, so none meets its foot.
  hero: {
    ground: { kind: "solid", color: GROUND },
    fog: banks(MOON, 0.5, { cx: 0.5, cy: 0.86, rx: 0.85, ry: 0.16 }),
    vignette: darkVignette,
    grit: darkGrit,
  },
  // The campaign path: moonlight high on the right, an ember low on the left where the road leads.
  path: {
    ground: { kind: "solid", color: GROUND },
    fog: [...banks(MOON, 0.9, { cx: 0.75, cy: 0.25, rx: 0.6, ry: 0.45 }), ...banks(EMBER, 0.7, { cx: 0.2, cy: 0.82, rx: 0.5, ry: 0.4 }), ...banks(MOON, 0.35, MIDDLE)],
    vignette: darkVignette,
    grit: darkGrit,
  },
  // The campaign log and a defeat: the ember high on the left, a little moon low on the right.
  ember: {
    ground: { kind: "solid", color: GROUND },
    fog: [...banks(MOON, 0.6, { cx: 0.8, cy: 0.85, rx: 0.6, ry: 0.4 }), ...banks(EMBER, 0.8, { cx: 0.3, cy: 0.28, rx: 0.6, ry: 0.5 }), ...banks(MOON, 0.35, MIDDLE)],
    vignette: darkVignette,
    grit: darkGrit,
  },
  // Decks, cards, rules, settings and every reading screen: a quiet bank in the middle.
  calm: {
    ground: { kind: "solid", color: GROUND },
    fog: banks(MOON, 0.62, { cx: 0.5, cy: 0.4, rx: 0.7, ry: 0.6 }),
    vignette: darkVignette,
    grit: darkGrit,
  },
  // A won scenario: the moon full behind the outcome word.
  victory: {
    ground: { kind: "solid", color: GROUND },
    fog: [...banks(MOON, 1, { cx: 0.5, cy: 0.3, rx: 0.8, ry: 0.5 }), ...banks(MOON, 0.35, MIDDLE)],
    vignette: darkVignette,
    grit: darkGrit,
  },
  // The table: ember over the encounter row at the top, moonlight from the fellowship's row down. No zone boxes. Its fog drifts at
  // half speed, so it never competes with the cards moving over it.
  table: {
    ground: { kind: "solid", color: GROUND },
    fog: [...banks(EMBER, 0.8, { cx: 0.45, cy: 0.05, rx: 0.75, ry: 0.55 }), ...banks(MOON, 0.8, { cx: 0.5, cy: 0.95, rx: 0.85, ry: 0.6 })],
    vignette: darkVignette,
    grit: darkGrit,
    drift: 0.5,
  },
};

// Light: Rivendell in the morning. No fog: warm parchment, a sun's glow high on the right and its beams slanting down across the page;
// a pale rust multiplied in where the enemy is.
const lightGround: Scene["ground"] = { kind: "radial", cx: 0.5, cy: 0.35, rx: 0.9, ry: 0.7, stops: [[0, "#F2EBDC"], [0.6, "#E4DCCB"], [1, "#CFC3A8"]] };
const lightVignette = { rgb: "90,80,64", alpha: 0.28, from: 0.52 };
const lightGrit = { opacity: 0.14, blend: "multiply" } as const;
const SUNLIGHT = [255, 246, 222] as const;
const RUST = [201, 138, 102] as const;

/** The morning light of a portrait page: the glow in the top right corner and three beams falling to about the middle. */
const morning: SceneLight = {
  sun: { cx: 0.95, cy: 0.02, r: 0.75 },
  rgb: SUNLIGHT,
  blur: 10,
  beams: [
    { points: [[0.77, 0], [0.87, 0], [0.31, 0.42], [0.16, 0.42]], opacity: 0.4 },
    { points: [[0.92, 0], [0.98, 0], [0.56, 0.38], [0.48, 0.38]], opacity: 0.32 },
    { points: [[1, 0.05], [1, 0.11], [0.69, 0.48], [0.6, 0.48]], opacity: 0.26 },
  ],
};

const lit = (extra: Partial<Scene> = {}): Scene => ({ ground: lightGround, fog: [], light: morning, vignette: lightVignette, grit: lightGrit, ...extra });

export const lightScenes: Record<SceneName, Scene> = {
  moon: lit(),
  // A hub over its scene: the art draws the light over itself (HeroArt), so the ground under it stays plain.
  hero: { ground: lightGround, fog: [], vignette: lightVignette, grit: lightGrit },
  path: lit({ wash: { cx: 0.2, cy: 0.82, rx: 0.5, ry: 0.4, rgb: RUST, alpha: 0.3 } }),
  ember: lit({ wash: { cx: 0.3, cy: 0.28, rx: 0.6, ry: 0.5, rgb: RUST, alpha: 0.32 } }),
  calm: lit(),
  victory: lit(),
  // The table, in landscape: the beams fall the whole height onto the play area, the rust lies over the encounter row.
  table: lit({
    light: {
      sun: { cx: 0.97, cy: 0.05, r: 0.7 },
      rgb: SUNLIGHT,
      blur: 12,
      beams: [
        { points: [[0.83, 0], [0.9, 0], [0.56, 1], [0.45, 1]], opacity: 0.42 },
        { points: [[0.95, 0], [0.99, 0], [0.72, 1], [0.66, 1]], opacity: 0.32 },
        { points: [[1, 0.15], [1, 0.33], [0.88, 1], [0.83, 1]], opacity: 0.26 },
      ],
    },
    wash: { cx: 0.45, cy: 0, rx: 0.9, ry: 0.45, rgb: RUST, alpha: 0.5 },
  }),
};

export const scenesByTheme = { dark: scenes, light: lightScenes } as const;

/**
 * What the Campaigns art draws over its own picture (HeroArt), in fractions of the art's box. Dark: a bank of fog under the title,
 * clear above it. Light: the morning glow and its beams, and a warm glow behind the title.
 */
export const heroVeil = {
  dark: banks(MOON, 1, { cx: 0.5, cy: 0.74, rx: 1.1, ry: 0.42 }),
  light: {
    ...morning,
    blur: 9,
    beams: [
      { points: [[0.77, 0], [0.87, 0], [0.31, 0.7], [0.16, 0.7]], opacity: 0.4 },
      { points: [[0.92, 0], [0.98, 0], [0.56, 0.64], [0.48, 0.64]], opacity: 0.32 },
      { points: [[1, 0.08], [1, 0.19], [0.69, 0.85], [0.6, 0.85]], opacity: 0.26 },
    ],
  } satisfies SceneLight,
};

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
