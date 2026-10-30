// The combat spotlight's beats (docs/plans/combat-spotlight-redesign.md, §3 and §4): the seven beats add up to the run, the run is
// 3200 ms at Normal and 0.6 of it at Quick, and a frame at any moment is the pose the table of beats describes.
import { describe, expect, it } from "vitest";

import { MOTION, SPOTLIGHT_AGAIN, SPOTLIGHT_BEATS } from "./motion-tokens.ts";
import { beatsAt, burstAt, burstGap, darkAt, frameAt, hitTime, leaveTime, punchAt, runStart, spotlightRun, spotlightSpan, trailAt, windowOf, type ClashShape } from "./spotlight-beats.ts";
import { cameraPush, FX, flashAt, numberAt, ringAt, shakeAt, stampLook, traumaAt, traumaStart, WOBBLE_HZ } from "./spotlight-fx.ts";
import { SPOT } from "./spotlight-shape.ts";
import { strikeOffset, stageOf } from "./spotlight-stage.ts";

const ALONE = { first: true, last: true };
const HIT: ClashShape = { damage: 3, destroyed: false, shadow: false, ...ALONE };
const BLOCKED: ClashShape = { damage: 0, destroyed: false, shadow: false, ...ALONE };
const KILL: ClashShape = { damage: 2, destroyed: true, shadow: false, ...ALONE };
const SHADOW: ClashShape = { damage: 1, destroyed: false, shadow: true, ...ALONE };
const RAD = Math.PI / 180;
const range = (to: number, step = 1) => Array.from({ length: Math.floor(to / step) + 1 }, (_, index) => index * step);

// Every number of a frame by its path, so two frames can be compared field by field.
function flat(value: unknown, path = ""): [string, number | boolean][] {
  if (typeof value === "number" || typeof value === "boolean") return [[path, value]];
  return Object.entries(value as object).flatMap(([key, inner]) => flat(inner, path ? `${path}.${key}` : key));
}

describe("the beats of one attack", () => {
  it("run enter, read, charge, lunge, stop, impact, hold and return in order, 3200 ms in all at Normal", () => {
    const b = beatsAt(1);
    expect([b.readAt, b.chargeAt, b.lungeAt, b.stopAt, b.impactAt, b.retAt, b.end]).toEqual([350, 650, 1000, 1120, 1220, 2700, 3200]);
    expect(SPOTLIGHT_BEATS.reduce((sum, name) => sum + MOTION[name].ms, 0)).toBe(MOTION.spotlight.ms);
    expect(b.end).toBe(MOTION.spotlight.ms);
  });

  it("run at 0.6 under Quick, 1920 ms, and every beat scales with it", () => {
    const quick = beatsAt(0.6);
    expect(quick.end).toBeCloseTo(1920, 6);
    const normal = beatsAt(1);
    for (const key of ["intro", "read", "charge", "lunge", "stop", "impact", "hold", "ret"] as const) expect(quick[key], key).toBeCloseTo(normal[key] * 0.6, 6);
  });

  it("add up for several attacks one after another: the first 2700, a later one 2200, the last going back 500 more", () => {
    expect(spotlightSpan(1)).toBe(3200);
    expect(spotlightRun(1, 0.6)).toBe(1920);
    expect(beatsAt(1, { first: true, last: false }).end).toBe(2700);
    expect(beatsAt(1, { first: false, last: false }).end).toBe(SPOTLIGHT_AGAIN);
    expect(beatsAt(1, { first: false, last: true }).end).toBe(SPOTLIGHT_AGAIN + 500);
    expect(spotlightSpan(2)).toBe(2700 + 2700);
    expect(spotlightSpan(3)).toBe(2700 + 2200 + 2700);
    expect(spotlightSpan(3)).toBe(7600);
    expect(spotlightRun(3, 0.6)).toBe(4560);
    expect(runStart(2, 3, 1)).toBe(2700 + 2200);
  });

  it("name when each strike lands and when the last attack begins to go back", () => {
    expect(hitTime(0, 1, 1)).toBe(1120);
    expect(hitTime(0, 3, 1)).toBe(1120);
    // A later attack swaps in over 200 ms, reads over 100 and charges over 200, so its hit stop is 620 ms after it begins.
    expect(hitTime(1, 3, 1)).toBe(2700 + 620);
    expect(hitTime(2, 3, 1)).toBe(2700 + 2200 + 620);
    expect(hitTime(1, 3, 0.6)).toBeCloseTo((2700 + 620) * 0.6, 6);
    expect(leaveTime(1, 1)).toBe(2700);
    expect(leaveTime(2, 1)).toBe(2700 + 2200);
    expect(windowOf(0, 3, 1)).toEqual({ start: 0, length: 2700 + 200 });
    expect(windowOf(2, 3, 1)).toEqual({ start: 4900, length: 2700 });
  });

  it("is one frame at any speed: Quick at 0.6 of a moment is Normal at that moment, field by field", () => {
    const shapes: ClashShape[] = [HIT, BLOCKED, KILL, SHADOW, { damage: 2, destroyed: true, shadow: false, first: false, last: false }, { damage: 0, destroyed: false, shadow: true, first: false, last: true }];
    for (const shape of shapes) {
      for (const t of range(MOTION.spotlight.ms - 1, 77)) {
        const normal = flat(frameAt(shape, t, 1, 91));
        const quick = flat(frameAt(shape, t * 0.6, 0.6, 91));
        expect(quick.map(([path]) => path)).toEqual(normal.map(([path]) => path));
        for (const [index, [path, value]] of normal.entries()) {
          const other = quick[index]?.[1];
          if (typeof value === "number") expect(other as number, `${path} at ${t}`).toBeCloseTo(value, 3);
          else expect(other, `${path} at ${t}`).toBe(value);
        }
      }
    }
  });
});

describe("a frame", () => {
  it("starts with nothing flown out and ends with everything back in its slot and the dark lifted", () => {
    const start = frameAt(HIT, 0, 1);
    expect([start.flyAttackers, start.flyTarget, darkAt(0, 1, 1), start.badgeA, start.back, start.strike, Math.abs(start.tilt), punchAt(0, 1, 1)]).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    const end = frameAt(HIT, 3200, 1);
    expect([end.flyAttackers, end.flyTarget, darkAt(3200, 1, 1), end.badgeA, end.back, end.strike, punchAt(3200, 1, 1)]).toEqual([0, 0, 0, 0, 0, 0, 1]);
    const there = frameAt(HIT, 350, 1);
    expect([there.flyAttackers, there.flyTarget, darkAt(350, 1, 1)]).toEqual([1, 1, 1]);
  });

  it("overshoots the center a little as the cards arrive, and settles on it", () => {
    const fly = range(350, 5).map((t) => frameAt(HIT, t, 1).flyAttackers);
    expect(Math.max(...fly)).toBeGreaterThan(1);
    expect(Math.max(...fly)).toBeLessThan(1.15);
    expect(fly[fly.length - 1]).toBe(1);
  });

  it("pops the medallions in over the read", () => {
    expect(frameAt(HIT, 349, 1).badgeA).toBe(0);
    const pops = range(300, 5).map((t) => frameAt(HIT, 350 + t, 1).badgeA);
    expect(Math.max(...pops)).toBeGreaterThan(1);
    expect(pops[pops.length - 1]).toBe(1);
  });

  it("draws the attacker back and tilts it 5 degrees away over the charge, then lunges to touch the target", () => {
    const drawn = frameAt(HIT, 1000, 1);
    expect(drawn.back).toBe(1);
    expect(drawn.strike).toBe(0);
    expect(drawn.tilt).toBeCloseTo(-SPOT.tilt * RAD, 6);
    expect(frameAt(HIT, 825, 1).back).toBeGreaterThan(0.5);
    const touching = frameAt(HIT, 1120, 1);
    expect(touching.strike).toBe(1);
    expect(touching.tilt).toBeCloseTo(0, 9);
    expect(frameAt(HIT, 1060, 1).strike).toBeGreaterThan(0);
    expect(frameAt(HIT, 1060, 1).strike).toBeLessThan(1);
    // In points: back by the draw back, forward by the gap to touch.
    const stage = stageOf({ width: 844, height: 390, origin: { x: 0, y: 0 }, safe: { top: 0, right: 0, bottom: 0, left: 0 } }, { w: 51, h: 71 }, 1, false);
    expect(strikeOffset(stage, drawn)).toBeCloseTo(-stage.drawBack, 6);
    expect(strikeOffset(stage, touching)).toBeCloseTo(stage.gap, 6);
  });

  it("builds the rim glow over the charge and lets it go at the hit", () => {
    expect(frameAt(HIT, 649, 1).charge).toBe(0);
    expect(frameAt(HIT, 1000, 1).charge).toBe(1);
    expect(frameAt(HIT, 1120, 1).charge).toBe(1);
    expect(frameAt(HIT, 1220 + 160, 1).charge).toBe(0);
  });

  it("pushes the camera in from 1 to 1.06 over the charge, holds it, and lets go over the return", () => {
    // The camera belongs to the run (punchAt): the one source the stage and the HUD read.
    expect(punchAt(650, 1, 1)).toBe(1);
    expect(punchAt(1000, 1, 1)).toBeCloseTo(FX.push, 9);
    expect(punchAt(1500, 1, 1)).toBeCloseTo(FX.push, 9);
    expect(punchAt(2950, 1, 1)).toBeCloseTo(1 + (FX.push - 1) / 2, 6);
    expect(punchAt(3200, 1, 1)).toBe(1);
    expect(punchAt(0, 1, 1)).toBe(1);
    expect(punchAt(1000, 1, 2)).toBeCloseTo(FX.push, 9);
    expect(punchAt(2700 + 2700, 1, 2)).toBe(1);
    expect(cameraPush(0)).toBe(1);
    expect(cameraPush(1)).toBeCloseTo(1.06, 9);
  });

  it("shows the afterimages only during the lunge, three of them, fainter the older", () => {
    for (const t of range(3200, 10)) {
      const lunging = t >= 1000 && t < 1120;
      expect(frameAt(HIT, t, 1).trail, `${t}`).toBe(lunging ? 1 : 0);
      for (const j of [1, 2, 3]) expect(trailAt(HIT, t, 1, j).alpha > 0, `${t} ${j}`).toBe(lunging);
    }
    const [one, two, three] = [1, 2, 3].map((j) => trailAt(HIT, 1100, 1, j));
    expect(one?.alpha).toBeGreaterThan(two?.alpha ?? 1);
    expect(two?.alpha).toBeGreaterThan(three?.alpha ?? 1);
    // Each afterimage is the same clock a step earlier, so it lags the card.
    expect(one?.strike).toBeLessThan(frameAt(HIT, 1100, 1).strike);
    expect(three?.strike).toBeLessThan(one?.strike ?? 0);
  });

  it("keeps the cards and the damage number up for a second after the impact, then goes back", () => {
    const shown = frameAt(HIT, 1700, 1);
    const held = frameAt(HIT, 2699, 1);
    expect(held).toMatchObject({ flyAttackers: 1, flyTarget: 1, strike: 1, badgeA: 1 });
    expect(held.number.alpha).toBe(shown.number.alpha);
    expect(held.number.alpha).toBe(1);
    expect(frameAt(HIT, 2700, 1).flyAttackers).toBe(1);
  });

  it("holds everything for the hit stop: nothing but the flash moves between 1120 and 1220 ms", () => {
    const base = frameAt(HIT, 1120, 1);
    for (const t of [1130, 1170, 1219]) {
      const held = frameAt(HIT, t, 1);
      for (const key of ["flyAttackers", "flyTarget", "back", "strike", "tilt", "recoil", "knock", "tint", "charge", "badgeA", "badgeD", "shakeX", "shakeY", "shakeTurn", "dissolve"] as const) expect(held[key], `${key} at ${t}`).toBe(base[key]);
      expect(held.sparkT).toBe(-1);
      expect(held.ring.alpha).toBe(0);
      expect(held.number.alpha).toBe(0);
      expect(held.flash).toBeGreaterThan(0);
      // The embers and the charge's embers stand still with the rest.
      expect(held.emberT).toBe(base.emberT);
      expect(held.convergeT).toBe(base.convergeT);
    }
    // They carry on from where they stood, without the stop.
    expect(frameAt(HIT, 1220, 1).emberT).toBe(1120);
    expect(frameAt(HIT, 1220, 1).convergeT).toBe(1120 - 650);
    expect(frameAt(HIT, 1320, 1).emberT).toBe(1220);
    expect(frameAt(HIT, 1320, 1).convergeT).toBe(1220 - 650);
    expect(frameAt(HIT, 1100, 1).emberT).toBe(1100);
    // At Quick the clocks are still in unscaled ms: 0.6 · 1120 ms of run, held for the 60 ms stop, is 1120 unscaled.
    expect(frameAt(HIT, 0.6 * 1220, 0.6).emberT).toBeCloseTo(1120, 6);
    expect(frameAt(HIT, 0.6 * 1130, 0.6).emberT).toBeCloseTo(1120, 6);
  });

  it("holds a kill for 160 ms at the hit, the extra 60 coming out of the impact, so a kill still ends with the run", () => {
    const hit = beatsAt(1, HIT);
    const kill = beatsAt(1, KILL);
    expect([hit.stop, hit.impact]).toEqual([100, 480]);
    expect([kill.stop, kill.impact]).toEqual([160, 420]);
    // The strike lands (and the haptic ticks) at the same moment, and the return and the end are where they were.
    expect([kill.stopAt, kill.impactAt, kill.retAt, kill.end]).toEqual([1120, 1280, 2700, 3200]);
    expect([hit.stopAt, hit.retAt, hit.end]).toEqual([kill.stopAt, kill.retAt, kill.end]);
    expect(hitTime(0, 1, 1)).toBe(kill.stopAt);
    // A lone kill is 3200 ms and a later one 2200 ms, like the rest.
    expect(kill.stop + kill.impact).toBe(hit.stop + hit.impact);
    expect(spotlightRun(1, 1)).toBe(3200);
    const again = beatsAt(1, { first: false, last: false, destroyed: true });
    expect(again.end).toBe(2200);
    expect([again.stop, again.impact]).toEqual([160, 420 - 0]);
    // Quick scales both the same.
    const quick = beatsAt(0.6, KILL);
    expect(quick.stop).toBeCloseTo(0.6 * 160, 9);
    expect(quick.end).toBeCloseTo(0.6 * 3200, 6);
    // The stop holds the picture for the whole 160 ms, and the impact begins after it; the tokens still land inside the shorter impact.
    const base = frameAt(KILL, 1120, 1);
    for (const t of [1150, 1200, 1279]) {
      const held = frameAt(KILL, t, 1);
      expect(held.sparkT).toBe(-1);
      expect(held.strike).toBe(base.strike);
      expect(held.emberT).toBe(base.emberT);
    }
    expect(frameAt(KILL, 1280, 1).sparkT).toBe(0);
    expect(burstAt(2, 3, 1280 + 2 * 90 + 220, 1, { first: true, last: true, destroyed: true }).u).toBe(1);
    expect(burstGap(3, 1, true) * 2 + 220).toBeLessThanOrEqual(420);
  });

  it("flashes once per attack, warm white at a peak of 0.7, from the first frame of the stop", () => {
    for (const shape of [HIT, BLOCKED, KILL, { ...HIT, first: false, last: false }, { ...HIT, first: false, last: true }]) {
      const flash = range(3200).map((t) => frameAt(shape, t, 1).flash);
      const peaks = flash.filter((value, index) => value > 0 && value >= (flash[index - 1] ?? 0) && value > (flash[index + 1] ?? 0));
      expect(peaks, `${JSON.stringify(shape)}`).toHaveLength(1);
      expect(Math.max(...flash)).toBeLessThanOrEqual(0.7);
      const start = beatsAt(1, shape).stopAt;
      expect(flash.findIndex((value) => value > 0)).toBe(start + 1);
      expect(flash[beatsAt(1, shape).stopAt + 160] ?? 0).toBe(0);
    }
    expect(Math.max(...range(3200).map((t) => frameAt(HIT, t, 1).flash))).toBeGreaterThan(0.65);
    expect(flashAt(FX.flashRise, false)).toBeCloseTo(FX.flashPeak, 9);
    expect(flashAt(FX.flashRise, true)).toBeLessThan(FX.flashPeak);
    expect(FX.flashRadius).toBe(0.55);
  });

  it("sends a shockwave ring out from the impact", () => {
    expect(frameAt(HIT, 1220, 1).ring).toEqual({ r: 0, alpha: 0 });
    const mid = frameAt(HIT, 1220 + 100, 1).ring;
    expect(mid.alpha).toBeGreaterThan(0.3);
    expect(frameAt(HIT, 1220 + 300, 1).ring.r).toBeGreaterThan(mid.r);
    expect(frameAt(HIT, 1220 + 360, 1).ring.alpha).toBe(0);
    expect(ringAt(0.5).r).toBeLessThan(FX.ringStart + FX.ringGrow);
  });

  it("starts the effect clocks at their beats, in unscaled ms, and -1 before", () => {
    const f = (t: number) => frameAt(KILL, t, 1);
    expect([f(0).emberT, f(500).emberT]).toEqual([0, 500]);
    expect([f(649).convergeT, f(650).convergeT, f(750).convergeT]).toEqual([-1, 0, 100]);
    // The sparks start at the impact: 1220 ms, or 1280 on a kill (its stop is 60 ms longer).
    expect([f(1279).sparkT, f(1280).sparkT, f(1380).sparkT]).toEqual([-1, 0, 100]);
    expect([frameAt(HIT, 1219, 1).sparkT, frameAt(HIT, 1220, 1).sparkT, frameAt(HIT, 1320, 1).sparkT]).toEqual([-1, 0, 100]);
    expect([f(2699).ashT, f(2700).ashT, f(2800).ashT]).toEqual([-1, 0, 100]);
    expect(frameAt(HIT, 1800, 1).ashT).toBe(-1);
  });
});

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
    const knock = (shape: ClashShape) => range(320, 4).map((hit) => frameAt(shape, 1220 + hit, 1).knock);
    expect(Math.max(...knock(HIT))).toBeGreaterThan(0.8);
    expect(Math.max(...knock(BLOCKED))).toBeCloseTo(Math.max(...knock(HIT)) * SPOT.knockBlocked, 6);
    expect(frameAt(HIT, 1220 + 320, 1).knock).toBe(0);
    expect(range(320, 4).some((hit) => frameAt(BLOCKED, 1220 + hit, 1).recoil > 0.8)).toBe(true);
    expect(range(320, 4).every((hit) => frameAt(HIT, 1220 + hit, 1).recoil === 0)).toBe(true);
  });

  it("tints the target red as it takes damage, and not a blocked one", () => {
    expect(frameAt(HIT, 1220, 1).tint).toBe(0);
    expect(frameAt(HIT, 1260, 1).tint).toBeGreaterThan(0.5);
    expect(frameAt(HIT, 1700, 1).tint).toBe(0);
    expect(range(480, 10).every((hit) => frameAt(BLOCKED, 1220 + hit, 1).tint === 0)).toBe(true);
  });

  it("pops the damage number to about 1.4 and settles it at 1, and shows none for a block", () => {
    const scales = range(450, 5).map((hit) => numberAt(hit, 1).scale);
    expect(Math.max(...scales)).toBeGreaterThan(1.3);
    expect(Math.max(...scales)).toBeLessThan(1.5);
    expect(scales[scales.length - 1]).toBeCloseTo(1, 1);
    expect(numberAt(0, 1).alpha).toBe(0);
    expect(frameAt(HIT, 1220 + 200, 1).number.alpha).toBe(1);
    expect(frameAt(HIT, 1220 + 200, 1).number.rise).toBeGreaterThan(0);
    expect(range(3200, 20).every((t) => frameAt(BLOCKED, t, 1).number.alpha === 0)).toBe(true);
    // It fades out as the cards go back.
    expect(frameAt(HIT, 2700 + 250, 1).number.alpha).toBe(0);
  });

  it("bounces the defense medallion of a blocked attack once, to 1.25, and stamps Blocked", () => {
    const bounces = range(700, 5).map((hit) => frameAt(BLOCKED, 1220 + hit, 1).badgeD / Math.max(frameAt(BLOCKED, 1220 + hit, 1).badgeA, 1e-9));
    expect(Math.max(...bounces)).toBeGreaterThan(1.2);
    expect(Math.max(...bounces)).toBeLessThanOrEqual(SPOT.bounce + 0.05);
    expect(frameAt(BLOCKED, 1219, 1).badgeD).toBe(frameAt(BLOCKED, 1219, 1).badgeA);
    expect(frameAt(BLOCKED, 1220, 1).stamp).toBe(0);
    expect(frameAt(BLOCKED, 1220 + 160, 1).stamp).toBe(1);
    expect(frameAt(BLOCKED, 1220 + 100, 1).stamp).toBeGreaterThan(0);
    // An attack that dealt damage bounces nothing and stamps nothing.
    expect(frameAt(HIT, 1500, 1).badgeD).toBe(frameAt(HIT, 1500, 1).badgeA);
    expect(range(3200, 20).every((t) => frameAt(HIT, t, 1).stamp === 0)).toBe(true);
    expect(stampLook(1)).toEqual({ scale: 1, alpha: 1 });
    expect(stampLook(0.2).scale).toBeGreaterThan(1.15);
  });

  it("pops the count when the last token has landed, with phase 23's pop, and not before", () => {
    const lands = beatsAt(1).impactAt + 2 * burstGap(3, 1) + MOTION.spotlightBurstFly.ms;
    expect(lands).toBe(1620);
    expect(frameAt(HIT, lands - 1, 1)).toMatchObject({ landed: false, pop: 1 });
    expect(frameAt(HIT, lands + 1, 1).landed).toBe(true);
    const pops = range(300).map((index) => frameAt(HIT, lands + index, 1).pop);
    expect(Math.max(...pops)).toBeGreaterThan(1.3);
    expect(pops[pops.length - 1]).toBeCloseTo(1, 1);
    expect(frameAt(BLOCKED, 1900, 1).landed).toBe(false);
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

  it("stamps Destroyed as the burn begins, and lets it go at the end of the return", () => {
    expect(frameAt(KILL, 1699, 1).stamp).toBe(0);
    expect(frameAt(KILL, 2700 + 160, 1).stamp).toBe(1);
    expect(frameAt(KILL, 3200, 1).stamp).toBeCloseTo(0, 6);
  });

  it("burns as fast as the next attack swaps in when it is not the last", () => {
    const middle: ClashShape = { damage: 2, destroyed: true, shadow: false, first: true, last: false };
    expect(frameAt(middle, 2700 + 100, 1).dissolve).toBeCloseTo(0.25, 6);
    expect(frameAt(middle, 2700 + 200, 1).dissolve).toBe(1);
  });
});

describe("the shadow card", () => {
  it("turns over from the read on about its vertical axis, with a glint sweeping across as it shows its face, and never one that was not turned", () => {
    expect(frameAt(SHADOW, 350, 1).flipAngle).toBe(0);
    expect(frameAt(SHADOW, 350 + MOTION.spotlightFlip.ms, 1).flipAngle).toBeCloseTo(Math.PI, 9);
    expect(frameAt(SHADOW, 350 + 20, 1).flipAngle).toBeGreaterThan(0);
    expect(frameAt(SHADOW, 350 + 20, 1).flipAngle).toBeLessThan(Math.PI / 2);
    expect(frameAt(SHADOW, 350 + 150, 1).glint).toBe(0);
    const glint = range(MOTION.spotlightGlint.ms, 10).map((at) => frameAt(SHADOW, 350 + 150 + at, 1).glint);
    expect(glint.some((value) => value > 0 && value < 1)).toBe(true);
    const swept = glint.filter((value) => value > 0);
    expect(swept).toEqual([...swept].sort((a, b) => a - b));
    expect(range(3200, 10).every((t) => frameAt(HIT, t, 1).flipAngle === 0 && frameAt(HIT, t, 1).glint === 0)).toBe(true);
  });
});

describe("the damage tokens", () => {
  it("leave the point of contact 90 ms apart, one for each damage, and all land by the end of the impact", () => {
    expect(burstGap(1, 1)).toBe(0);
    expect(burstGap(3, 1)).toBe(MOTION.spotlightBurstStep.ms);
    for (let damage = 1; damage <= 12; damage += 1) {
      const gap = burstGap(damage, 1);
      expect(gap).toBeLessThanOrEqual(MOTION.spotlightBurstStep.ms);
      expect(1220 + (damage - 1) * gap + MOTION.spotlightBurstFly.ms, `damage ${damage}`).toBeLessThanOrEqual(1700 + 1e-6);
    }
    // More than three squeeze together rather than run past the impact.
    expect(burstGap(6, 1)).toBeLessThan(MOTION.spotlightBurstStep.ms);
  });

  it("fly one after another from 0 to 1, in the air only while they fly", () => {
    expect(burstAt(0, 3, 1219, 1).flying).toBe(false);
    expect(burstAt(0, 3, 1220, 1)).toMatchObject({ flying: true, u: 0 });
    expect(burstAt(1, 3, 1220, 1).flying).toBe(false);
    expect(burstAt(1, 3, 1220 + 90, 1).flying).toBe(true);
    expect(burstAt(2, 3, 1220 + 180 + 110, 1).u).toBeGreaterThan(0.5);
    expect(burstAt(2, 3, 1700, 1).flying).toBe(false);
    expect(burstAt(0, 3, 1220 + 110, 1).u).toBeGreaterThan(burstAt(0, 3, 1220 + 30, 1).u);
  });
});

describe("the dark", () => {
  it("comes in over the first enter and lifts over the last return, and stays between two attacks", () => {
    expect(darkAt(0, 1, 1)).toBe(0);
    expect(darkAt(350, 1, 1)).toBe(1);
    expect(darkAt(1699, 1, 1)).toBe(1);
    expect(darkAt(2950, 1, 1)).toBeCloseTo(0.5, 6);
    expect(darkAt(3200, 1, 1)).toBe(0);
    expect(darkAt(2700, 1, 2)).toBe(1);
    expect(darkAt(2700 + 2200, 1, 2)).toBe(1);
    expect(darkAt(2700 + 2200 + 250, 1, 2)).toBeCloseTo(0.5, 6);
    expect(darkAt(spotlightSpan(2), 1, 2)).toBe(0);
    expect(SPOT.dark).toBeLessThan(1);
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
    expect(frameAt(middle, 2200, 1).flyAttackers).toBe(1);
    expect(frameAt(last, 2200 + 250, 1).flyAttackers).toBeLessThan(1);
    expect(frameAt(last, 2700, 1).flyAttackers).toBe(0);
  });

  it("read in 100 ms, charge in 200 and still touch the target and hold for the hit stop", () => {
    const b = beatsAt(1, { first: false, last: false });
    expect([b.readAt, b.chargeAt, b.lungeAt, b.stopAt, b.impactAt, b.retAt]).toEqual([200, 300, 500, 620, 720, 2200]);
    expect(frameAt(middle, b.lungeAt, 1)).toMatchObject({ back: 1, strike: 0 });
    expect(frameAt(middle, b.stopAt, 1).strike).toBe(1);
    expect(frameAt(middle, b.impactAt + 30, 1).shakeX).not.toBe(0);
  });

  it("scale with Quick like the first does", () => {
    const quick = beatsAt(0.6, { first: false, last: true });
    expect(quick.end).toBeCloseTo(2700 * 0.6, 6);
    expect(burstAt(0, 1, 720 * 0.6, 0.6, { first: false, last: false }).flying).toBe(true);
  });
});
