// The pose of a hand card while the scrub runs (phase 25).
import { describe, expect, it } from "vitest";

import { SHAPE } from "./motion-tokens.ts";
import { scrubPose } from "./scrub-pose.ts";

const slot = { x: 100, y: 300, w: 60, h: 84, tilt: 0.06 };
const target = { x: 40, y: 200, w: 90, h: 126, tilt: -0.14 };

describe("scrubPose", () => {
  it("is the layout's place at progress 0", () => {
    const pose = scrubPose(slot, target, { rise: 0, apart: 0, lift: 0 }, false);
    expect([pose.dx + 0, pose.dy + 0, pose.scale, pose.rot + 0]).toEqual([0, 0, 1, 0]);
  });

  it("is the spread's place at progress 1: centered on the target, at its size, at the fan's angle", () => {
    const pose = scrubPose(slot, target, { rise: 1, apart: 1, lift: 0 }, false);
    expect(slot.x + slot.w / 2 + pose.dx).toBeCloseTo(target.x + target.w / 2, 9);
    expect(slot.y + slot.h / 2 + pose.dy).toBeCloseTo(target.y + target.h / 2, 9);
    expect(slot.w * pose.scale).toBeCloseTo(target.w, 9);
    expect(pose.rot + slot.tilt).toBeCloseTo(target.tilt, 9);
  });

  it("rises and spreads on their own clocks", () => {
    const rising = scrubPose(slot, target, { rise: 1, apart: 0, lift: 0 }, false);
    expect(rising.dx + 0).toBe(0);
    expect(rising.dy).toBeLessThan(0);
    const spreading = scrubPose(slot, target, { rise: 0, apart: 1, lift: 0 }, false);
    expect(spreading.dy + 0).toBe(0);
    expect(spreading.dx).toBeLessThan(0);
    expect(spreading.scale).toBe(1);
  });

  it("lifts the card under the finger above the others, 1.25 larger, and leaves the rest alone", () => {
    const rest = scrubPose(slot, target, { rise: 1, apart: 1, lift: 0 }, false);
    const lifted = scrubPose(slot, target, { rise: 1, apart: 1, lift: 1 }, true);
    expect(lifted.scale / rest.scale).toBeCloseTo(SHAPE.scrubLiftScale, 9);
    expect(rest.dy - lifted.dy).toBeCloseTo(target.h * SHAPE.scrubLiftRise, 9);
    expect(scrubPose(slot, target, { rise: 1, apart: 1, lift: 1 }, false)).toEqual(rest);
    // The lifted card straightens so it can be read; the others keep the fan's angle.
    expect(lifted.rot + slot.tilt).toBeCloseTo(0, 9);
    expect(rest.rot + slot.tilt).toBeCloseTo(target.tilt, 9);
  });

  it("lifts nothing while the hand is down, whatever the lift clock says", () => {
    expect(scrubPose(slot, target, { rise: 0, apart: 0, lift: 1 }, true)).toEqual(scrubPose(slot, target, { rise: 0, apart: 0, lift: 0 }, true));
  });
});
