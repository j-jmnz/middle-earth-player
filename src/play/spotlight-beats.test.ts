// The combat spotlight's beats (phase 24): the six beats add up to the run, the run is at most 1.6 s at Normal and 0.6 of it at Quick,
// and a frame at any moment is the pose the table's sequence describes.
import { describe, expect, it } from "vitest";

import { MOTION, SHAPE, SPOTLIGHT_BEATS } from "./motion-tokens.ts";
import { beatsAt, burstAt, burstGap, frameAt, hitTime, leaveTime, scrimAt, spotlightSpan, type ClashShape } from "./spotlight-beats.ts";

const HIT: ClashShape = { damage: 3, destroyed: false, shadow: false };
const BLOCKED: ClashShape = { damage: 0, destroyed: false, shadow: false };
const KILL: ClashShape = { damage: 2, destroyed: true, shadow: false };
const RAD = Math.PI / 180;

describe("the beats of one attack", () => {
  it("run dim, draw, lunge, hold, impact and return in order, 1500 ms in all at Normal", () => {
    const b = beatsAt(1);
    expect([b.drawAt, b.lungeAt, b.holdAt, b.impactAt, b.retAt, b.end]).toEqual([250, 500, 650, 730, 1100, 1500]);
    expect(SPOTLIGHT_BEATS.reduce((sum, name) => sum + MOTION[name].ms, 0)).toBe(MOTION.spotlight.ms);
    expect(b.end).toBe(MOTION.spotlight.ms);
    expect(b.end).toBeLessThanOrEqual(1600);
  });

  it("run at 0.6 under Quick, about 0.9 s, and every beat scales with it", () => {
    const quick = beatsAt(0.6);
    expect(quick.end).toBe(900);
    const normal = beatsAt(1);
    for (const key of ["dim", "draw", "lunge", "hold", "impact", "ret"] as const) expect(quick[key], key).toBeCloseTo(normal[key] * 0.6, 6);
  });

  it("add up for several attacks one after another, and name when each lands and when the last goes back", () => {
    expect(spotlightSpan(1)).toBe(1500);
    expect(spotlightSpan(3)).toBe(4500);
    expect(hitTime(0, 1)).toBe(650);
    expect(hitTime(2, 1)).toBe(2 * 1500 + 650);
    expect(hitTime(1, 0.6)).toBeCloseTo(900 + 390, 6);
    expect(leaveTime(1, 1)).toBe(1100);
    expect(leaveTime(2, 1)).toBe(1500 + 1100);
  });

  it("is one frame at any speed: Quick at 0.6 of a moment is Normal at that moment", () => {
    for (const shape of [HIT, BLOCKED, KILL, { damage: 1, destroyed: false, shadow: true }]) {
      for (const t of [0, 120, 260, 420, 540, 700, 780, 900, 1090, 1200, 1400, 1499]) {
        const normal = frameAt(shape, t, 1);
        const quick = frameAt(shape, t * 0.6, 0.6);
        for (const key of Object.keys(normal) as (keyof typeof normal)[]) {
          if (typeof normal[key] === "number") expect(quick[key] as number, `${key} at ${t}`).toBeCloseTo(normal[key] as number, 4);
          else expect(quick[key], `${key} at ${t}`).toBe(normal[key]);
        }
      }
    }
  });
});

describe("a frame", () => {
  it("starts with nothing flown out and ends with everything back in its slot", () => {
    const start = frameAt(HIT, 0, 1);
    expect([start.flyAttackers, start.flyTarget, start.pills, start.strike, start.tilt, start.shake]).toEqual([0, 0, 0, 0, 0, 0]);
    const end = frameAt(HIT, 1500, 1);
    expect([end.flyAttackers, end.flyTarget, end.pills, end.strike]).toEqual([0, 0, 0, 0]);
    expect(end.shake).toBeCloseTo(0, 9);
    const there = frameAt(HIT, 250, 1);
    expect([there.flyAttackers, there.flyTarget, there.pills]).toEqual([1, 1, 1]);
  });

  it("draws the attacker back 10 pt and tilts it 4 degrees away, then lunges to touch the target", () => {
    const drawn = frameAt(HIT, 500, 1);
    expect(drawn.strike).toBeCloseTo(-SHAPE.spotlightDrawBack, 6);
    expect(drawn.tilt).toBeCloseTo(-SHAPE.spotlightTilt * RAD, 6);
    // The lunge goes the draw back and the 24 pt gap, and the tilt comes back.
    const touching = frameAt(HIT, 650, 1);
    expect(touching.strike).toBeCloseTo(SHAPE.spotlightGap, 6);
    expect(touching.tilt).toBeCloseTo(0, 6);
    expect(frameAt(HIT, 575, 1).strike).toBeGreaterThan(-SHAPE.spotlightDrawBack);
    expect(frameAt(HIT, 575, 1).strike).toBeLessThan(SHAPE.spotlightGap);
  });

  it("holds everything for the hit stop: the strike and the target do not move between 650 and 730 ms", () => {
    for (const t of [650, 690, 729]) {
      const held = frameAt(HIT, t, 1);
      expect(held.strike).toBeCloseTo(SHAPE.spotlightGap, 6);
      expect(held.shake).toBe(0);
    }
  });

  it("shakes the target at most 5 pt through three swings that die away", () => {
    const samples = Array.from({ length: 370 }, (_, index) => frameAt(HIT, 730 + index, 1).shake);
    expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(SHAPE.spotlightShake);
    expect(Math.max(...samples.map(Math.abs))).toBeGreaterThan(SHAPE.spotlightShake * 0.8);
    // Three swings: the offset crosses zero five times between its start and its end.
    const crossings = samples.slice(1).filter((value, index) => Math.sign(value) !== 0 && Math.sign(samples[index] ?? 0) !== 0 && Math.sign(value) !== Math.sign(samples[index] ?? 0)).length;
    expect(crossings).toBe(5);
    // Each swing is smaller than the one before it.
    const peaks = [0, 1, 2].map((swing) => Math.max(...samples.slice(Math.round((swing * 370) / 3), Math.round(((swing + 1) * 370) / 3)).map(Math.abs)));
    expect(peaks[0]).toBeGreaterThan(peaks[1] ?? 0);
    expect(peaks[1]).toBeGreaterThan(peaks[2] ?? 0);
    expect(frameAt(HIT, 1100, 1).shake).toBeCloseTo(0, 6);
  });

  it("bounces the defense of a blocked attack once, 1 to 1.25 and back, with the word Blocked", () => {
    const bounces = Array.from({ length: 700 }, (_, index) => frameAt(BLOCKED, 730 + index, 1).bounce);
    expect(Math.max(...bounces)).toBeCloseTo(SHAPE.spotlightBounce, 1);
    expect(Math.max(...bounces)).toBeGreaterThanOrEqual(SHAPE.spotlightBounce);
    expect(bounces[bounces.length - 1]).toBeCloseTo(1, 2);
    expect(frameAt(BLOCKED, 700, 1).bounce).toBe(1);
    expect(frameAt(BLOCKED, 1000, 1).word).toBeGreaterThan(0.9);
    // An attack that dealt damage bounces nothing and says nothing.
    expect(frameAt(HIT, 800, 1).bounce).toBe(1);
    expect(frameAt(HIT, 1000, 1).word).toBe(0);
  });

  it("pops the count when the last token has landed, with phase 23's pop, and not before", () => {
    const b = beatsAt(1);
    const lands = b.impactAt + 2 * burstGap(3, 1) + MOTION.spotlightBurstFly.ms;
    expect(lands).toBe(1100);
    expect(frameAt(HIT, lands - 1, 1)).toMatchObject({ landed: false, pop: 1 });
    expect(frameAt(HIT, lands + 1, 1).landed).toBe(true);
    const pops = Array.from({ length: 300 }, (_, index) => frameAt(HIT, lands + index, 1).pop);
    expect(Math.max(...pops)).toBeGreaterThan(1.3);
    expect(Math.max(...pops)).toBeLessThanOrEqual(SHAPE.tokenPop + 0.1);
    expect(pops[pops.length - 1]).toBeCloseTo(1, 1);
    expect(frameAt(BLOCKED, 1200, 1).landed).toBe(false);
  });

  it("greys a destroyed target and drops it 12 pt as the others return, leaving it in the middle", () => {
    expect(frameAt(KILL, 1099, 1)).toMatchObject({ fall: 0, flyTarget: 1 });
    const falling = frameAt(KILL, 1350, 1);
    expect(falling.fall).toBeCloseTo(1, 6);
    expect(falling.flyTarget).toBe(1);
    expect(falling.flyAttackers).toBeLessThan(1);
    expect(frameAt(KILL, 1500, 1).flyAttackers).toBe(0);
    expect(frameAt(HIT, 1350, 1).fall).toBe(0);
    expect(frameAt(HIT, 1350, 1).flyTarget).toBeLessThan(1);
  });

  it("turns a shadow card over from the draw back on, and never one that was not turned", () => {
    const turns: ClashShape = { damage: 1, destroyed: false, shadow: true };
    expect(frameAt(turns, 250, 1).flip).toBe(0);
    expect(frameAt(turns, 250 + MOTION.cardFlip.ms / 2, 1).flip).toBeCloseTo(0.5, 6);
    expect(frameAt(turns, 250 + MOTION.cardFlip.ms, 1).flip).toBe(1);
    expect(frameAt(HIT, 400, 1).flip).toBe(0);
  });
});

describe("the damage tokens", () => {
  it("leave the point of contact 90 ms apart, one for each damage, and all land by the end of the impact", () => {
    expect(burstGap(1, 1)).toBe(0);
    expect(burstGap(3, 1)).toBe(MOTION.spotlightBurstStep.ms);
    for (let damage = 1; damage <= 12; damage += 1) {
      const gap = burstGap(damage, 1);
      expect(gap).toBeLessThanOrEqual(MOTION.spotlightBurstStep.ms);
      expect(730 + (damage - 1) * gap + MOTION.spotlightBurstFly.ms, `damage ${damage}`).toBeLessThanOrEqual(1100 + 1e-6);
    }
    // More than three squeeze together rather than run past the impact.
    expect(burstGap(6, 1)).toBeLessThan(MOTION.spotlightBurstStep.ms);
  });

  it("fly one after another from 0 to 1, in the air only while they fly", () => {
    expect(burstAt(0, 3, 729, 1).flying).toBe(false);
    expect(burstAt(0, 3, 730, 1)).toMatchObject({ flying: true, u: 0 });
    expect(burstAt(1, 3, 730, 1).flying).toBe(false);
    expect(burstAt(1, 3, 730 + 90, 1).flying).toBe(true);
    expect(burstAt(2, 3, 730 + 180 + 95, 1).u).toBeGreaterThan(0.5);
    expect(burstAt(2, 3, 1100, 1).flying).toBe(false);
    expect(burstAt(0, 3, 730 + 95, 1).u).toBeGreaterThan(burstAt(0, 3, 730 + 30, 1).u);
  });
});

describe("the night", () => {
  it("fades in over the first beat and out over the last return, and stays between two attacks", () => {
    expect(scrimAt(0, 1, 1)).toBe(0);
    expect(scrimAt(250, 1, 1)).toBe(1);
    expect(scrimAt(1099, 1, 1)).toBe(1);
    expect(scrimAt(1300, 1, 1)).toBeCloseTo(0.5, 6);
    expect(scrimAt(1500, 1, 1)).toBe(0);
    // Two attacks: still fully dark as the first ends and the second begins.
    expect(scrimAt(1500, 1, 2)).toBe(1);
    expect(scrimAt(1501, 1, 2)).toBe(1);
    expect(scrimAt(1500 + 1100 + 200, 1, 2)).toBeCloseTo(0.5, 6);
    expect(scrimAt(3000, 1, 2)).toBe(0);
    expect(SHAPE.spotlightNight).toBe(0.65);
  });
});
