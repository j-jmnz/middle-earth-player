// The combat spotlight's particles (docs/plans/combat-spotlight-redesign.md, §4): closed-form sprites from an index, a seed and a time.
import { describe, expect, it } from "vitest";

import { frameAt, type ClashShape } from "./spotlight-beats.ts";
import { ashBirth, ashCell, ATLAS_DRAWS, hash, PARTICLE_BUDGET, PARTICLE_COUNT, PARTICLE_DRAW, PARTICLE_LIFE, particleAt, visibleCount, type Anchor, type ParticleKind } from "./spotlight-particles.ts";

const KINDS = Object.keys(PARTICLE_COUNT) as ParticleKind[];
const AT: Anchor = { x: 400, y: 180, size: 234, dir: 0, w: 168 };
const range = (to: number, step = 1) => Array.from({ length: Math.floor(to / step) + 1 }, (_, index) => index * step);

describe("hash", () => {
  it("is deterministic, in [0, 1), and differs by index and by seed", () => {
    expect(hash(3, 99)).toBe(hash(3, 99));
    const values = range(999).map((i) => hash(i, 7));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    expect(new Set(values).size).toBe(values.length);
    expect(hash(3, 98)).not.toBe(hash(3, 99));
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
});

describe("a particle", () => {
  it("is the same for the same kind, index, time, seed and anchor, and different for another seed", () => {
    for (const kind of KINDS) {
      const a = particleAt(kind, 3, 200, 41, AT);
      expect(particleAt(kind, 3, 200, 41, AT)).toEqual(a);
    }
    expect(particleAt("spark", 3, 100, 41, AT)).not.toEqual(particleAt("spark", 3, 100, 42, AT));
    expect(particleAt("ember", 3, 1000, 41, AT)).not.toEqual(particleAt("ember", 3, 1000, 42, AT));
  });

  it("is invisible before the emitter begins, past the end of its life, and for an index the kind does not have", () => {
    for (const kind of KINDS) {
      for (let i = 0; i < PARTICLE_COUNT[kind]; i += 1) {
        expect(particleAt(kind, i, -1, 5, AT).alpha, `${kind} ${i}`).toBe(0);
        if (kind !== "ember") expect(particleAt(kind, i, PARTICLE_LIFE[kind] + 600, 5, AT).alpha, `${kind} ${i}`).toBe(0);
      }
      expect(particleAt(kind, PARTICLE_COUNT[kind], 100, 5, AT).alpha).toBe(0);
    }
    // Every sprite is visible at some moment of its life and never outside 0..1.
    for (const kind of KINDS) {
      for (let i = 0; i < PARTICLE_COUNT[kind]; i += 1) {
        const seen = range(2600, 5).map((t) => particleAt(kind, i, t, 5, AT).alpha);
        expect(Math.max(...seen), `${kind} ${i}`).toBeGreaterThan(0);
        expect(Math.min(...seen)).toBeGreaterThanOrEqual(0);
        expect(Math.max(...seen)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("starts the sparks at the point of contact, flying out and streaking along their velocity", () => {
    for (let i = 0; i < PARTICLE_COUNT.spark; i += 1) {
      const start = particleAt("spark", i, 0, 9, AT);
      expect(start.x).toBeCloseTo(AT.x, 9);
      expect(start.y).toBeCloseTo(AT.y, 9);
      expect(start.alpha).toBe(1);
      const later = particleAt("spark", i, 80, 9, AT);
      expect(Math.hypot(later.x - AT.x, later.y - AT.y)).toBeGreaterThan(20);
      // Close to its first heading the streak points where the spark is going.
      const before = particleAt("spark", i, 70, 9, AT);
      const heading = Math.atan2(later.y - before.y, later.x - before.x);
      expect(Math.cos(later.turn - heading)).toBeGreaterThan(0.95);
    }
    // They fall under gravity: later sparks hang lower than their path would have them.
    const far = range(300, 50).map((t) => particleAt("spark", 0, t, 9, AT));
    expect(far[far.length - 1]?.alpha).toBeLessThan(far[0]?.alpha ?? 0);
  });

  it("sends the deflection sparks back toward the attacker in a cone", () => {
    const back: Anchor = { ...AT, dir: Math.PI };
    for (let i = 0; i < PARTICLE_COUNT.deflect; i += 1) {
      const start = particleAt("deflect", i, 0, 9, back);
      expect([start.x, start.y]).toEqual([back.x, back.y]);
      const later = particleAt("deflect", i, 100, 9, back);
      expect(later.x).toBeLessThan(back.x - 10);
      expect(Math.abs(later.y - back.y)).toBeLessThan(Math.abs(later.x - back.x));
    }
  });

  it("flies the converging embers in from a ring around the attacker until they reach it", () => {
    for (let i = 0; i < PARTICLE_COUNT.converge; i += 1) {
      const path = range(700).map((t) => ({ t, ...particleAt("converge", i, t, 9, AT) })).filter((sample) => sample.alpha > 0);
      expect(path.length, `${i}`).toBeGreaterThan(100);
      const first = path[0];
      const last = path[path.length - 1];
      expect(Math.hypot((first?.x ?? 0) - AT.x, (first?.y ?? 0) - AT.y)).toBeGreaterThan(0.4 * AT.size);
      expect(Math.hypot((last?.x ?? 0) - AT.x, (last?.y ?? 0) - AT.y)).toBeLessThan(0.05 * AT.size);
      // It only comes closer.
      const dists = path.map((sample) => Math.hypot(sample.x - AT.x, sample.y - AT.y));
      expect(dists).toEqual([...dists].sort((a, b) => b - a));
    }
  });

  it("drifts the embers up around the card and loops them", () => {
    for (let i = 0; i < PARTICLE_COUNT.ember; i += 1) {
      const a = particleAt("ember", i, 1500, 9, AT);
      const b = particleAt("ember", i, 1520, 9, AT);
      expect(b.y).toBeLessThanOrEqual(a.y + 1e-9 + (b.alpha > 0 && a.alpha > 0 ? 0 : 1e9));
      expect(Math.abs(a.x - AT.x)).toBeLessThan(1.2 * AT.size);
    }
    expect(visibleCount("ember", 1500, 9, AT)).toBe(PARTICLE_COUNT.ember);
  });

  it("rises the ash from the card, born where the burn front passes", () => {
    for (let i = 0; i < PARTICLE_COUNT.ash; i += 1) {
      const born = ashBirth(i, 9, 450);
      expect(born).toBeGreaterThanOrEqual(0);
      expect(born).toBeLessThanOrEqual(450);
      expect(particleAt("ash", i, born - 1, 9, AT).alpha).toBe(0);
      const rising = particleAt("ash", i, born + 300, 9, AT);
      expect(rising.alpha).toBeGreaterThan(0);
      const cell = ashCell(i, 9);
      expect(rising.x).toBeGreaterThan(AT.x - AT.w! * 0.6);
      expect(rising.x).toBeLessThan(AT.x + AT.w! * 0.6);
      expect(rising.y).toBeLessThan(AT.y + (cell.v - 0.5) * AT.size);
    }
  });
});

describe("the budgets", () => {
  it("count 24 embers, 16 converging, 28 sparks, 18 deflecting and 36 ash, in at most four Atlas draws", () => {
    expect(PARTICLE_COUNT).toEqual({ ember: 24, converge: 16, spark: 28, deflect: 18, ash: 36 });
    expect(new Set(Object.values(PARTICLE_DRAW)).size).toBeLessThanOrEqual(4);
    expect(ATLAS_DRAWS).toBeLessThanOrEqual(4);
  });

  it("show at most about 90 sprites at once through a whole attack, kill, block or hit", () => {
    const shapes: ClashShape[] = [
      { damage: 3, destroyed: false, shadow: false, first: true, last: true },
      { damage: 2, destroyed: true, shadow: false, first: true, last: true },
      { damage: 0, destroyed: false, shadow: false, first: true, last: true },
    ];
    for (const shape of shapes) {
      let most = 0;
      for (const t of range(2200, 5)) {
        const f = frameAt(shape, t, 1, 7);
        const burst: ParticleKind = shape.damage === 0 ? "deflect" : "spark";
        const shown = visibleCount("ember", f.emberT, 7, AT) + visibleCount("converge", f.convergeT, 7, AT) + visibleCount(burst, f.sparkT, 7, AT) + visibleCount("ash", f.ashT, 7, AT);
        most = Math.max(most, shown);
      }
      expect(most, JSON.stringify(shape)).toBeLessThanOrEqual(PARTICLE_BUDGET);
      expect(most).toBeGreaterThan(24);
    }
    expect(PARTICLE_BUDGET).toBe(90);
  });
});
