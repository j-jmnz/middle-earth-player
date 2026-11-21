// The motion tokens (phase 23): the scale, the 500 ms ceiling, and the curves they name.
import { describe, expect, it } from "vitest";

import { ease, springStep } from "./curves.ts";
import { SPOT_FOG } from "../spotlight/fog.ts";
import { ARM_BAR_EASING, LONG_TOKENS, MAX_TOKEN_MS, MOTION, ms, motionScale, SHAPE, SPOTLIGHT_AGAIN, SPOTLIGHT_AGAIN_BEATS, SPOTLIGHT_BEATS, springTune, timed, type EasingName, type Spring, type Tween } from "../../ui/motion-tokens.ts";

const entries = Object.entries(MOTION) as [string, Tween | Spring][];
const springs = entries.filter((entry): entry is [string, Spring] => "zeta" in entry[1]);
const EASINGS: readonly EasingName[] = ["linear", "outCubic", "inCubic", "outQuad", "inQuad", "outBack", "inOutSine"];

describe("motionScale", () => {
  it("is 1 for Normal, 0.6 for Quick and 0 under reduced motion", () => {
    expect(motionScale("normal", false)).toBe(1);
    expect(motionScale("quick", false)).toBe(0.6);
    expect(motionScale("slow", false)).toBe(1.5);
    expect(motionScale("normal", true)).toBe(0);
    expect(motionScale("quick", true)).toBe(0);
    expect(motionScale("slow", true)).toBe(0);
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
  it("are each at most 500 ms, except the sweep, the spotlight, the particle lives and the splash breath", () => {
    for (const [name, token] of entries) {
      if (LONG_TOKENS.includes(name)) continue;
      expect(token.ms, name).toBeGreaterThan(0);
      expect(token.ms, name).toBeLessThanOrEqual(MAX_TOKEN_MS);
    }
    expect(MOTION.sweep.ms).toBe(900);
  });

  it("let only the sweep, the whole spotlight run, its count and hold, the life of its ash and the splash breath pass 500 ms", () => {
    expect(entries.filter(([, token]) => token.ms > MAX_TOKEN_MS).map(([name]) => name).sort()).toEqual(["splashBreath", "spotlight", "spotlightAsh", "spotlightCount", "spotlightHold", "sweep"]);
    expect([...LONG_TOKENS].sort()).toEqual(["splashBreath", "spotlight", "spotlightAsh", "spotlightCount", "spotlightHold", "sweep"]);
  });

  it("make a spotlight of 3200 ms at Normal and 1920 at Quick, each beat at most 500 ms apart from the count and the hold", () => {
    for (const name of SPOTLIGHT_BEATS) if (!LONG_TOKENS.includes(name)) expect(MOTION[name].ms, name).toBeLessThanOrEqual(MAX_TOKEN_MS);
    // The nine beats, in order, are the run.
    expect(SPOTLIGHT_BEATS.reduce((sum, name) => sum + MOTION[name].ms, 0)).toBe(MOTION.spotlight.ms);
    expect(MOTION.spotlight.ms).toBe(3200);
    expect(ms(MOTION.spotlight, motionScale("normal", false))).toBe(3200);
    expect(ms(MOTION.spotlight, motionScale("quick", false))).toBe(1920);
    expect(ms(MOTION.spotlight, motionScale("slow", false))).toBe(4800);
    // Reduced motion plays none.
    expect(ms(MOTION.spotlight, motionScale("normal", true))).toBe(0);
    expect(SPOTLIGHT_BEATS.map((name) => MOTION[name].ms)).toEqual([300, 300, 250, 120, 100, 280, 800, 550, 500]);
    // A later attack of the same state swaps in (200 ms) instead of entering, reads in 100 and charges in 200, then counts and holds: 2350 ms in all.
    expect(SPOTLIGHT_AGAIN_BEATS.reduce((sum, name) => sum + MOTION[name].ms, 0)).toBe(SPOTLIGHT_AGAIN);
    expect(SPOTLIGHT_AGAIN).toBe(2350);
    expect([MOTION.spotlightSwap.ms, MOTION.spotlightReadAgain.ms, MOTION.spotlightChargeAgain.ms]).toEqual([200, 100, 200]);
    // The burn runs inside the return.
    expect(MOTION.spotlightBurn).toEqual({ ms: 450, easing: "inQuad" });
    expect(MOTION.spotlightBurn.ms).toBeLessThanOrEqual(MOTION.spotlightReturn.ms);
    // The sub-tokens, none past 500 ms.
    for (const name of ["spotlightFlash", "spotlightRing", "spotlightSparks", "spotlightShake", "spotlightResultRise", "spotlightResultSettle", "spotlightShieldStep", "spotlightBurstStep", "spotlightBurstFly", "spotlightFocus", "spotlightRecoil", "spotlightFlip", "spotlightGlint", "spotlightTrailStep", "spotlightConverge", "spotlightEmber", "spotlightStopKill"] as const) expect(MOTION[name].ms, name).toBeLessThanOrEqual(MAX_TOKEN_MS);
    // A kill stops for 160 ms, the extra 60 coming out of the impact.
    expect(MOTION.spotlightStopKill.ms).toBe(160);
    expect(MOTION.spotlightStopKill.ms - MOTION.spotlightStop.ms).toBeLessThan(MOTION.spotlightImpact.ms);
    expect([MOTION.spotlightConverge.ms, MOTION.spotlightAsh.ms]).toEqual([500, 1100]);
    expect([MOTION.spotlightFlash.ms, MOTION.spotlightRing.ms, MOTION.spotlightSparks.ms, MOTION.spotlightShake.ms]).toEqual([160, 360, 450, 420]);
    expect(MOTION.spotlightResultRise.ms).toBe(140);
    expect(MOTION.spotlightResultSettle).toEqual({ ms: 260, zeta: 0.5 });
    expect(MOTION.spotlightRecoil).toEqual({ ms: 320, zeta: 0.5 });
    expect([MOTION.spotlightFocus.ms, MOTION.spotlightFlip.ms, MOTION.spotlightGlint.ms, MOTION.spotlightTrailStep.ms]).toEqual([150, 300, 260, 16]);
    // The count fits two shields 130 ms apart and three tokens 150 ms apart, the last landing inside it.
    expect([MOTION.spotlightShieldStep.ms, MOTION.spotlightBurstStep.ms, MOTION.spotlightCount.ms]).toEqual([130, 150, 800]);
    expect(2 * MOTION.spotlightShieldStep.ms + 2 * MOTION.spotlightBurstStep.ms + MOTION.spotlightBurstFly.ms).toBeLessThanOrEqual(MOTION.spotlightCount.ms);
    expect(MOTION.spotlightFlash.ms).toBeLessThan(MOTION.spotlightImpact.ms);
    // The shake runs on into the start of the count: it moves the cards, not the gauge, and is faint by then.
    expect(MOTION.spotlightShake.ms).toBeLessThanOrEqual(MOTION.spotlightImpact.ms + MOTION.spotlightCount.ms);
  });

  it("have dropped the tokens the redesign replaced", () => {
    for (const name of ["spotlightDim", "spotlightDraw", "spotlightDrawAgain", "spotlightFall", "spotlightScrim", "spotlightBounceRise", "spotlightBounceSettle"]) expect(name in MOTION, name).toBe(false);
  });

  it("keep the values the earlier phases named", () => {
    expect(MOTION.railFlash.ms).toBe(300);
    expect(MOTION.railFlashIn.ms + MOTION.railFlashOut.ms).toBe(MOTION.railFlash.ms);
    expect(MOTION.seatPulseHalf.ms * 2).toBe(MOTION.seatPulse.ms);
    expect(MOTION.toastIn.ms).toBe(160);
    expect(MOTION.toastOut.ms).toBe(120);
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

  it("keep the scrub's shapes: the hand grows to 1.5, the lifted card 1.55 more and its neighbours 1.15 and 1.05, the rest of the table dims to 35% night", () => {
    expect(SHAPE.scrubScale).toBe(1.5);
    expect(SHAPE.scrubLiftScale).toBe(1.55);
    expect(SHAPE.scrubLiftRise).toBe(0.25);
    expect(SHAPE.scrubNight).toBe(0.35);
    expect(SHAPE.scrubNight).toBeLessThan(SPOT_FOG.flat.dark);
  });
});

describe("the peek's shape (phase 26)", () => {
  it("keeps a 30% night veil on the hand (lighter than the scrub's 35%); the peek itself has no motion", () => {
    expect(SHAPE.peekVeil).toBe(0.3);
    expect(SHAPE.peekVeil).toBeLessThan(SHAPE.scrubNight);
  });
});
