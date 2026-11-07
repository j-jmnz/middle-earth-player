// The effective Strong outlines from the setting and the phone, the body face under Bold Text and Plain titles, and Reduce Transparency's solid fills.
import { describe, expect, it } from "vitest";

import { faceClass } from "./faces.ts";
import { panelSurface, rowSurface } from "./surfaces.ts";
import { strongOutlines } from "./table-settings.ts";
import { fillAlpha, tokensFor } from "./tokens.ts";

describe("strongOutlines", () => {
  it("follows the phone under Follow system, and Always and Off decide it", () => {
    expect(strongOutlines("system", false)).toBe(false);
    expect(strongOutlines("system", true)).toBe(true);
    expect(strongOutlines("always", false)).toBe(true);
    expect(strongOutlines("off", true)).toBe(false);
  });
});

describe("faceClass", () => {
  const normal = { bold: false, plain: false };
  it("is the body face unless the class asks for the display one, as before", () => {
    expect(faceClass(undefined, normal)).toBe("font-body");
    expect(faceClass("text-body font-semibold", normal)).toBe("font-body text-body font-semibold");
    expect(faceClass("font-display text-title", normal)).toBe("font-display text-title");
  });

  it("draws the body face one weight heavier under Bold Text: 400 to 600, 600 to 700, 700 stays", () => {
    const bold = { bold: true, plain: false };
    expect(faceClass("text-body", bold)).toBe("font-body font-semibold text-body");
    expect(faceClass("text-body font-medium", bold)).toBe("font-body font-semibold text-body");
    expect(faceClass("text-body font-semibold", bold)).toBe("font-body font-bold text-body");
    expect(faceClass("text-body font-bold", bold)).toBe("font-body font-bold text-body");
    expect(faceClass("text-body italic", bold)).toBe("font-body text-body italic");
  });

  it("leaves Marcellus SC alone under Bold Text (it has one weight)", () => {
    expect(faceClass("font-display text-title", { bold: true, plain: false })).toBe("font-display text-title");
  });

  it("draws a plain title in Barlow semibold, as written, and bold under Bold Text", () => {
    expect(faceClass("font-display text-title", { bold: false, plain: true })).toBe("font-body font-semibold text-title");
    expect(faceClass("font-display text-eyebrow uppercase", { bold: false, plain: true })).toBe("font-body font-semibold text-eyebrow uppercase");
    expect(faceClass("font-display text-title", { bold: true, plain: true })).toBe("font-body font-bold text-title");
    expect(faceClass("text-body", { bold: false, plain: true })).toBe("font-body text-body");
  });
});

const alphas = (css: string | undefined) => [...(css ?? "").matchAll(/rgba\([^)]*,([\d.]+)\)/g)].map((match) => Number(match[1]));

describe("Reduce Transparency", () => {
  it("keeps the clear tokens' alphas and makes the solid ones' fills opaque", () => {
    for (const theme of ["dark", "light"] as const) {
      const clear = tokensFor(theme, false);
      const solid = tokensFor(theme, true);
      expect(fillAlpha(clear, 0.9)).toBe(0.9);
      expect(fillAlpha(solid, 0.9)).toBe(1);
      expect(Math.min(...alphas(panelSurface(false, clear).backgroundImage))).toBeLessThan(1);
      expect(alphas(panelSurface(false, solid).backgroundImage).every((alpha) => alpha === 1)).toBe(true);
      expect(alphas(rowSurface(false, solid).backgroundColor)).toEqual([1]);
    }
    expect(tokensFor("dark", true)).toBe(tokensFor("dark", true));
  });
});
