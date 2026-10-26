// The motion tokens (phase 23): the scale, the 500 ms ceiling, and the curves they name.
import { describe, expect, it } from "vitest";

import { ease, springStep } from "./motion-curves.ts";
import { ARM_BAR_EASING, LONG_TOKENS, MAX_TOKEN_MS, MOTION, ms, motionScale, springTune, timed, type EasingName, type Spring, type Tween } from "./motion-tokens.ts";

const entries = Object.entries(MOTION) as [string, Tween | Spring][];
const springs = entries.filter((entry): entry is [string, Spring] => "zeta" in entry[1]);
const EASINGS: readonly EasingName[] = ["linear", "outCubic", "inCubic", "outQuad", "inQuad", "outBack"];

describe("motionScale", () => {
  it("is 1 for Normal, 0.6 for Quick and 0 under reduced motion", () => {
    expect(motionScale("normal", false)).toBe(1);
    expect(motionScale("quick", false)).toBe(0.6);
    expect(motionScale("normal", true)).toBe(0);
    expect(motionScale("quick", true)).toBe(0);
  });

  it("scales a token to whole milliseconds, and to nothing under reduced motion", () => {
    expect(ms(MOTION.trayEnter, 1)).toBe(260);
    expect(ms(MOTION.trayEnter, 0.6)).toBe(156);
    expect(ms(MOTION.trayEnter, motionScale("normal", true))).toBe(0);
  });

  it("gives a layout animation its scaled length and nothing else", () => {
    const seen: number[] = [];
    const anim = { duration: (length: number) => (seen.push(length), "built") };
    expect(timed(anim, MOTION.menuEnter, 0.6)).toBe("built");
    expect(timed(anim, MOTION.menuEnter, 0)).toBe("built");
    expect(seen).toEqual([120, 0]);
  });
});

describe("the tokens", () => {
  it("are each at most 500 ms, except the sweep and the spotlight", () => {
    for (const [name, token] of entries) {
      if (LONG_TOKENS.includes(name)) continue;
      expect(token.ms, name).toBeGreaterThan(0);
      expect(token.ms, name).toBeLessThanOrEqual(MAX_TOKEN_MS);
    }
    expect(MOTION.sweep.ms).toBe(900);
  });

  it("keep the values the earlier phases named", () => {
    expect(MOTION.railSlide.ms).toBe(280);
    expect(MOTION.railFlash.ms).toBe(300);
    expect(MOTION.railFlashIn.ms + MOTION.railFlashOut.ms).toBe(MOTION.railFlash.ms);
    expect(MOTION.seatPulseHalf.ms * 2).toBe(MOTION.seatPulse.ms);
    expect(MOTION.toastIn.ms).toBe(160);
    expect(MOTION.toastOut.ms).toBe(120);
    expect(MOTION.railStep.ms).toBe(200);
    expect(MOTION.carouselEnter.ms).toBe(240);
    expect(MOTION.carouselLeave.ms).toBe(180);
    expect(MOTION.trayEnter.ms).toBe(260);
    expect(MOTION.trayLeave.ms).toBe(180);
    expect(MOTION.menuEnter.ms).toBe(200);
    expect(MOTION.menuLeave.ms).toBe(150);
    expect(MOTION.bannerIn.ms).toBe(260);
    expect(MOTION.bannerOut.ms).toBe(260);
  });

  it("name only curves that exist", () => {
    for (const [name, token] of entries) if ("easing" in token && token.easing) expect(EASINGS, name).toContain(token.easing);
    expect(EASINGS).toContain(ARM_BAR_EASING);
  });
});

describe("curves", () => {
  it("start at 0 and end at 1", () => {
    for (const name of EASINGS) {
      expect(ease(name, 0), name).toBeCloseTo(0, 9);
      expect(ease(name, 1), name).toBeCloseTo(1, 9);
    }
  });

  it("decelerate when they ease out, accelerate when they ease in, and overshoot with a back", () => {
    expect(ease("outCubic", 0.5)).toBeGreaterThan(0.5);
    expect(ease("inCubic", 0.5)).toBeLessThan(0.5);
    const back = Array.from({ length: 21 }, (_, index) => ease("outBack", index / 20));
    expect(Math.max(...back)).toBeGreaterThan(1);
    expect(Math.max(...back)).toBeLessThan(1.1);
  });

  it("settle every spring within 3% of 1 by its length, and snap to 1 there", () => {
    expect(springs.length).toBeGreaterThan(0);
    for (const [name, spring] of springs) {
      expect(springStep(0, spring), name).toBe(0);
      expect(springStep(spring.ms, spring), name).toBe(1);
      expect(Math.abs(springStep(spring.ms - 1, spring) - 1), name).toBeLessThan(0.03);
    }
  });

  it("overshoot 1 on a spring with room to", () => {
    const peak = Math.max(...Array.from({ length: 100 }, (_, index) => springStep(index * 3.5, MOTION.exhaust)));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.2);
  });

  it("hand Reanimated a stiffness and damping that match the damping ratio", () => {
    for (const [name, spring] of springs) {
      const tune = springTune(spring);
      expect(tune.damping / (2 * Math.sqrt(tune.stiffness * tune.mass)), name).toBeCloseTo(spring.zeta, 9);
    }
  });
});
