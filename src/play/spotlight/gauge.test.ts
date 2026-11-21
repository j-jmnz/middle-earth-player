// The gauge under the combat spotlight's target (spotlight/gauge.ts; docs/design-system-table.md, Spotlight): shields for the
// defense, hearts for the hit points, what the attack breaks and fills, and the count a long row turns into.
import { describe, expect, it } from "vitest";

import { absorbedOf, gaugeOf, type GaugeInput } from "./gauge.ts";
import { SPOT } from "./shape.ts";

const AT = { cx: 500, cy: 300, room: 168 + 50 };
const HIT: GaugeInput = { attack: 3, defense: 2, hitPoints: 4, undefended: false, before: 0, damage: 1 };

describe("the gauge", () => {
  it("shows a shield for each defense point and a heart for each hit point, centred, the attack breaking shields from the left", () => {
    const gauge = gaugeOf(AT, HIT);
    expect(gauge.shields.map((shield) => [shield.breaks, shield.holds])).toEqual([
      [true, false],
      [true, false],
    ]);
    expect(gauge.hearts.map((heart) => heart.was)).toEqual(["fresh", "whole", "whole", "whole"]);
    expect(gauge.hearts.map((heart) => heart.token)).toEqual([0, -1, -1, -1]);
    expect(gauge.mark).toBeNull();
    expect(gauge.shieldCount).toBeNull();
    expect(gauge.heartCount).toBeNull();
    // At its widest a glyph takes 30 pt and is 24 pt.
    expect(gauge.step).toBe(SPOT.gaugeStep);
    expect(gauge.size).toBe(SPOT.gaugeGlyph);
    const xs = [...gauge.shields.map((shield) => shield.x), ...gauge.hearts.map((heart) => heart.x)];
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    const left = (xs[0] ?? 0) - gauge.size / 2;
    const right = (xs[xs.length - 1] ?? 0) + gauge.size / 2;
    expect(right - left).toBeCloseTo(gauge.width, 6);
    expect(left + right).toBeCloseTo(2 * AT.cx, 6);
    // The dot is between the last shield and the first heart.
    expect(gauge.dot).toBeGreaterThan((gauge.shields[1]?.x ?? 0) + gauge.size / 2);
    expect(gauge.dot).toBeLessThan((gauge.hearts[0]?.x ?? 0) - gauge.size / 2);
    expect(gauge.sparks).toEqual([gauge.hearts[0]?.x]);
  });

  it("leaves the shields a blocked attack did not break standing, and they held", () => {
    const gauge = gaugeOf(AT, { ...HIT, attack: 2, defense: 3, damage: 0 });
    expect(gauge.shields.map((shield) => [shield.breaks, shield.holds])).toEqual([
      [true, false],
      [true, false],
      [false, true],
    ]);
    expect(gauge.hearts.every((heart) => heart.was === "whole")).toBe(true);
    expect(gauge.sparks).toEqual([]);
  });

  it("darkens the hearts lost before the attack and fills the ones it adds, as many tokens as land", () => {
    const gauge = gaugeOf(AT, { ...HIT, hitPoints: 3, before: 2, damage: 1 });
    expect(gauge.hearts.map((heart) => heart.was)).toEqual(["lost", "lost", "fresh"]);
    expect(gauge.hearts.map((heart) => heart.token)).toEqual([-1, -1, 0]);
    // More damage than hearts left: only the hearts there are fill.
    const over = gaugeOf(AT, { ...HIT, hitPoints: 3, before: 1, damage: 5 });
    expect(over.hearts.map((heart) => heart.was)).toEqual(["lost", "fresh", "fresh"]);
    expect(over.hearts.map((heart) => heart.token)).toEqual([-1, 0, 1]);
  });

  it("marks an undefended hero with a struck-out shield and no shields", () => {
    const gauge = gaugeOf(AT, { ...HIT, undefended: true, defense: 0, attack: 2, damage: 2 });
    expect(gauge.mark).not.toBeNull();
    expect(gauge.shields).toEqual([]);
    expect(gauge.dot).toBeNull();
    expect(gauge.mark).toBeLessThan(gauge.hearts[0]?.x ?? 0);
    expect(gauge.hearts.map((heart) => heart.was)).toEqual(["fresh", "fresh", "whole", "whole"]);
  });

  it("narrows its glyphs to fit a big enemy, and turns the hearts into one heart and a count when they would be too small", () => {
    const troll = gaugeOf(AT, { attack: 7, defense: 3, hitPoints: 9, undefended: false, before: 2, damage: 4 });
    expect(troll.heartCount).toBeNull();
    expect(troll.step).toBeLessThan(SPOT.gaugeStep);
    expect(troll.step).toBeGreaterThanOrEqual(SPOT.gaugeMinStep);
    expect(troll.width).toBeLessThanOrEqual(AT.room + 1e-9);
    expect(troll.sparks).toHaveLength(4);
    // A boss's 25 hit points: one heart and "left of most", the left before and after the attack.
    const boss = gaugeOf(AT, { attack: 9, defense: 4, hitPoints: 25, undefended: false, before: 5, damage: 6 });
    expect(boss.hearts).toEqual([]);
    expect(boss.heartCount).toMatchObject({ before: 20, after: 14, max: 25, breaks: true });
    expect(boss.shields).toHaveLength(4);
    expect(boss.sparks).toEqual(Array.from({ length: 6 }, () => boss.heartCount?.x));
    expect(boss.width).toBeLessThanOrEqual(AT.room + 1e-9);
    // On a narrow card the hearts go first, then the shields.
    const narrow = gaugeOf({ ...AT, room: 150 }, { attack: 9, defense: 5, hitPoints: 8, undefended: false, before: 0, damage: 4 });
    expect(narrow.heartCount).not.toBeNull();
    expect(narrow.shieldCount).toMatchObject({ before: 5, max: 5, breaks: true, holds: false });
    expect(narrow.sparks).toHaveLength(4);
  });

  it("caps the sparks at 9 and scales with the UI scale", () => {
    expect(gaugeOf(AT, { attack: 20, defense: 0, hitPoints: 30, undefended: false, before: 0, damage: 12 }).sparks).toHaveLength(SPOT.embers);
    const big = gaugeOf({ cx: AT.cx * 1.25, cy: AT.cy * 1.25, room: AT.room * 1.25 }, HIT, 1.25);
    const base = gaugeOf(AT, HIT);
    expect(big.size).toBeCloseTo(base.size * 1.25, 6);
    expect(big.width).toBeCloseTo(base.width * 1.25, 6);
    expect(big.hearts[0]?.x).toBeCloseTo((base.hearts[0]?.x ?? 0) * 1.25, 6);
  });
});

describe("the count's steps", () => {
  it("numbers the shields the attack breaks in order, and counts them as the steps before the tokens fly", () => {
    const gauge = gaugeOf(AT, HIT);
    expect(gauge.shields.map((shield) => shield.step)).toEqual([0, 1]);
    expect(gauge.steps).toBe(2);
    const blocked = gaugeOf(AT, { ...HIT, attack: 2, defense: 3, damage: 0 });
    expect(blocked.shields.map((shield) => shield.step)).toEqual([0, 1, -1]);
    expect(blocked.steps).toBe(2);
    // A counted row of shields breaks in one step.
    const boss = gaugeOf(AT, { attack: 9, defense: 8, hitPoints: 25, undefended: false, before: 0, damage: 1 });
    expect(boss.shieldCount).not.toBeNull();
    expect(boss.steps).toBe(1);
  });

  it("shows what a card effect took away as struck-out attack marks after the shields, one step each, at most 4", () => {
    // 4 against 2 placed 1 damage: one point was taken away.
    const toughness = { ...HIT, attack: 4, defense: 2, damage: 1 };
    expect(absorbedOf(toughness)).toBe(1);
    const gauge = gaugeOf(AT, toughness);
    expect(gauge.absorbed).toHaveLength(1);
    expect(gauge.absorbed[0]?.step).toBe(2);
    expect(gauge.steps).toBe(3);
    expect(gauge.absorbed[0]?.x).toBeGreaterThan(gauge.shields[1]?.x ?? 0);
    expect(gauge.absorbed[0]?.x).toBeLessThan(gauge.dot ?? 0);
    // Undefended, the whole attack goes through: 5 placed 3.
    expect(absorbedOf({ ...HIT, undefended: true, attack: 5, defense: 0, damage: 3 })).toBe(2);
    // More damage than the attack less the defense (a card effect added some) takes nothing away; so does a plain hit or block.
    expect(absorbedOf({ ...HIT, attack: 3, defense: 2, damage: 3 })).toBe(0);
    expect(absorbedOf(HIT)).toBe(0);
    expect(absorbedOf({ ...HIT, attack: 2, defense: 3, damage: 0 })).toBe(0);
    // A prevented attack (all of it taken away) shows at most 4 marks.
    const prevented = gaugeOf(AT, { ...HIT, attack: 9, defense: 1, damage: 0 });
    expect(prevented.absorbed).toHaveLength(SPOT.gaugeAbsorbed);
    expect(prevented.steps).toBe(1 + SPOT.gaugeAbsorbed);
  });
});
