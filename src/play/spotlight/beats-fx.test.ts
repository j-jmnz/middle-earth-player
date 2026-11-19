// The combat spotlight's effects (docs/design-system-table.md, Spotlight): the trauma shake, the hit, a destroyed target, the shadow card, the damage tokens,
// the dark and several attacks in one state. The beats and the frame are in beats.test.ts.
import { describe, expect, it } from "vitest";

import { MOTION } from "../../ui/motion-tokens.ts";
import { beatsAt, burstAt, burstGap, darkAt, frameAt, heldAt, landTimes, runStart, spotlightSpan, stepAt, stepGap, tokenLandAt, type ClashShape } from "./beats.ts";
import { FX, resultPop, shakeAt, traumaAt, traumaStart, WOBBLE_HZ } from "./fx.ts";
import { SPOT } from "./shape.ts";

const ALONE = { first: true, last: true };
const HIT: ClashShape = { damage: 3, destroyed: false, shadow: false, ...ALONE };
const BLOCKED: ClashShape = { damage: 0, destroyed: false, shadow: false, ...ALONE };
const KILL: ClashShape = { damage: 2, destroyed: true, shadow: false, ...ALONE };
const SHADOW: ClashShape = { damage: 1, destroyed: false, shadow: true, ...ALONE };
const RAD = Math.PI / 180;
const range = (to: number, step = 1) => Array.from({ length: Math.floor(to / step) + 1 }, (_, index) => index * step);

describe("the trauma shake", () => {
  it("starts at 0.55 plus 0.12 a damage, 1 on a kill and 0.35 blocked, and falls by 1 over 420 ms", () => {
    expect(traumaStart(1, false)).toBeCloseTo(0.67, 9);
    expect(traumaStart(3, false)).toBeCloseTo(0.91, 9);
    expect(traumaStart(9, false)).toBe(1);
    expect(traumaStart(1, true)).toBe(1);
    expect(traumaStart(0, false)).toBe(0.35);
    expect(traumaAt(0.91, 0.5)).toBeCloseTo(0.41, 9);
  });

  it("stays within max · T² (9 pt and 1.2 degrees), never grows, and reaches 0", () => {
    for (const shape of [HIT, BLOCKED, KILL]) {
      const start = traumaStart(shape.damage, shape.destroyed);
      let was = Infinity;
      let longest = 0;
      for (const hit of range(500)) {
        const frame = frameAt(shape, beatsAt(1, shape).impactAt + hit, 1, 5);
        const trauma = traumaAt(start, hit / MOTION.spotlightShake.ms);
        expect(trauma).toBeLessThanOrEqual(was);
        was = trauma;
        const power = trauma * trauma;
        expect(Math.abs(frame.shakeX)).toBeLessThanOrEqual(FX.shakeMax * power + 1e-9);
        expect(Math.abs(frame.shakeY)).toBeLessThanOrEqual(FX.shakeMax * power + 1e-9);
        expect(Math.abs(frame.shakeTurn)).toBeLessThanOrEqual(FX.shakeTurn * power + 1e-9);
        if (frame.shakeX !== 0) longest = hit;
      }
      expect(was).toBe(0);
      // It is spent once the trauma is: start × 420 ms.
      expect(longest).toBeLessThanOrEqual(Math.ceil(start * MOTION.spotlightShake.ms));
      expect(Math.abs(frameAt(shape, beatsAt(1, shape).impactAt + 420, 1, 5).shakeX)).toBe(0);
    }
    expect(FX.shakeMax).toBe(9);
    expect(FX.shakeTurn).toBeCloseTo(1.2 * RAD, 9);
  });

  it("wobbles slowly enough that no sine aliases at 60 fps: the fastest at Quick is under 25 Hz", () => {
    const quick = 1 / 0.6;
    for (const { base, spread } of Object.values(WOBBLE_HZ)) expect((base + spread) * quick).toBeLessThan(25);
    expect(Math.max(...Object.values(WOBBLE_HZ).map(({ base, spread }) => base + spread)) * quick).toBeLessThan(25);
  });

  it("shakes harder for a kill than for a block, wobbles about zero, and differs by seed", () => {
    const reach = (shape: ClashShape) => Math.max(...range(420).map((hit) => Math.abs(frameAt(shape, beatsAt(1, shape).impactAt + hit, 1, 5).shakeX)));
    expect(reach(KILL)).toBeGreaterThan(reach(BLOCKED));
    expect(reach(KILL)).toBeGreaterThan(2);
    const wave = range(420, 3).map((hit) => frameAt(KILL, beatsAt(1, KILL).impactAt + hit, 1, 5).shakeX);
    expect(wave.some((value) => value > 0) && wave.some((value) => value < 0)).toBe(true);
    expect(wave).not.toEqual(range(420, 3).map((hit) => frameAt(KILL, beatsAt(1, KILL).impactAt + hit, 1, 6).shakeX));
    expect(shakeAt(1, 0, 1, 5)).toEqual({ x: 0, y: 0, turn: 0 });
  });
});

describe("the hit", () => {
  it("knocks the target back on a spring that settles, less when it blocked; the blocked attacker recoils instead", () => {
    const knock = (shape: ClashShape) => range(320, 4).map((hit) => frameAt(shape, 1070 + hit, 1).knock);
    expect(Math.max(...knock(HIT))).toBeGreaterThan(0.8);
    expect(Math.max(...knock(BLOCKED))).toBeCloseTo(Math.max(...knock(HIT)) * SPOT.knockBlocked, 6);
    expect(frameAt(HIT, 1070 + 320, 1).knock).toBe(0);
    expect(range(320, 4).some((hit) => frameAt(BLOCKED, 1070 + hit, 1).recoil > 0.8)).toBe(true);
    expect(range(320, 4).every((hit) => frameAt(HIT, 1070 + hit, 1).recoil === 0)).toBe(true);
  });

  it("tints the target red as it takes damage, and not a blocked one", () => {
    expect(frameAt(HIT, 1070, 1).tint).toBe(0);
    expect(frameAt(HIT, 1100, 1).tint).toBeGreaterThan(0.5);
    expect(frameAt(HIT, 1350, 1).tint).toBe(0);
    expect(range(280, 10).every((hit) => frameAt(BLOCKED, 1070 + hit, 1).tint === 0)).toBe(true);
  });

  it("pops the result to about 1.3 and settles it at 1 as it comes in", () => {
    const scales = range(450, 5).map((at) => resultPop(at, 1).scale);
    expect(Math.max(...scales)).toBeGreaterThan(1.2);
    expect(Math.max(...scales)).toBeLessThan(1.4);
    expect(scales[scales.length - 1]).toBeCloseTo(1, 1);
    expect(resultPop(0, 1).alpha).toBe(0);
    expect(resultPop(200, 1).alpha).toBe(1);
  });

  it("brings the gauge forward and dims the cards over the count, and lets them go into the hold", () => {
    expect(frameAt(HIT, 1350, 1).focus).toBe(0);
    expect(frameAt(HIT, 1350 + 150, 1).focus).toBe(1);
    expect(frameAt(HIT, 2149, 1).focus).toBe(1);
    expect(frameAt(HIT, 2150 + 150, 1).focus).toBe(0);
    expect(range(1340, 10).every((t) => frameAt(HIT, t, 1).focus === 0)).toBe(true);
  });

  it("bounces the shields that held a blocked attack once, to 1.25, after the last shield breaks, and brings in Blocked then", () => {
    const blocked: ClashShape = { ...BLOCKED, steps: 2 };
    const flare = heldAt(1, blocked);
    expect(flare).toBe(1350 + 130 + 130);
    const bounces = range(700, 5).map((at) => frameAt(blocked, flare + at, 1).badgeD / Math.max(frameAt(blocked, flare + at, 1).badgeA, 1e-9));
    expect(Math.max(...bounces)).toBeGreaterThan(1.2);
    expect(Math.max(...bounces)).toBeLessThanOrEqual(SPOT.bounce + 0.05);
    expect(frameAt(blocked, flare - 1, 1).badgeD).toBe(frameAt(blocked, flare - 1, 1).badgeA);
    expect(frameAt(blocked, flare, 1).result.alpha).toBe(0);
    expect(frameAt(blocked, flare + 200, 1).result.alpha).toBe(1);
    // An attack that dealt damage bounces nothing.
    expect(frameAt(HIT, 1500, 1).badgeD).toBe(frameAt(HIT, 1500, 1).badgeA);
  });

  it("breaks the marks one by one from the count's start, 130 ms apart, closer when many", () => {
    expect([0, 1, 2].map((index) => stepAt(index, 3, 1))).toEqual([1350, 1480, 1610]);
    expect(stepGap(1, 1)).toBe(0);
    expect(stepGap(9, 1)).toBeLessThan(130);
    expect(8 * stepGap(9, 1)).toBeLessThanOrEqual(0.4 * 800 + 1e-9);
    expect(stepAt(1, 3, 0.6)).toBeCloseTo(1480 * 0.6, 6);
  });

  it("pops the count when the last token has landed, with phase 23's pop, and not before", () => {
    const lands = tokenLandAt(2, 3, 1);
    expect(lands).toBe(1350 + 2 * 150 + 220);
    expect(frameAt(HIT, lands - 1, 1)).toMatchObject({ landed: false, pop: 1 });
    expect(frameAt(HIT, lands + 1, 1).landed).toBe(true);
    const pops = range(300).map((index) => frameAt(HIT, lands + index, 1).pop);
    expect(Math.max(...pops)).toBeGreaterThan(1.3);
    expect(pops[pops.length - 1]).toBeCloseTo(1, 1);
    expect(frameAt(BLOCKED, 2100, 1).landed).toBe(false);
  });

  it("lands each token at its own time after the marks break, the gauge's hearts light then, and the result follows the last", () => {
    const lands = [0, 1, 2].map((index) => tokenLandAt(index, 3, 1));
    expect(lands).toEqual([1350 + 220, 1350 + 150 + 220, 1350 + 300 + 220]);
    // Two shields break first: the tokens wait for them.
    const shielded: ClashShape = { ...HIT, steps: 2 };
    expect(tokenLandAt(0, 3, 1, shielded)).toBe(1350 + 130 + 130 + 220);
    // The heart sparks' clock starts as the first token lands.
    expect(frameAt(HIT, lands[0]! - 1, 1).emberT).toBe(-1);
    expect(frameAt(HIT, lands[0]! + 10, 1).emberT).toBe(10);
    expect(range(3200, 20).every((t) => frameAt(BLOCKED, t, 1).emberT === -1)).toBe(true);
    expect(frameAt(HIT, lands[2]!, 1).result.alpha).toBe(0);
    expect(frameAt(HIT, lands[2]! + 200, 1).result.alpha).toBe(1);
    // A kill's count starts as any other's, so its tokens land at the same times.
    expect(tokenLandAt(0, 2, 1, { first: true, last: true, destroyed: true })).toBe(1350 + 220);
    // At Quick the same picture plays 0.6 as long.
    expect(tokenLandAt(1, 3, 0.6)).toBeCloseTo(lands[1]! * 0.6, 6);
  });

  it("lists every token's landing in the run for the haptic ticks, at most 9 an attack", () => {
    const first: ClashShape = { damage: 2, destroyed: false, shadow: false, first: true, last: false, steps: 1 };
    const second: ClashShape = { damage: 12, destroyed: false, shadow: false, first: false, last: true };
    const times = landTimes([first, second], 1);
    expect(times).toHaveLength(2 + 9);
    expect(times[0]).toBe(tokenLandAt(0, 2, 1, first));
    expect(times[2]).toBe(runStart(1, 2, 1) + tokenLandAt(0, 12, 1, second));
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(landTimes([BLOCKED], 1)).toEqual([]);
  });
});

describe("a destroyed target", () => {
  it("burns only when it is destroyed: the dissolve runs over the burn token from the return and no other attack has one", () => {
    for (const shape of [HIT, BLOCKED, SHADOW]) expect(range(3200, 10).every((t) => frameAt(shape, t, 1).dissolve === 0)).toBe(true);
    expect(frameAt(KILL, 2699, 1)).toMatchObject({ dissolve: 0, flyTarget: 1 });
    const burn = range(450, 10).map((at) => frameAt(KILL, 2700 + at, 1).dissolve);
    expect(burn).toEqual([...burn].sort((a, b) => a - b));
    expect(burn[0]).toBe(0);
    expect(burn[burn.length - 1]).toBeCloseTo(1, 9);
    // In quad: a quarter of the way through is a sixteenth of the burn.
    expect(frameAt(KILL, 2700 + 112.5, 1).dissolve).toBeCloseTo(1 / 16, 6);
    // The target stays while the attackers go back.
    expect(frameAt(KILL, 2950, 1).flyTarget).toBe(1);
    expect(frameAt(KILL, 2950, 1).flyAttackers).toBeLessThan(1);
    expect(frameAt(HIT, 2950, 1).flyTarget).toBeLessThan(1);
  });

  it("brings in Destroyed as the last token lands, and lets it go over the first half of the return", () => {
    const lands = tokenLandAt(1, 2, 1, { ...KILL });
    expect(frameAt(KILL, lands, 1).result.alpha).toBe(0);
    expect(frameAt(KILL, lands + 200, 1).result.alpha).toBe(1);
    expect(frameAt(KILL, 2700 + 250, 1).result.alpha).toBe(0);
  });

  it("burns as fast as the next attack swaps in when it is not the last", () => {
    const middle: ClashShape = { damage: 2, destroyed: true, shadow: false, first: true, last: false };
    expect(frameAt(middle, 2700 + 100, 1).dissolve).toBeCloseTo(0.25, 6);
    expect(frameAt(middle, 2700 + 200, 1).dissolve).toBe(1);
  });
});

describe("the shadow card", () => {
  it("turns over from the read on about its vertical axis, with a glint sweeping across as it shows its face, and never one that was not turned", () => {
    expect(frameAt(SHADOW, 300, 1).flipAngle).toBe(0);
    expect(frameAt(SHADOW, 300 + MOTION.spotlightFlip.ms, 1).flipAngle).toBeCloseTo(Math.PI, 9);
    expect(frameAt(SHADOW, 300 + 20, 1).flipAngle).toBeGreaterThan(0);
    expect(frameAt(SHADOW, 300 + 20, 1).flipAngle).toBeLessThan(Math.PI / 2);
    expect(frameAt(SHADOW, 300 + 150, 1).glint).toBe(0);
    const glint = range(MOTION.spotlightGlint.ms, 10).map((at) => frameAt(SHADOW, 300 + 150 + at, 1).glint);
    expect(glint.some((value) => value > 0 && value < 1)).toBe(true);
    const swept = glint.filter((value) => value > 0);
    expect(swept).toEqual([...swept].sort((a, b) => a - b));
    expect(range(3200, 10).every((t) => frameAt(HIT, t, 1).flipAngle === 0 && frameAt(HIT, t, 1).glint === 0)).toBe(true);
  });
});

describe("the damage tokens", () => {
  it("leave the point of contact 150 ms apart in the count, one for each damage, and all land inside the count", () => {
    expect(burstGap(1, 1)).toBe(0);
    expect(burstGap(3, 1)).toBe(MOTION.spotlightBurstStep.ms);
    for (const steps of [0, 2, 6]) {
      for (let damage = 1; damage <= 12; damage += 1) {
        const gap = burstGap(damage, 1, steps);
        expect(gap).toBeLessThanOrEqual(MOTION.spotlightBurstStep.ms);
        expect(tokenLandAt(damage - 1, damage, 1, { first: true, last: true, steps }), `damage ${damage}, ${steps} steps`).toBeLessThanOrEqual(2150);
      }
    }
    // Many squeeze together rather than run past the count.
    expect(burstGap(6, 1)).toBeLessThan(MOTION.spotlightBurstStep.ms);
  });

  it("fly one after another from 0 to 1, in the air only while they fly", () => {
    expect(burstAt(0, 3, 1349, 1).flying).toBe(false);
    expect(burstAt(0, 3, 1350, 1)).toMatchObject({ flying: true, u: 0 });
    expect(burstAt(1, 3, 1350, 1).flying).toBe(false);
    expect(burstAt(1, 3, 1350 + 150, 1).flying).toBe(true);
    expect(burstAt(2, 3, 1350 + 300 + 110, 1).u).toBeGreaterThan(0.5);
    expect(burstAt(2, 3, 2150, 1).flying).toBe(false);
    expect(burstAt(0, 3, 1350 + 110, 1).u).toBeGreaterThan(burstAt(0, 3, 1350 + 30, 1).u);
  });
});

describe("the dark", () => {
  it("comes in over the first enter and lifts over the last return, and stays between two attacks", () => {
    expect(darkAt(0, 1, 1)).toBe(0);
    expect(darkAt(300, 1, 1)).toBe(1);
    expect(darkAt(1699, 1, 1)).toBe(1);
    expect(darkAt(2950, 1, 1)).toBeCloseTo(0.5, 6);
    expect(darkAt(3200, 1, 1)).toBe(0);
    expect(darkAt(2700, 1, 2)).toBe(1);
    expect(darkAt(2700 + 2350, 1, 2)).toBe(1);
    expect(darkAt(2700 + 2350 + 250, 1, 2)).toBeCloseTo(0.5, 6);
    expect(darkAt(spotlightSpan(2), 1, 2)).toBe(0);
  });
});

describe("several attacks in one state", () => {
  const first: ClashShape = { damage: 2, destroyed: false, shadow: false, first: true, last: false };
  const middle: ClashShape = { damage: 1, destroyed: false, shadow: false, first: false, last: false };
  const last: ClashShape = { damage: 1, destroyed: true, shadow: false, first: false, last: true };

  it("fly out and enter only for the first, and go back only for the last", () => {
    expect(frameAt(first, 0, 1).flyAttackers).toBe(0);
    expect(frameAt(first, 2700, 1)).toMatchObject({ flyAttackers: 1, flyTarget: 1 });
    expect(darkAt(2700, 1, 2)).toBe(1);
    // Past its end the first one is still in the middle, fading out into the next.
    expect(frameAt(first, 2700 + 200, 1).fade).toBe(0);
    expect(frameAt(first, 2700 + 100, 1).fade).toBeCloseTo(0.5, 6);
    // A later one is in the middle from its first moment, fading in over the swap.
    expect(frameAt(middle, 0, 1)).toMatchObject({ flyAttackers: 1, flyTarget: 1, fade: 0 });
    expect(frameAt(middle, 200, 1).fade).toBe(1);
    expect(frameAt(middle, 2350, 1).flyAttackers).toBe(1);
    expect(frameAt(last, 2350 + 250, 1).flyAttackers).toBeLessThan(1);
    expect(frameAt(last, 2850, 1).flyAttackers).toBe(0);
  });

  it("read in 100 ms, charge in 200 and still touch the target and hold for the hit stop", () => {
    const b = beatsAt(1, { first: false, last: false });
    expect([b.readAt, b.chargeAt, b.lungeAt, b.stopAt, b.impactAt, b.countAt, b.retAt]).toEqual([200, 300, 500, 620, 720, 1000, 2350]);
    expect(frameAt(middle, b.lungeAt, 1)).toMatchObject({ back: 1, strike: 0 });
    expect(frameAt(middle, b.stopAt, 1).strike).toBe(1);
    expect(frameAt(middle, b.impactAt + 30, 1).shakeX).not.toBe(0);
  });

  it("scale with Quick like the first does", () => {
    const quick = beatsAt(0.6, { first: false, last: true });
    expect(quick.end).toBeCloseTo(2850 * 0.6, 6);
    expect(burstAt(0, 1, 1000 * 0.6, 0.6, { first: false, last: false }).flying).toBe(true);
  });
});
