/**
 * Backdrop scenes (docs/design-system.md, Backdrops): the ground, the fog or the light over it, the vignette and the grit, as data both
 * backdrops draw (Skia on a phone, CSS on the web). Coordinates are fractions of the screen (x of width, y of height). These and the
 * combat spotlight's black fog (src/play/spotlight/fog.ts) are the only colour values outside palette.js, because they are scene art. Screens pick a scene by name, and the theme picks its Dark or Light
 * art (user request, 2026-10-29: Dark's fog as rolling banks in Morgul's light, Light as Rivendell's morning light). Light has fog on
 * the table only: gold mist over the fellowship and umber smoke over the encounter (user decision, 2026-11-10).
 *
 * The fog itself (its textures, layers and colour matrix) is src/ui/fog/fog.ts. Ember fog, the red one, goes only where the enemy
 * lives.
 *
 * Fog drifts sideways, very slowly, like a bank in a light wind (user request, 2026-10-30): each texture moves at its own speed (the
 * haze slower than the banks, so they part a little; the ember the other way), its mask stays put, and a scene can slow it all
 * (`drift`). Reduced motion holds it still.
 */
import { banks, type Ellipse, type FogLayer, type FogSet, type FogTexture } from "../../ui/fog/fog";

export type SceneName = "moon" | "hero" | "path" | "ember" | "calm" | "victory" | "table";

/** A shaft of light: a quadrilateral in fractions of the box, lit at its top and gone at its foot, blurred soft. */
export type Beam = { points: readonly (readonly [x: number, y: number])[]; opacity: number };

/**
 * Light falling on the ground instead of fog (Light: Rivendell's morning): a sun's glow in a corner, its beams slanting from it, both
 * screened over the ground. `rgb` is the light's colour, `r` the glow's radius as a fraction of the width, `blur` the beams' softness.
 */
export type SceneLight = { sun: { cx: number; cy: number; r: number }; rgb: readonly [number, number, number]; beams: readonly Beam[]; blur: number };

/** A colour multiplied into the ground inside an ellipse: Light's pale rust where the enemy is on a page, or the deeper parchment under the table's mist. */
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

const MOON = { haze: moonHaze, bank: moonBank, crest: moonCrest };
const EMBER = { haze: emberHaze, bank: emberBank, crest: emberCrest };

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

// Light: Rivendell in the morning. Warm parchment, a sun's glow high on the right and its beams slanting down across the page; a pale
// rust multiplied in where the enemy is. Only the table has fog: the Dark banks' noise in a golden morning mist over the fellowship
// (on parchment deepened a step, so the mist shows) and in an umber smoke over the encounter, of a family with the engagement area's
// red haze.
const lightGround: Scene["ground"] = { kind: "radial", cx: 0.5, cy: 0.35, rx: 0.9, ry: 0.7, stops: [[0, "#F2EBDC"], [0.6, "#E4DCCB"], [1, "#CFC3A8"]] };
const lightVignette = { rgb: "90,80,64", alpha: 0.28, from: 0.52 };
const lightGrit = { opacity: 0.14, blend: "multiply" } as const;
const SUNLIGHT = [255, 246, 222] as const;
const RUST = [201, 138, 102] as const;
const GOLD = {
  haze: { ...moonHaze, rgb: [255, 238, 196] },
  bank: { ...moonBank, rgb: [255, 240, 205] },
  crest: { ...moonCrest, rgb: [255, 250, 236] },
} satisfies FogSet;
const UMBER = {
  haze: { ...emberHaze, rgb: [118, 62, 40] },
  bank: { ...emberBank, rgb: [118, 62, 40] },
  crest: { ...emberCrest, rgb: [184, 112, 80] },
} satisfies FogSet;

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
  // The table, in landscape: umber smoke over the encounter row, gold mist from the fellowship's row down on deepened parchment, and
  // the beams falling the whole height into the mist. Its fog drifts at half speed, as on Dark.
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
    wash: { cx: 0.5, cy: 1, rx: 0.9, ry: 0.55, rgb: [214, 196, 160], alpha: 0.5 },
    fog: [...banks(UMBER, 0.7, { cx: 0.45, cy: 0.05, rx: 0.75, ry: 0.55 }), ...banks(GOLD, 1, { cx: 0.5, cy: 0.95, rx: 0.85, ry: 0.6 })],
    drift: 0.5,
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
