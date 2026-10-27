// The motion tokens (phase 23): the scale, the 500 ms ceiling, and the curves they name.
import { describe, expect, it } from "vitest";

import { ease, springStep } from "./motion-curves.ts";
import { ARM_BAR_EASING, LONG_TOKENS, MAX_TOKEN_MS, MOTION, ms, motionScale, SHAPE, SPOTLIGHT_BEATS, springTune, timed, type EasingName, type Spring, type Tween } from "./motion-tokens.ts";

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

  it("let only the sweep and the whole spotlight run pass 500 ms", () => {
    expect(entries.filter(([, token]) => token.ms > MAX_TOKEN_MS).map(([name]) => name).sort()).toEqual(["spotlight", "sweep"]);
    expect([...LONG_TOKENS].sort()).toEqual(["spotlight", "sweep"]);
  });

  it("make a spotlight of at most 1.6 s at Normal and 0.6 of it at Quick, each beat at most 500 ms", () => {
    for (const name of SPOTLIGHT_BEATS) expect(MOTION[name].ms, name).toBeLessThanOrEqual(MAX_TOKEN_MS);
    for (const name of ["spotlightBurstStep", "spotlightBurstFly", "spotlightBounceRise", "spotlightBounceSettle", "spotlightFall", "spotlightSwap", "spotlightDrawAgain", "spotlightScrim"] as const) expect(MOTION[name].ms, name).toBeLessThanOrEqual(MAX_TOKEN_MS);
    // The six beats, in order, are the run.
    expect(SPOTLIGHT_BEATS.reduce((sum, name) => sum + MOTION[name].ms, 0)).toBe(MOTION.spotlight.ms);
    expect(MOTION.spotlight.ms).toBeLessThanOrEqual(1600);
    expect(ms(MOTION.spotlight, motionScale("normal", false))).toBeLessThanOrEqual(1600);
    expect(ms(MOTION.spotlight, motionScale("quick", false))).toBe(900);
    // Reduced motion plays none.
    expect(ms(MOTION.spotlight, motionScale("normal", true))).toBe(0);
    // The beats of the table's sequence: 250 dim, 250 draw back, 150 lunge, 80 hold, 370 impact, 400 return.
    expect(SPOTLIGHT_BEATS.map((name) => MOTION[name].ms)).toEqual([250, 250, 150, 80, 370, 400]);
    // A later attack of the same state swaps in (150 ms) instead of dimming, and draws back in 125; the scrim over the bar and the dock takes 100.
    expect([MOTION.spotlightSwap.ms, MOTION.spotlightDrawAgain.ms, MOTION.spotlightScrim.ms]).toEqual([150, 125, 100]);
    expect(MOTION.spotlightSwap.ms + MOTION.spotlightDrawAgain.ms + MOTION.spotlightLunge.ms + MOTION.spotlightHold.ms + MOTION.spotlightImpact.ms).toBe(875);
    // The burst fits the impact: three tokens 90 ms apart, the last landing as the impact ends.
    expect(2 * MOTION.spotlightBurstStep.ms + MOTION.spotlightBurstFly.ms).toBe(MOTION.spotlightImpact.ms);
  });

  it("keep the values the earlier phases named", () => {
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

describe("the hand scrub's tokens (phase 25)", () => {
  it("rise and spread in 220 ms with an ease-out cubic, the lift in 120 and the settle in 180", () => {
    expect(MOTION.scrubRise).toEqual({ ms: 220, easing: "outCubic" });
    expect(MOTION.scrubSpread).toEqual({ ms: 220, easing: "outCubic" });
    expect(MOTION.scrubLift).toEqual({ ms: 120, easing: "outCubic" });
    expect(MOTION.scrubFall).toEqual({ ms: 180, easing: "inCubic" });
    for (const token of [MOTION.scrubRise, MOTION.scrubSpread, MOTION.scrubLift, MOTION.scrubFall]) expect(token.ms).toBeLessThanOrEqual(MAX_TOKEN_MS);
  });

  it("scale to 0.6 at Quick and to nothing under reduced motion", () => {
    expect(ms(MOTION.scrubRise, motionScale("quick", false))).toBe(132);
    expect(ms(MOTION.scrubSpread, motionScale("quick", false))).toBe(132);
    expect(ms(MOTION.scrubRise, motionScale("normal", true))).toBe(0);
  });

  it("keep the scrub's shapes: the hand grows to 1.5, the lifted card 1.25 more, the rest of the table dims to 35% night", () => {
    expect(SHAPE.scrubScale).toBe(1.5);
    expect(SHAPE.scrubLiftScale).toBe(1.25);
    expect(SHAPE.scrubNight).toBe(0.35);
    expect(SHAPE.scrubNight).toBeLessThan(SHAPE.spotlightNight);
  });
});

describe("the peek's shape (phase 26)", () => {
  it("keeps a 30% night veil on the hand (lighter than the scrub's 35%); the peek itself has no motion", () => {
    expect(SHAPE.peekVeil).toBe(0.3);
    expect(SHAPE.peekVeil).toBeLessThan(SHAPE.scrubNight);
  });
});
