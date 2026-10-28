/**
 * Backdrop scene art. Coordinates are fractions of the screen (x of width, y of height).
 * These stops are the only hex values outside palette.js. Screens pick a scene by name, and the theme picks its Dark or Light art.
 */
export type SceneName = "dusk" | "ember" | "vale" | "plain" | "victory" | "felt";

export type Stop = readonly [position: number, color: string];

export type Glow = { cx: number; cy: number; r: number; rgb: string; alpha: number };

export type Ridge = {
  points: readonly (readonly [number, number])[];
  bottom: number;
  from: string;
  to: string;
  opacity: number;
};

export type Scene = {
  base: { kind: "linear"; stops: readonly Stop[] } | { kind: "radial"; cx: number; cy: number; r: number; stops: readonly Stop[] };
  glows: readonly Glow[];
  ridges: readonly Ridge[];
  ring?: { cx: number; cy: number; r: number };
  // How dark the screen's edges fall (0 to 1): a lamp-lit middle and night at the corners.
  vignette: number;
};

const night = "#0B0A08";

export const scenes: Record<SceneName, Scene> = {
  // Campaigns and Scenarios: a moonlit night over far mountains, a cold light high on the right and an ember low on the left.
  dusk: {
    base: {
      kind: "linear",
      stops: [
        [0, "#0D1220"],
        [0.32, "#0B0E17"],
        [0.6, night],
        [1, night],
      ],
    },
    glows: [
      { cx: 0.82, cy: 0.06, r: 0.75, rgb: "157,176,204", alpha: 0.16 },
      { cx: 0.08, cy: 0.62, r: 0.7, rgb: "217,150,90", alpha: 0.07 },
    ],
    ridges: [
      {
        points: [[0, 0.33], [0.12, 0.3], [0.22, 0.318], [0.34, 0.262], [0.46, 0.305], [0.58, 0.276], [0.7, 0.3], [0.82, 0.25], [0.92, 0.29], [1, 0.276]],
        bottom: 0.5,
        from: "#121725",
        to: night,
        opacity: 0.9,
      },
    ],
    vignette: 0.55,
  },
  // Campaign path: lamplight on the left, cold blue below.
  ember: {
    base: { kind: "linear", stops: [[0, "#0F1218"], [1, night]] },
    glows: [
      { cx: 0.3, cy: 0.34, r: 0.8, rgb: "217,184,108", alpha: 0.14 },
      { cx: 0.8, cy: 0.8, r: 0.9, rgb: "70,86,120", alpha: 0.18 },
    ],
    ridges: [],
    vignette: 0.5,
  },
  // Briefing: a green vale in afternoon light.
  vale: {
    base: {
      kind: "linear",
      stops: [
        [0, "#2A3A3A"],
        [0.16, "#4C5A44"],
        [0.25, "#2E3A26"],
        [0.4, night],
        [1, night],
      ],
    },
    glows: [{ cx: 0.7, cy: 0.16, r: 0.45, rgb: "240,200,120", alpha: 0.45 }],
    ridges: [
      {
        points: [[0, 0.268], [0.18, 0.241], [0.34, 0.264], [0.5, 0.232], [0.66, 0.259], [0.82, 0.227], [1, 0.255]],
        bottom: 0.41,
        from: "#1E2A1C",
        to: night,
        opacity: 1,
      },
    ],
    vignette: 0.5,
  },
  // Lists and detail screens: quiet, one cold light top-left.
  plain: {
    base: { kind: "linear", stops: [[0, "#0E121A"], [1, night]] },
    glows: [
      { cx: 0.2, cy: 0, r: 0.9, rgb: "90,110,150", alpha: 0.2 },
      { cx: 0.9, cy: 0.95, r: 0.6, rgb: "217,150,90", alpha: 0.05 },
    ],
    ridges: [],
    vignette: 0.5,
  },
  // Resolution: the Ring, lit.
  victory: {
    base: { kind: "linear", stops: [[0, "#1A1714"], [0.55, "#0D0D0F"], [1, night]] },
    glows: [{ cx: 0.5, cy: 0.22, r: 0.6, rgb: "232,190,110", alpha: 0.35 }],
    ridges: [],
    ring: { cx: 0.5, cy: 0.225, r: 0.28 },
    vignette: 0.6,
  },
  // Table chrome around the Skia canvas.
  felt: {
    base: { kind: "radial", cx: 0.5, cy: 0.46, r: 0.9, stops: [[0, "#1F2620"], [0.6, "#121613"], [1, "#090A0B"]] },
    glows: [{ cx: 0.5, cy: 0.12, r: 0.6, rgb: "217,184,108", alpha: 0.08 }],
    ridges: [],
    vignette: 0,
  },
};

// The same six scenes by daylight (user request, 2026-10-28): dawn over the mountains, lamplight in a morning room, the vale at noon.
// Each fades into the Light page color (the palette's night) so the screen's own fill and the scene meet without a seam, and the
// vignette is a warm shade at the corners rather than night.
const day = "#E8DFCA";

export const lightScenes: Record<SceneName, Scene> = {
  // Dawn: a pale sky over far mountains, the sun low on the right and a warm haze on the left.
  dusk: {
    base: {
      kind: "linear",
      stops: [
        [0, "#D3DCE6"],
        [0.32, "#E1E1D8"],
        [0.6, day],
        [1, day],
      ],
    },
    glows: [
      { cx: 0.82, cy: 0.06, r: 0.75, rgb: "255,238,196", alpha: 0.55 },
      { cx: 0.08, cy: 0.62, r: 0.7, rgb: "217,150,90", alpha: 0.12 },
    ],
    ridges: [
      {
        points: [[0, 0.33], [0.12, 0.3], [0.22, 0.318], [0.34, 0.262], [0.46, 0.305], [0.58, 0.276], [0.7, 0.3], [0.82, 0.25], [0.92, 0.29], [1, 0.276]],
        bottom: 0.5,
        from: "#B9C1CA",
        to: day,
        opacity: 0.7,
      },
    ],
    vignette: 0.14,
  },
  // Lamplight in a morning room: warm on the left, a cool window low right.
  ember: {
    base: { kind: "linear", stops: [[0, "#EDE4CF"], [1, day]] },
    glows: [
      { cx: 0.3, cy: 0.34, r: 0.8, rgb: "232,196,120", alpha: 0.3 },
      { cx: 0.8, cy: 0.8, r: 0.9, rgb: "150,170,200", alpha: 0.22 },
    ],
    ridges: [],
    vignette: 0.12,
  },
  // The vale at noon.
  vale: {
    base: {
      kind: "linear",
      stops: [
        [0, "#C7D7CC"],
        [0.16, "#B7CBA6"],
        [0.25, "#CAD8B5"],
        [0.4, day],
        [1, day],
      ],
    },
    glows: [{ cx: 0.7, cy: 0.16, r: 0.45, rgb: "255,230,160", alpha: 0.55 }],
    ridges: [
      {
        points: [[0, 0.268], [0.18, 0.241], [0.34, 0.264], [0.5, 0.232], [0.66, 0.259], [0.82, 0.227], [1, 0.255]],
        bottom: 0.41,
        from: "#A6BC98",
        to: day,
        opacity: 1,
      },
    ],
    vignette: 0.12,
  },
  // Quiet parchment, one cool light top-left.
  plain: {
    base: { kind: "linear", stops: [[0, "#EFE8D6"], [1, day]] },
    glows: [
      { cx: 0.2, cy: 0, r: 0.9, rgb: "150,170,205", alpha: 0.22 },
      { cx: 0.9, cy: 0.95, r: 0.6, rgb: "217,150,90", alpha: 0.08 },
    ],
    ridges: [],
    vignette: 0.1,
  },
  // The Ring in morning light.
  victory: {
    base: { kind: "linear", stops: [[0, "#F2E6C8"], [0.55, "#EBE2CC"], [1, day]] },
    glows: [{ cx: 0.5, cy: 0.22, r: 0.6, rgb: "245,205,120", alpha: 0.5 }],
    ridges: [],
    ring: { cx: 0.5, cy: 0.225, r: 0.28 },
    vignette: 0.16,
  },
  // Table chrome around the Skia canvas: linen.
  felt: {
    base: { kind: "radial", cx: 0.5, cy: 0.46, r: 0.9, stops: [[0, "#E9E1CE"], [0.6, "#DDD4BF"], [1, "#CEC4AB"]] },
    glows: [{ cx: 0.5, cy: 0.12, r: 0.6, rgb: "217,184,108", alpha: 0.18 }],
    ridges: [],
    vignette: 0,
  },
};

export const scenesByTheme = { dark: scenes, light: lightScenes } as const;
