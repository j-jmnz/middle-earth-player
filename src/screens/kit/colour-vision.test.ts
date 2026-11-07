// WCAG 1.4.1 (Use of Color): the colours the player must tell apart are run through protanopia, deuteranopia and tritanopia (Machado 2009,
// severity 1) and must differ by CIEDE2000 >= 10 in both themes. 10 is "clearly different at a glance" (ΔE00 around 2 is the smallest
// difference a viewer sees side by side; around 5 reads as two colours when the swatches touch). A pair under it is listed in EXEMPT with
// the cue that carries it besides colour; an entry no pair needs fails. The palette is /ux's: a pair with no cue is reported, not retinted.
import { describe, expect, it } from "vitest";

import { deltaE2000, simulate, toLab, type Deficiency } from "./colour-math.ts";
import { palettes, type Palette } from "./palette.js";

const THRESHOLD = 10;
const DEFICIENCIES: readonly Deficiency[] = ["protanopia", "deuteranopia", "tritanopia"];
type Token = keyof Palette;

const SPHERES: readonly Token[] = ["leadership", "tactics", "spirit", "lore", "fellowship"];
const PAIRS: readonly (readonly [Token, Token])[] = [
  ...SPHERES.flatMap((one, i) => SPHERES.slice(i + 1).map((two) => [one, two] as const)),
  ...SPHERES.map((sphere) => [sphere, "threat"] as const),
  ["danger", "ok"],
  ["glow", "night"],
  ["glow", "raised"],
];

const key = (a: Token, b: Token): string => [a, b].sort().join(" / ");

const SPHERE_CUE =
  "The tint is the sphere icon's own colour, and a sphere icon always sits beside its word or carries an accessibility label; the glyphs differ in shape (docs/design-system.md, Icons). The deck donut's legend (DeckAnalytics, deck-sphere-legend) pairs each sphere's icon with its count under the ring.";
const THREAT_CUE =
  "A sphere tint is its icon's colour and the icon sits beside its word (docs/design-system.md, Icons); threat is the dial and the bar with their numbers, the Eye, and a pill with its word and icon (docs/design-system-table.md, Marks of the open moment).";

const EXEMPT: Readonly<Record<string, string>> = {
  [key("leadership", "spirit")]: SPHERE_CUE,
  [key("tactics", "lore")]: SPHERE_CUE,
  [key("spirit", "lore")]: SPHERE_CUE,
  [key("lore", "fellowship")]: SPHERE_CUE,
  [key("tactics", "fellowship")]: SPHERE_CUE,
  [key("tactics", "threat")]: THREAT_CUE,
  [key("lore", "threat")]: THREAT_CUE,
  [key("fellowship", "threat")]: THREAT_CUE,
  [key("danger", "ok")]:
    "danger is always shown with a sentence and ok with its word (Won, Ahead); neither stands as a bare colour (docs/design-system.md, Color).",
  [key("glow", "raised")]:
    "The glow is never the only mark: a card's halo comes with a solid 2.5 pt edge and a picked card with a check ring; the dock's active bar sits under its label (docs/design-system-table.md, Marks of the open moment).",
};

function worst(theme: "dark" | "light", a: Token, b: Token): number {
  const palette = palettes[theme];
  return Math.min(...DEFICIENCIES.map((d) => deltaE2000(toLab(simulate(palette[a], d)), toLab(simulate(palette[b], d)))));
}

const failing = (): Map<string, string[]> => {
  const out = new Map<string, string[]>();
  for (const theme of ["dark", "light"] as const) {
    for (const [a, b] of PAIRS) {
      const delta = worst(theme, a, b);
      if (delta < THRESHOLD) out.set(key(a, b), [...(out.get(key(a, b)) ?? []), `${theme} ${delta.toFixed(1)}`]);
    }
  }
  return out;
};

describe("colour-vision simulation", () => {
  it("is sane: a colour is no different from itself, black and white are far apart", () => {
    expect(deltaE2000(toLab(simulate("#B06098", "protanopia")), toLab(simulate("#B06098", "protanopia")))).toBe(0);
    expect(deltaE2000(toLab([0, 0, 0]), toLab([1, 1, 1]))).toBeCloseTo(100, 0);
  });

  it("matches the published CIEDE2000 sample pair", () => {
    // Sharma, Wu and Dalal 2005, pair 1: (50, 2.6772, -79.7751) and (50, 0, -82.7485) differ by 2.0425.
    expect(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 3);
  });

  it("tells every pair apart in both themes, or names the cue that carries it", () => {
    const open = [...failing()].filter(([pair]) => !(pair in EXEMPT)).map(([pair, themes]) => `${pair}: ${themes.join(", ")}`);
    expect(open).toEqual([]);
  });

  it("lists no exemption that nothing needs", () => {
    const fails = failing();
    expect(Object.keys(EXEMPT).filter((pair) => !fails.has(pair))).toEqual([]);
  });

  it("gives every exemption a cue", () => {
    expect(Object.entries(EXEMPT).filter(([, cue]) => cue.trim().length < 40)).toEqual([]);
  });
});
