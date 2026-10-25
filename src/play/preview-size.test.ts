import { describe, expect, it } from "vitest";

import { previewSize } from "./preview-size.ts";

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
});
