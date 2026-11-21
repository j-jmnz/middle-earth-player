// The volume slider's numbers: steps of 5%, a touch on the track, the reader's 10% adjust and the words.
import { describe, expect, it } from "vitest";

import { clampVolume, stepVolume, volumeAt, volumeWords } from "./volume.ts";

describe("volume", () => {
  it("keeps a volume between 0 and 1 on a 5% step", () => {
    expect(clampVolume(0.83)).toBeCloseTo(0.85);
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(4)).toBe(1);
    expect(clampVolume(Number.NaN)).toBe(0);
  });

  it("reads a touch along the track", () => {
    expect(volumeAt(150, 200)).toBeCloseTo(0.75);
    expect(volumeAt(-20, 200)).toBe(0);
    expect(volumeAt(250, 200)).toBe(1);
    expect(volumeAt(10, 0)).toBe(0);
  });

  it("adjusts 10% at a time and says the volume as a percentage", () => {
    expect(stepVolume(0.8, true)).toBeCloseTo(0.9);
    expect(stepVolume(0.95, true)).toBe(1);
    expect(stepVolume(0.05, false)).toBe(0);
    expect(volumeWords(0.8)).toBe("80%");
  });
});
