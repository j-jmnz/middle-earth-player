import { describe, expect, it } from "vitest";

import { tableTokens, tableTokensByTheme } from "../play/tokens.ts";
import { palette, palettes } from "./palette.js";

// docs/design-system.md: the canvas copies felt, feltLight and the marks it draws from the palette. They must not drift. The keys that
// build depth (surfaces.ts) and the lit edge are the table's own.
const OWN = new Set(["lit", "depth", "shade", "primaryTop", "primaryMid"]);
describe("table tokens", () => {
  it("match the Ringwraiths palette", () => {
    for (const [name, value] of Object.entries(tableTokens)) {
      if (OWN.has(name)) continue;
      expect(palette[name as keyof typeof palette], name).toBe(value);
    }
  });

  for (const theme of ["dark", "light"] as const) {
    it(`${theme} copy matches its palette, key for key`, () => {
      const copy = tableTokensByTheme[theme];
      for (const [name, value] of Object.entries(copy)) {
        if (OWN.has(name)) continue;
        expect(palettes[theme][name as keyof typeof palette], `${theme} ${name}`).toBe(value);
      }
    });
  }

  it("lit is bone on Dark and paper on Light", () => {
    expect(tableTokensByTheme.dark.lit).toBe(palettes.dark.bone);
    expect(tableTokensByTheme.light.lit).toBe(palettes.light.paper);
  });

  it("both copies carry the same tokens", () => {
    expect(Object.keys(tableTokensByTheme.light).sort()).toEqual(Object.keys(tableTokensByTheme.dark).sort());
  });
});
