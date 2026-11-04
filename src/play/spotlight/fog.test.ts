// The combat spotlight's black fog (spotlight/fog.ts; user request, 2026-11-04): the backdrop's banks in black, dense at the screen's edges
// and clear over the stage, and a bank along each attack's feet.
import { describe, expect, it } from "vitest";

import { BLACK_FOG, EDGE_FOG, feetFog, SPOT_FOG } from "./fog.ts";
import { SPOT } from "./shape.ts";

describe("the spotlight's black fog", () => {
  it("is black, with a soot grey crest so a bank keeps a lit edge", () => {
    for (const texture of [BLACK_FOG.haze, BLACK_FOG.bank]) expect(Math.max(...texture.rgb)).toBeLessThanOrEqual(8);
    expect(Math.max(...BLACK_FOG.crest.rgb)).toBeLessThanOrEqual(64);
    expect(Math.abs(BLACK_FOG.crest.rgb[0] - BLACK_FOG.crest.rgb[1])).toBeLessThan(10);
  });

  it("closes in from the edges about the stage's middle: every edge layer is inverted and centred on it", () => {
    expect(EDGE_FOG).toHaveLength(6);
    for (const layer of EDGE_FOG) {
      expect(layer.invert).toBe(true);
      expect(layer.mask).toMatchObject({ cx: 0.5, cy: SPOT.centerY });
    }
  });

  it("lays the feet bank along the whole group, just under the cards' feet, fading out at its rim", () => {
    const at = { left: 200, right: 640, feet: 300, cardH: 234 };
    const layers = feetFog(at, 844, 390);
    expect(layers.map((layer) => layer.texture)).toEqual([BLACK_FOG.haze, BLACK_FOG.bank, BLACK_FOG.crest]);
    for (const layer of layers) {
      expect(layer.invert).toBeUndefined();
      expect((layer.mask?.cx ?? 0) * 844).toBeCloseTo(420, 6);
      expect((layer.mask?.cy ?? 0) * 390).toBeCloseTo(300 + SPOT_FOG.feetDrop * 234, 6);
      expect((layer.mask?.rx ?? 0) * 844).toBeCloseTo(SPOT_FOG.feetWidth * 440, 6);
      expect((layer.mask?.ry ?? 0) * 390).toBeCloseTo(SPOT_FOG.feetHeight * 234, 6);
    }
  });

  it("keeps a deeper flat dark on the Light theme, so its parchment reads as the same dark stage", () => {
    expect(SPOT_FOG.flat.light).toBeGreaterThan(SPOT_FOG.flat.dark);
    expect(SPOT_FOG.flat.light).toBeLessThan(1);
  });
});
