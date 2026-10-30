import { describe, expect, it } from "vitest";

import { floatingSurface, FLOATING_ALPHA, PRESSED_FILTER, segmentSurface, glassSurface, slateSurface, textSurface, chipSurface } from "./surfaces.ts";
import { tableTokens, tableTokensByTheme } from "./tokens.ts";

const lightTableTokens = tableTokensByTheme.light;

const alphas = (css: string) => [...css.matchAll(/rgba\([^)]*,([\d.]+)\)/g)].map((match) => Number(match[1]));

describe("the surfaces that float over the dock's words", () => {
  it("are opaque on both themes: every colour in the fill is at least 0.97", () => {
    for (const t of [tableTokens, lightTableTokens]) {
      const look = floatingSurface(t);
      const found = [...alphas(look.backgroundColor), ...alphas(look.backgroundImage ?? "")];
      expect(found.length).toBeGreaterThan(0);
      for (const alpha of found) expect(alpha).toBeGreaterThanOrEqual(0.97);
      expect(FLOATING_ALPHA).toBeGreaterThanOrEqual(0.97);
    }
  });
});

describe("a pressed button darkens", () => {
  it("keeps its rest fill and adds the darkening filter, on both themes", () => {
    for (const t of [tableTokens, lightTableTokens]) {
      for (const look of [slateSurface, glassSurface, (pressed: boolean, tokens: typeof t) => chipSurface(false, pressed, tokens), (pressed: boolean, tokens: typeof t) => chipSurface(true, pressed, tokens), (pressed: boolean, tokens: typeof t) => segmentSurface(tokens, pressed)]) {
        const rest = look(false, t);
        const held = look(true, t);
        expect(held.backgroundColor).toBe(rest.backgroundColor);
        expect(rest.filter).toBeUndefined();
        expect(held.filter).toBe(PRESSED_FILTER);
      }
      expect(textSurface(false, t).backgroundColor).toBe("transparent");
      expect(textSurface(true, t).backgroundColor).not.toBe("transparent");
    }
  });
});
