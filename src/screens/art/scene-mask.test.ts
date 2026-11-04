import { describe, expect, it } from "vitest";

import { cssMask, filterMatrix, rampPoints, sceneMask } from "./scene-mask";

describe("sceneMask", () => {
  it("fades the band out at its foot, and the box's right edge with edge", () => {
    const ramps = sceneMask({ width: 400, height: 560, band: 300, fade: 0.25, edge: true, edgeWidth: 96, soft: false });
    expect(ramps).toHaveLength(2);
    expect(rampPoints(ramps[0]!)).toEqual([
      { at: 75, alpha: 1 },
      { at: 187.5, alpha: 0.28 },
      { at: 300, alpha: 0 },
    ]);
    expect(rampPoints(ramps[1]!)).toEqual([
      { at: 304, alpha: 1 },
      { at: 400, alpha: 0 },
    ]);
  });

  it("leaves the right edge alone until the box is measured", () => {
    expect(sceneMask({ width: 0, height: 560, band: 560, fade: 0.25, edge: true, edgeWidth: 96, soft: false })).toHaveLength(1);
  });

  it("feathers every edge when soft", () => {
    const ramps = sceneMask({ width: 300, height: 200, band: 200, fade: 0.5, edge: false, edgeWidth: 96, soft: true });
    expect(ramps.map((ramp) => ramp.axis)).toEqual(["y", "y", "x"]);
    expect(cssMask(ramps)).toContain("linear-gradient(90deg, rgba(0,0,0,0) 0px, rgba(0,0,0,1) 27px");
  });
});

describe("filterMatrix", () => {
  it("is the identity with no change", () => {
    expect(filterMatrix(1, 1, 1).map((value) => Math.round(value * 1000) / 1000)).toEqual([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]);
  });

  it("keeps a grey grey and dims it by contrast then brightness", () => {
    const m = filterMatrix(0.62, 1.12, 0.8);
    const grey = 0.5;
    const red = m[0]! * grey + m[1]! * grey + m[2]! * grey + m[4]!;
    expect(red).toBeCloseTo(0.4, 6);
  });
});
