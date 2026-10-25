import { describe, expect, it } from "vitest";

import { previewSideSize, previewSize } from "./preview-size.ts";

describe("the long-press preview", () => {
  it("fills a phone's width with a portrait card and leaves room for the buttons", () => {
    const size = previewSize(390, 760, false);
    expect(size.width).toBe(342);
    expect(size.height).toBeLessThanOrEqual(760 - 140);
    expect(size.width / size.height).toBeCloseTo(0.705, 2);
  });

  it("is bounded by the height on a short screen and on a tablet by a reading size", () => {
    expect(previewSize(800, 400, false).height).toBeLessThanOrEqual(260);
    expect(previewSize(1024, 1366, false).width).toBe(440);
  });

  it("lays a quest card on its side", () => {
    const size = previewSize(390, 760, true);
    expect(size.width).toBeGreaterThan(size.height);
    expect(size.width).toBeLessThanOrEqual(358);
  });

  it("on a landscape table, stands the card at the left as tall as the screen and leaves the right for its effects", () => {
    const size = previewSideSize(844, 390, false);
    expect(size.height).toBe(390 - 32);
    expect(size.width).toBeLessThan(844 * 0.55);
    expect(size.width / size.height).toBeCloseTo(0.705, 2);
    expect(previewSideSize(844, 390, true).width).toBeGreaterThan(previewSideSize(844, 390, true).height);
  });
});
