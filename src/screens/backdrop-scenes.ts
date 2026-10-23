/**
 * Backdrop scene art. Coordinates are fractions of the screen (x of width, y of height).
 * These stops are the only hex values outside palette.js. Screens pick a scene by name.
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
};

const night = "#0A0B0E";

export const scenes: Record<SceneName, Scene> = {
  // Campaigns: mountains at dusk, the eye drawn to a warm light past the ridge.
  dusk: {
    base: {
      kind: "linear",
      stops: [
        [0, "#121A28"],
        [0.21, "#26293A"],
        [0.31, "#4A3A2C"],
        [0.41, "#1A1712"],
        [0.62, night],
        [1, night],
      ],
    },
    glows: [
      { cx: 0.62, cy: 0.28, r: 0.55, rgb: "232,180,100", alpha: 0.55 },
      { cx: 0.5, cy: 0.39, r: 0.7, rgb: "220,210,190", alpha: 0.1 },
    ],
    ridges: [
      {
        points: [[0, 0.397], [0.1, 0.36], [0.19, 0.382], [0.31, 0.305], [0.42, 0.36], [0.54, 0.323], [0.63, 0.354], [0.76, 0.292], [0.88, 0.348], [1, 0.329]],
        bottom: 0.56,
        from: "#1D212C",
        to: "#1D212C",
        opacity: 0.85,
      },
      {
        points: [[0, 0.434], [0.14, 0.402], [0.27, 0.444], [0.4, 0.408], [0.55, 0.449], [0.7, 0.397], [0.84, 0.434], [1, 0.412]],
        bottom: 1,
        from: "#101218",
        to: night,
        opacity: 1,
      },
    ],
  },
  // Campaign path: lamplight on the left, cold blue below.
  ember: {
    base: { kind: "linear", stops: [[0, "#0F1218"], [1, night]] },
    glows: [
      { cx: 0.3, cy: 0.34, r: 0.8, rgb: "217,184,108", alpha: 0.14 },
      { cx: 0.8, cy: 0.8, r: 0.9, rgb: "70,86,120", alpha: 0.18 },
    ],
    ridges: [],
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
  },
  // Lists and detail screens: quiet, one cold light top-left.
  plain: {
    base: { kind: "linear", stops: [[0, "#10131A"], [1, night]] },
    glows: [{ cx: 0.2, cy: 0, r: 0.9, rgb: "90,110,150", alpha: 0.22 }],
    ridges: [],
  },
  // Resolution: the Ring, lit.
  victory: {
    base: { kind: "linear", stops: [[0, "#1A1714"], [0.55, "#0D0D0F"], [1, night]] },
    glows: [{ cx: 0.5, cy: 0.22, r: 0.6, rgb: "232,190,110", alpha: 0.35 }],
    ridges: [],
    ring: { cx: 0.5, cy: 0.225, r: 0.28 },
  },
  // Table chrome around the Skia canvas.
  felt: {
    base: { kind: "radial", cx: 0.5, cy: 0.46, r: 0.9, stops: [[0, "#1F2620"], [0.6, "#121613"], [1, "#090A0B"]] },
    glows: [{ cx: 0.5, cy: 0.12, r: 0.6, rgb: "217,184,108", alpha: 0.08 }],
    ridges: [],
  },
};
