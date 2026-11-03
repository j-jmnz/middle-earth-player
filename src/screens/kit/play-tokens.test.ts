import { describe, expect, it } from "vitest";

import { tableTokensByTheme } from "../../ui/tokens.ts";
import { palettes } from "./palette.js";

// docs/design-system.md: the canvas copies felt, feltLight and the marks it draws from the palette. They must not drift. The keys that
// build depth (surfaces.ts) and the lit edge are the table's own.
const OWN = new Set(["lit", "depth", "shade", "primaryTop", "primaryMid"]);
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
});
