// The phase title sweep (phase 23): which phase changes sweep, and its fade and slide.
import { describe, expect, it } from "vitest";

import { SHAPE } from "./motion-tokens.ts";
import { sweepFrame, sweepName } from "./sweep.ts";

describe("sweepName", () => {
  it("names a new phase of the round", () => {
    expect(sweepName("Resource", "Planning", "normal", 1)).toBe("Planning");
    expect(sweepName("Combat", "Refresh", "normal", 1)).toBe("Refresh");
  });

  it("names nothing when the phase did not change", () => {
    expect(sweepName("Quest", "Quest", "normal", 1)).toBeNull();
  });

  it("names nothing for the setup, the mulligan or the round's ends", () => {
    for (const now of ["Setup", "Mulligan", "Beginning of round", "End of round", ""]) expect(sweepName("Refresh", now, "normal", 1)).toBeNull();
  });

  it("is skipped under Quick and under reduced motion", () => {
    expect(sweepName("Resource", "Planning", "quick", 0.6)).toBeNull();
    expect(sweepName("Resource", "Planning", "normal", 0)).toBeNull();
  });
});

describe("sweepFrame", () => {
  it("fades in, holds, fades out, and slides 40 pt across its run", () => {
    expect(sweepFrame(0, SHAPE.sweepSlide)).toEqual({ opacity: 0, offset: -20 });
    expect(sweepFrame(0.5, SHAPE.sweepSlide).opacity).toBe(1);
    expect(sweepFrame(0.5, SHAPE.sweepSlide).offset).toBeCloseTo(0, 9);
    expect(sweepFrame(1, SHAPE.sweepSlide)).toEqual({ opacity: 0, offset: 20 });
    expect(sweepFrame(0.125, SHAPE.sweepSlide).opacity).toBeCloseTo(0.5, 9);
  });
});
