import { describe, expect, it } from "vitest";

import { tableTokensByTheme } from "../../ui/tokens.ts";
import { luminance } from "./colour-math.ts";
import { palettes } from "./palette.js";

// docs/design-system.md: the canvas copies felt, feltLight and the marks it draws from the palette. They must not drift. The keys that
// build depth (surfaces.ts) and the lit edge are the table's own.
const OWN = new Set(["lit", "depth", "shade", "primaryTop", "primaryMid", "phase", "phaseTop", "phaseMid", "phaseDeep", "onPhase", "coin", "onThreatPill", "veil"]);
describe("table tokens", () => {
  for (const theme of ["dark", "light"] as const) {
    it(`${theme} copy matches its palette, key for key`, () => {
      const copy = tableTokensByTheme[theme];
      for (const [name, value] of Object.entries(copy)) {
        if (OWN.has(name)) continue;
        expect(palettes[theme][name as keyof typeof palettes.dark], `${theme} ${name}`).toBe(value);
      }
    });
  }

  it("lit is bone on Dark and paper on Light", () => {
    expect(tableTokensByTheme.dark.lit).toBe(palettes.dark.bone);
    expect(tableTokensByTheme.light.lit).toBe(palettes.light.paper);
  });

  // The dock's gold (docs/design-system-table.md, Two taps): its word and armed line on the ground, and the word on the filled capsule's middle.
  for (const theme of ["dark", "light"] as const) {
    it(`${theme} gold reads at 4.5:1`, () => {
      const t = tableTokensByTheme[theme];
      const contrast = (a: string, b: string) => {
        const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (hi! + 0.05) / (lo! + 0.05);
      };
      expect(contrast(t.phase, t.night)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.phase, t.dusk)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.onPhase, t.phaseMid)).toBeGreaterThanOrEqual(4.5);
    });

    it(`${theme} text on the red pills reads at 4.5:1`, () => {
      const t = tableTokensByTheme[theme];
      const [hi, lo] = [luminance(t.onThreatPill), luminance(t.threat)].sort((x, y) => y - x);
      expect((hi! + 0.05) / (lo! + 0.05)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
