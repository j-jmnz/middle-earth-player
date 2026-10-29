/**
 * Backdrop scenes (docs/design-system.md, Backdrops): the ground, the fog over it, the vignette and the grit, as data both backdrops
 * draw (Skia on a phone, CSS on the web). Coordinates are fractions of the screen (x of width, y of height). These are the only colour
 * values outside palette.js, because they are scene art. Screens pick a scene by name, and the theme picks its Dark or Light art.
 *
 * Fog is fractal noise (the SVG feTurbulence algorithm, which Skia's FractalNoise shares) turned into a colour by a matrix that keeps
 * one hue and takes its alpha from the noise's own alpha, so the clouds are the noise and the hue is the fog's. Each layer is faded out
 * at its edges by an elliptical mask. Ember fog, the red one, goes only where the enemy lives.
 */
/** Which part of a backdrop to draw: all of it, or the ground under an art layer and the air (fog, vignette, grit) over it. */
export type BackdropPart = "all" | "ground" | "air";

export type SceneName = "moon" | "path" | "ember" | "calm" | "victory" | "table";

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
};

/** One fog layer: a texture, how strong, and the ellipse it fades out from (rx and ry as fractions of width and height). */
export type FogLayer = {
  texture: FogTexture;
  opacity: number;
  mask: { cx: number; cy: number; rx: number; ry: number } | null;
  blend?: "multiply";
};

export type Scene = {
  // The ground under everything: a solid colour, or a radial light in the middle.
  ground: { kind: "solid"; color: string } | { kind: "radial"; cx: number; cy: number; rx: number; ry: number; stops: readonly (readonly [number, string])[] };
  fog: readonly FogLayer[];
  // The rim falling to the ground colour: clear inside `from` (a fraction of the radius), `alpha` of `rgb` at the edge.
  vignette: { rgb: string; alpha: number; from: number };
  // Fine noise over everything, overlaid on Dark and multiplied on Light.
  grit: { opacity: number; blend: "overlay" | "multiply" };
};

const GROUND = "#030405";

// Dark: Ringwraiths. Cold moonlight, pale wisps, and a deep red ember where the enemy is.
// Denser than the table's (user request, 2026-10-29: "increase the density and amount of fog in general"): more of the noise clears
// the alpha floor, so the clouds are thicker and cover more of the ground.
const moonFog: FogTexture = { freq: [0.0034, 0.0034], octaves: 4, seed: 7, rgb: [96, 134, 144], gain: 1.9, bias: -0.5, tile: [900, 900] };
const wispFog: FogTexture = { freq: [0.0016, 0.011], octaves: 3, seed: 3, rgb: [196, 212, 214], gain: 1.8, bias: -0.58, tile: [1200, 800] };
// The table keeps the thinner fog, so the cards and their numbers read over it.
const tableMoon: FogTexture = { ...moonFog, gain: 1.7, bias: -0.62 };
const tableWisp: FogTexture = { ...wispFog, gain: 1.7, bias: -0.66 };
const emberFog: FogTexture = { freq: [0.0038, 0.0045], octaves: 4, seed: 11, rgb: [150, 38, 22], gain: 2.0, bias: -0.62, tile: [1000, 700] };
export const gritTexture: FogTexture = { freq: [0.85, 0.85], octaves: 2, seed: 2, rgb: [128, 128, 128], gain: 0, bias: 1, tile: [260, 260] };

// Light: Rivendell. Golden autumn mist, a sage slate multiplied in, and a pale rust ember.
const dawnFog: FogTexture = { freq: [0.0034, 0.0034], octaves: 4, seed: 7, rgb: [226, 182, 112], gain: 1.8, bias: -0.44, tile: [900, 900] };
const dawnWisp: FogTexture = { freq: [0.0016, 0.011], octaves: 3, seed: 3, rgb: [236, 214, 170], gain: 1.7, bias: -0.52, tile: [1200, 800] };
const tableDawn: FogTexture = { ...dawnFog, gain: 1.7, bias: -0.52 };
const tableDawnWisp: FogTexture = { ...dawnWisp, gain: 1.6, bias: -0.6 };
const slateFog: FogTexture = { freq: [0.003, 0.004], octaves: 4, seed: 19, rgb: [128, 146, 120], gain: 1.6, bias: -0.5, tile: [900, 900] };
const emberLight: FogTexture = { freq: [0.0038, 0.0045], octaves: 4, seed: 11, rgb: [196, 112, 78], gain: 1.8, bias: -0.56, tile: [1000, 700] };

const darkVignette = { rgb: "3,4,5", alpha: 0.92, from: 0.45 };
const darkGrit = { opacity: 0.18, blend: "overlay" } as const;

const wisp = (texture: FogTexture): FogLayer => ({ texture, opacity: 0.5, mask: { cx: 0.5, cy: 0.5, rx: 1, ry: 0.42 } });

export const scenes: Record<SceneName, Scene> = {
  // The hubs (Campaigns, Scenarios) and the briefing: moonlight high on the right.
  moon: {
    ground: { kind: "solid", color: GROUND },
    fog: [{ texture: moonFog, opacity: 1, mask: { cx: 0.65, cy: 0.3, rx: 0.85, ry: 0.7 } }, wisp(wispFog)],
    vignette: darkVignette,
    grit: darkGrit,
  },
  // The campaign path: moonlight high on the right, an ember low on the left where the road leads.
  path: {
    ground: { kind: "solid", color: GROUND },
    fog: [
      { texture: moonFog, opacity: 1, mask: { cx: 0.7, cy: 0.3, rx: 0.8, ry: 0.6 } },
      { texture: emberFog, opacity: 0.7, mask: { cx: 0.2, cy: 0.82, rx: 0.5, ry: 0.4 } },
      wisp(wispFog),
    ],
    vignette: darkVignette,
    grit: darkGrit,
  },
  // The campaign log and a defeat: the ember high on the left, a little moon low on the right.
  ember: {
    ground: { kind: "solid", color: GROUND },
    fog: [
      { texture: moonFog, opacity: 0.75, mask: { cx: 0.8, cy: 0.85, rx: 0.7, ry: 0.5 } },
      { texture: emberFog, opacity: 0.8, mask: { cx: 0.3, cy: 0.28, rx: 0.6, ry: 0.5 } },
      wisp(wispFog),
    ],
    vignette: darkVignette,
    grit: darkGrit,
  },
  // Decks, cards, rules, settings and every reading screen: a quiet moon in the middle.
  calm: {
    ground: { kind: "solid", color: GROUND },
    fog: [{ texture: moonFog, opacity: 0.7, mask: { cx: 0.5, cy: 0.4, rx: 0.85, ry: 0.75 } }, wisp(wispFog)],
    vignette: darkVignette,
    grit: darkGrit,
  },
  // A won scenario: the moon full behind the outcome word.
  victory: {
    ground: { kind: "solid", color: GROUND },
    fog: [{ texture: moonFog, opacity: 1, mask: { cx: 0.5, cy: 0.3, rx: 0.8, ry: 0.5 } }, wisp(wispFog)],
    vignette: darkVignette,
    grit: darkGrit,
  },
  // The table: ember over the encounter row at the top, moonlight from the fellowship's row down, a wisp band through the middle.
  // No zone boxes.
  table: {
    ground: { kind: "solid", color: GROUND },
    fog: [
      { texture: emberFog, opacity: 0.75, mask: { cx: 0.45, cy: 0.05, rx: 0.75, ry: 0.55 } },
      { texture: tableMoon, opacity: 0.7, mask: { cx: 0.5, cy: 0.95, rx: 0.85, ry: 0.6 } },
      { texture: tableWisp, opacity: 0.35, mask: { cx: 0.5, cy: 0.48, rx: 0.9, ry: 0.25 } },
    ],
    vignette: darkVignette,
    grit: darkGrit,
  },
};

const lightGround: Scene["ground"] = { kind: "radial", cx: 0.5, cy: 0.35, rx: 0.9, ry: 0.7, stops: [[0, "#F2EBDC"], [0.6, "#E4DCCB"], [1, "#CFC3A8"]] };
const lightVignette = { rgb: "90,80,64", alpha: 0.28, from: 0.52 };
const lightGrit = { opacity: 0.14, blend: "multiply" } as const;
const slate = (opacity: number): FogLayer => ({ texture: slateFog, opacity, mask: { cx: 0.5, cy: 0.6, rx: 0.9, ry: 0.7 }, blend: "multiply" });

export const lightScenes: Record<SceneName, Scene> = {
  moon: {
    ground: lightGround,
    fog: [{ texture: dawnFog, opacity: 1, mask: { cx: 0.65, cy: 0.3, rx: 0.85, ry: 0.7 } }, slate(0.3), wisp(dawnWisp)],
    vignette: lightVignette,
    grit: lightGrit,
  },
  path: {
    ground: lightGround,
    fog: [
      { texture: dawnFog, opacity: 1, mask: { cx: 0.7, cy: 0.3, rx: 0.8, ry: 0.6 } },
      { texture: emberLight, opacity: 0.6, mask: { cx: 0.2, cy: 0.82, rx: 0.5, ry: 0.4 } },
      slate(0.25),
      wisp(dawnWisp),
    ],
    vignette: lightVignette,
    grit: lightGrit,
  },
  ember: {
    ground: lightGround,
    fog: [
      { texture: dawnFog, opacity: 0.75, mask: { cx: 0.8, cy: 0.85, rx: 0.7, ry: 0.5 } },
      { texture: emberLight, opacity: 0.7, mask: { cx: 0.3, cy: 0.28, rx: 0.6, ry: 0.5 } },
      wisp(dawnWisp),
    ],
    vignette: lightVignette,
    grit: lightGrit,
  },
  calm: {
    ground: lightGround,
    fog: [{ texture: dawnFog, opacity: 0.7, mask: { cx: 0.5, cy: 0.4, rx: 0.85, ry: 0.75 } }, slate(0.3), wisp(dawnWisp)],
    vignette: lightVignette,
    grit: lightGrit,
  },
  victory: {
    ground: lightGround,
    fog: [{ texture: dawnFog, opacity: 1, mask: { cx: 0.5, cy: 0.3, rx: 0.8, ry: 0.5 } }, wisp(dawnWisp)],
    vignette: lightVignette,
    grit: lightGrit,
  },
  table: {
    ground: lightGround,
    fog: [
      { texture: emberLight, opacity: 0.6, mask: { cx: 0.45, cy: 0.05, rx: 0.75, ry: 0.55 } },
      { texture: tableDawn, opacity: 0.6, mask: { cx: 0.5, cy: 0.95, rx: 0.85, ry: 0.6 } },
      slate(0.25),
      { texture: tableDawnWisp, opacity: 0.35, mask: { cx: 0.5, cy: 0.48, rx: 0.9, ry: 0.25 } },
    ],
    vignette: lightVignette,
    grit: lightGrit,
  },
};

export const scenesByTheme = { dark: scenes, light: lightScenes } as const;

/**
 * The fog a hub's art layer draws over its own picture (HeroArt, Campaigns): a band of moonlight and a wisp under the hero title, so
 * the title sits in the fog before the picture falls to the ground. Masks are fractions of the art's box, not of the screen.
 */
export const heroVeils = {
  dark: [
    { texture: moonFog, opacity: 1, mask: { cx: 0.5, cy: 0.56, rx: 0.95, ry: 0.26 } },
    { texture: moonFog, opacity: 0.85, mask: { cx: 0.3, cy: 0.62, rx: 0.7, ry: 0.18 } },
    { texture: wispFog, opacity: 0.7, mask: { cx: 0.42, cy: 0.6, rx: 1, ry: 0.16 } },
  ],
  light: [
    { texture: dawnFog, opacity: 1, mask: { cx: 0.5, cy: 0.56, rx: 0.95, ry: 0.26 } },
    { texture: dawnWisp, opacity: 0.7, mask: { cx: 0.42, cy: 0.6, rx: 1, ry: 0.16 } },
  ],
} as const satisfies Record<"dark" | "light", readonly FogLayer[]>;

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
