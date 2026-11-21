// The fog's shared data (src/ui/fog/fog.ts): a layer's mask, as the native and web backdrops and the combat spotlight draw it.
import { describe, expect, it } from "vitest";

import { banks, layerBox, maskStops, type FogLayer, type FogSet } from "./fog.ts";

describe("a fog layer's mask", () => {
  it("fades out from the middle (opaque to 10% of the radius, gone at 85%) unless inverted", () => {
    expect(maskStops(undefined)).toEqual({ positions: [0.1, 0.85], alphas: [1, 0] });
    expect(maskStops(false)).toEqual({ positions: [0.1, 0.85], alphas: [1, 0] });
  });

  it("inverted, is clear to 30% of the radius and full at the rim and beyond", () => {
    expect(maskStops(true)).toEqual({ positions: [0.3, 1], alphas: [0, 1] });
  });
});

describe("banks", () => {
  const set = { haze: { seed: 1 }, bank: { seed: 2 }, crest: { seed: 3 } } as unknown as FogSet;
  const mask = { cx: 0.5, cy: 0.5, rx: 0.4, ry: 0.3 };

  it("is the haze, the bank and the crest in one mask, at 0.6, 1 and 0.7 of the opacity", () => {
    expect(banks(set, 0.5, mask)).toEqual([
      { texture: set.haze, opacity: 0.3, mask },
      { texture: set.bank, opacity: 0.5, mask },
      { texture: set.crest, opacity: 0.35, mask },
    ]);
  });

  it("marks every layer inverted when asked, and none otherwise", () => {
    expect(banks(set, 1, mask, true).every((layer) => layer.invert === true)).toBe(true);
    expect(banks(set, 1, mask).some((layer) => "invert" in layer)).toBe(false);
  });
});

describe("the box a layer draws in", () => {
  const texture = {} as FogLayer["texture"];
  const layer = (mask: FogLayer["mask"], invert?: boolean): FogLayer => ({ texture, opacity: 1, mask, ...(invert ? { invert } : {}) });

  it("is the ellipse's bounds where its mask is gone (85% of the radii), rounded out a point, inside the screen", () => {
    // Centre (200, 100), radii 80 × 50 points: gone at 68 × 42.5.
    expect(layerBox(layer({ cx: 0.5, cy: 0.25, rx: 0.2, ry: 0.125 }), 400, 400)).toEqual({ x: 131, y: 56, width: 138, height: 88 });
    // Past the top left, it is cut at the screen's edge.
    expect(layerBox(layer({ cx: 0, cy: 0, rx: 0.5, ry: 0.5 }), 400, 400)).toEqual({ x: 0, y: 0, width: 171, height: 171 });
  });

  it("is the whole screen for a layer with no mask or an inverted one", () => {
    expect(layerBox(layer(null), 390, 844)).toEqual({ x: 0, y: 0, width: 390, height: 844 });
    expect(layerBox(layer({ cx: 0.5, cy: 0.5, rx: 0.2, ry: 0.2 }, true), 390, 844)).toEqual({ x: 0, y: 0, width: 390, height: 844 });
  });
});
