// The combat spotlight's beats (docs/design-system-table.md, Spotlight): the nine beats add up to the run, the run is
// 3200 ms at Normal and 0.6 of it at Quick, and a frame at any moment is the pose the table of beats describes.
import { describe, expect, it } from "vitest";

import { MOTION, SPOTLIGHT_AGAIN, SPOTLIGHT_BEATS } from "../../ui/motion-tokens.ts";
import { beatsAt, burstAt, burstGap, darkAt, frameAt, hitTime, leaveTime, punchAt, runStart, spotlightRun, spotlightSpan, trailAt, windowOf, type ClashShape } from "./beats.ts";
import { cameraPush, FX, flashAt, ringAt } from "./fx.ts";
import { SPOT } from "./shape.ts";
import { strikeOffset, stageOf } from "./stage.ts";

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
  it("run enter, read, charge, lunge, stop, impact, count, hold and return in order, 3200 ms in all at Normal", () => {
    const b = beatsAt(1);
    expect([b.readAt, b.chargeAt, b.lungeAt, b.stopAt, b.impactAt, b.countAt, b.holdAt, b.retAt, b.end]).toEqual([300, 600, 850, 970, 1070, 1350, 2150, 2700, 3200]);
    expect(SPOTLIGHT_BEATS.reduce((sum, name) => sum + MOTION[name].ms, 0)).toBe(MOTION.spotlight.ms);
    expect(b.end).toBe(MOTION.spotlight.ms);
  });

  it("run at 0.6 under Quick, 1920 ms, and every beat scales with it", () => {
    const quick = beatsAt(0.6);
    expect(quick.end).toBeCloseTo(1920, 6);
    const normal = beatsAt(1);
    for (const key of ["intro", "read", "charge", "lunge", "stop", "impact", "count", "hold", "ret"] as const) expect(quick[key], key).toBeCloseTo(normal[key] * 0.6, 6);
  });

  it("add up for several attacks one after another: the first 2700, a later one 2350, the last going back 500 more", () => {
    expect(spotlightSpan(1)).toBe(3200);
    expect(spotlightRun(1, 0.6)).toBe(1920);
    expect(beatsAt(1, { first: true, last: false }).end).toBe(2700);
    expect(beatsAt(1, { first: false, last: false }).end).toBe(SPOTLIGHT_AGAIN);
    expect(beatsAt(1, { first: false, last: true }).end).toBe(SPOTLIGHT_AGAIN + 500);
    expect(spotlightSpan(2)).toBe(2700 + 2850);
    expect(spotlightSpan(3)).toBe(2700 + 2350 + 2850);
    expect(spotlightSpan(3)).toBe(7900);
    expect(spotlightRun(3, 0.6)).toBe(4740);
    expect(runStart(2, 3, 1)).toBe(2700 + 2350);
  });

  it("name when each strike lands and when the last attack begins to go back", () => {
    expect(hitTime(0, 1, 1)).toBe(970);
    expect(hitTime(0, 3, 1)).toBe(970);
    // A later attack swaps in over 200 ms, reads over 100 and charges over 200, so its hit stop is 620 ms after it begins.
    expect(hitTime(1, 3, 1)).toBe(2700 + 620);
    expect(hitTime(2, 3, 1)).toBe(2700 + 2350 + 620);
    expect(hitTime(1, 3, 0.6)).toBeCloseTo((2700 + 620) * 0.6, 6);
    expect(leaveTime(1, 1)).toBe(2700);
    expect(leaveTime(2, 1)).toBe(2700 + 2350);
    expect(windowOf(0, 3, 1)).toEqual({ start: 0, length: 2700 + 200 });
    expect(windowOf(2, 3, 1)).toEqual({ start: 5050, length: 2850 });
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
    const there = frameAt(HIT, 300, 1);
    expect([there.flyAttackers, there.flyTarget, darkAt(300, 1, 1)]).toEqual([1, 1, 1]);
  });

  it("overshoots the center a little as the cards arrive, and settles on it", () => {
    const fly = range(300, 5).map((t) => frameAt(HIT, t, 1).flyAttackers);
    expect(Math.max(...fly)).toBeGreaterThan(1);
    expect(Math.max(...fly)).toBeLessThan(1.15);
    expect(fly[fly.length - 1]).toBe(1);
  });

  it("pops the attack value and the gauge in over the read, and brings the matchup line in with them until the lunge", () => {
    expect(frameAt(HIT, 299, 1).badgeA).toBe(0);
    expect(frameAt(HIT, 299, 1).matchup).toBe(0);
    expect(frameAt(HIT, 600, 1).matchup).toBe(1);
    expect(frameAt(HIT, 850, 1).matchup).toBe(1);
    expect(frameAt(HIT, 970, 1).matchup).toBe(0);
    const pops = range(300, 5).map((t) => frameAt(HIT, 300 + t, 1).badgeA);
    expect(Math.max(...pops)).toBeGreaterThan(1);
    expect(pops[pops.length - 1]).toBe(1);
  });

  it("draws the attacker back and tilts it 5 degrees away over the charge, then lunges to touch the target", () => {
    const drawn = frameAt(HIT, 850, 1);
    expect(drawn.back).toBe(1);
    expect(drawn.strike).toBe(0);
    expect(drawn.tilt).toBeCloseTo(-SPOT.tilt * RAD, 6);
    expect(frameAt(HIT, 725, 1).back).toBeGreaterThan(0.5);
    const touching = frameAt(HIT, 970, 1);
    expect(touching.strike).toBe(1);
    expect(touching.tilt).toBeCloseTo(0, 9);
    expect(frameAt(HIT, 910, 1).strike).toBeGreaterThan(0);
    expect(frameAt(HIT, 910, 1).strike).toBeLessThan(1);
    // In points: back by the draw back, forward by the gap to touch.
    const stage = stageOf({ width: 844, height: 390, origin: { x: 0, y: 0 }, safe: { top: 0, right: 0, bottom: 0, left: 0 } }, { w: 51, h: 71 }, 1, false);
    expect(strikeOffset(stage, drawn)).toBeCloseTo(-stage.drawBack, 6);
    expect(strikeOffset(stage, touching)).toBeCloseTo(stage.gap, 6);
  });

  it("builds the rim glow over the charge and lets it go at the hit", () => {
    expect(frameAt(HIT, 599, 1).charge).toBe(0);
    expect(frameAt(HIT, 850, 1).charge).toBe(1);
    expect(frameAt(HIT, 970, 1).charge).toBe(1);
    expect(frameAt(HIT, 1070 + 160, 1).charge).toBe(0);
  });

  it("pushes the camera in from 1 to 1.06 over the charge, holds it, and lets go over the return", () => {
    // The camera belongs to the run (punchAt): the one source the stage and the HUD read.
    expect(punchAt(600, 1, 1)).toBe(1);
    expect(punchAt(850, 1, 1)).toBeCloseTo(FX.push, 9);
    expect(punchAt(1500, 1, 1)).toBeCloseTo(FX.push, 9);
    expect(punchAt(2950, 1, 1)).toBeCloseTo(1 + (FX.push - 1) / 2, 6);
    expect(punchAt(3200, 1, 1)).toBe(1);
    expect(punchAt(0, 1, 1)).toBe(1);
    expect(punchAt(850, 1, 2)).toBeCloseTo(FX.push, 9);
    expect(punchAt(2700 + 2850, 1, 2)).toBe(1);
    expect(cameraPush(0)).toBe(1);
    expect(cameraPush(1)).toBeCloseTo(1.06, 9);
  });

  it("shows the afterimages only during the lunge, three of them, fainter the older", () => {
    for (const t of range(3200, 10)) {
      const lunging = t >= 850 && t < 970;
      expect(frameAt(HIT, t, 1).trail, `${t}`).toBe(lunging ? 1 : 0);
      for (const j of [1, 2, 3]) expect(trailAt(HIT, t, 1, j).alpha > 0, `${t} ${j}`).toBe(lunging);
    }
    const [one, two, three] = [1, 2, 3].map((j) => trailAt(HIT, 950, 1, j));
    expect(one?.alpha).toBeGreaterThan(two?.alpha ?? 1);
    expect(two?.alpha).toBeGreaterThan(three?.alpha ?? 1);
    // Each afterimage is the same clock a step earlier, so it lags the card.
    expect(one?.strike).toBeLessThan(frameAt(HIT, 950, 1).strike);
    expect(three?.strike).toBeLessThan(one?.strike ?? 0);
  });

  it("keeps the cards and the result up through the hold, then goes back", () => {
    const shown = frameAt(HIT, 2150, 1);
    const held = frameAt(HIT, 2699, 1);
    expect(held).toMatchObject({ flyAttackers: 1, flyTarget: 1, strike: 1, badgeA: 1 });
    expect(held.result.alpha).toBe(shown.result.alpha);
    expect(held.result.alpha).toBe(1);
    expect(frameAt(HIT, 2700, 1).flyAttackers).toBe(1);
  });

  it("holds everything for the hit stop: nothing but the flash moves between 970 and 1070 ms", () => {
    const base = frameAt(HIT, 970, 1);
    for (const t of [980, 1020, 1069]) {
      const held = frameAt(HIT, t, 1);
      for (const key of ["flyAttackers", "flyTarget", "back", "strike", "tilt", "recoil", "knock", "tint", "charge", "badgeA", "badgeD", "shakeX", "shakeY", "shakeTurn", "dissolve"] as const) expect(held[key], `${key} at ${t}`).toBe(base[key]);
      expect(held.sparkT).toBe(-1);
      expect(held.ring.alpha).toBe(0);
      expect(held.result.alpha).toBe(0);
      expect(held.flash).toBeGreaterThan(0);
      // The feet bank's fog and the charge's embers stand still with the rest.
      expect(held.fogT).toBe(base.fogT);
      expect(held.convergeT).toBe(base.convergeT);
    }
    // They carry on from where they stood, without the stop.
    expect(frameAt(HIT, 1070, 1).fogT).toBe(970);
    expect(frameAt(HIT, 1070, 1).convergeT).toBe(970 - 600);
    expect(frameAt(HIT, 1170, 1).fogT).toBe(1070);
    expect(frameAt(HIT, 1170, 1).convergeT).toBe(1070 - 600);
    expect(frameAt(HIT, 950, 1).fogT).toBe(950);
    // At Quick the clocks are still in unscaled ms: 0.6 · 970 ms of run, held for the 60 ms stop, is 970 unscaled.
    expect(frameAt(HIT, 0.6 * 1070, 0.6).fogT).toBeCloseTo(970, 6);
    expect(frameAt(HIT, 0.6 * 980, 0.6).fogT).toBeCloseTo(970, 6);
  });

  it("holds a kill for 160 ms at the hit, the extra 60 coming out of the impact, so a kill still counts and ends with the run", () => {
    const hit = beatsAt(1, HIT);
    const kill = beatsAt(1, KILL);
    expect([hit.stop, hit.impact]).toEqual([100, 280]);
    expect([kill.stop, kill.impact]).toEqual([160, 220]);
    // The strike lands (and the haptic ticks) at the same moment, and the count, the return and the end are where they were.
    expect([kill.stopAt, kill.impactAt, kill.countAt, kill.retAt, kill.end]).toEqual([970, 1130, 1350, 2700, 3200]);
    expect([hit.stopAt, hit.countAt, hit.retAt, hit.end]).toEqual([kill.stopAt, kill.countAt, kill.retAt, kill.end]);
    expect(hitTime(0, 1, 1)).toBe(kill.stopAt);
    // A lone kill is 3200 ms and a later one 2350 ms, like the rest.
    expect(kill.stop + kill.impact).toBe(hit.stop + hit.impact);
    expect(spotlightRun(1, 1)).toBe(3200);
    const again = beatsAt(1, { first: false, last: false, destroyed: true });
    expect(again.end).toBe(2350);
    expect([again.stop, again.impact]).toEqual([160, 220]);
    // Quick scales both the same.
    const quick = beatsAt(0.6, KILL);
    expect(quick.stop).toBeCloseTo(0.6 * 160, 9);
    expect(quick.end).toBeCloseTo(0.6 * 3200, 6);
    // The stop holds the picture for the whole 160 ms, and the impact begins after it; the tokens fly in the count, which starts as ever.
    const base = frameAt(KILL, 970, 1);
    for (const t of [1000, 1050, 1129]) {
      const held = frameAt(KILL, t, 1);
      expect(held.sparkT).toBe(-1);
      expect(held.strike).toBe(base.strike);
      expect(held.fogT).toBe(base.fogT);
    }
    expect(frameAt(KILL, 1130, 1).sparkT).toBe(0);
    expect(burstAt(2, 3, 1350 + 130 + 2 * 150 + 220, 1, { first: true, last: true, destroyed: true }).u).toBe(1);
    expect(burstGap(3, 1) * 2 + 220 + 130).toBeLessThanOrEqual(800);
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
    expect(frameAt(HIT, 1070, 1).ring).toEqual({ r: 0, alpha: 0 });
    const mid = frameAt(HIT, 1070 + 100, 1).ring;
    expect(mid.alpha).toBeGreaterThan(0.3);
    expect(frameAt(HIT, 1070 + 300, 1).ring.r).toBeGreaterThan(mid.r);
    expect(frameAt(HIT, 1070 + 360, 1).ring.alpha).toBe(0);
    expect(ringAt(0.5).r).toBeLessThan(FX.ringStart + FX.ringGrow);
  });

  it("starts the effect clocks at their beats, in unscaled ms, and -1 before", () => {
    const f = (t: number) => frameAt(KILL, t, 1);
    expect([f(0).fogT, f(500).fogT]).toEqual([0, 500]);
    expect([f(599).convergeT, f(600).convergeT, f(700).convergeT]).toEqual([-1, 0, 100]);
    // The sparks start at the impact: 1070 ms, or 1130 on a kill (its stop is 60 ms longer).
    expect([f(1129).sparkT, f(1130).sparkT, f(1230).sparkT]).toEqual([-1, 0, 100]);
    expect([frameAt(HIT, 1069, 1).sparkT, frameAt(HIT, 1070, 1).sparkT, frameAt(HIT, 1170, 1).sparkT]).toEqual([-1, 0, 100]);
    expect([f(2699).ashT, f(2700).ashT, f(2800).ashT]).toEqual([-1, 0, 100]);
    expect(frameAt(HIT, 1800, 1).ashT).toBe(-1);
  });
});
