// The Atlas layout of the combat spotlight's particles (spotlight/atlas.ts): three draws, every slot at its sprite's place.
import { describe, expect, it } from "vitest";

import { ATLAS_BLEND, ATLAS_CELL, ATLAS_SLOTS, CELL, drawLive, rgbOf, spriteAt, type Emitters, type Times } from "./atlas.ts";
import { ATLAS_DRAWS, PARTICLE_COUNT, PARTICLE_DRAW, particleAt } from "./particles.ts";

const E: Emitters = {
  seed: 41,
  burnMs: 450,
  blocked: false,
  converge: { x: 300, y: 180, size: 234 },
  hit: { x: 420, y: 180, size: 234, dir: -0.3 },
  ash: { x: 520, y: 180, size: 234, w: 168 },
  rim: [0.83, 0.33, 0.22],
};
const OFF: Times = { convergeT: -1, sparkT: -1, ashT: -1, dark: 1 };

describe("the atlas draws", () => {
  it("are the draws the particles allow, each as large as its kinds need", () => {
    expect(ATLAS_SLOTS.length).toBe(ATLAS_DRAWS);
    expect(Math.max(...Object.values(PARTICLE_DRAW)) + 1).toBe(ATLAS_DRAWS);
    expect(ATLAS_SLOTS).toEqual([PARTICLE_COUNT.converge, Math.max(PARTICLE_COUNT.spark, PARTICLE_COUNT.deflect), PARTICLE_COUNT.ash]);
    expect(ATLAS_CELL).toEqual([0, 1, 0]);
    // Every draw is light added to the picture: the smoke is black fog (spotlight/fog.ts), not sprites.
    expect(ATLAS_BLEND).toEqual(["plus", "plus", "plus"]);
  });
});

describe("spriteAt", () => {
  it("is empty (alpha 0) for every slot when no clock runs", () => {
    for (let draw = 0; draw < ATLAS_DRAWS; draw += 1) for (let i = 0; i < (ATLAS_SLOTS[draw] ?? 0); i += 1) expect(spriteAt(draw, i, OFF, E).a).toBe(0);
  });

  it("puts the center of the sprite's cell at the particle's point, whatever its turn", () => {
    const times: Times = { convergeT: 200, sparkT: 120, ashT: 300, dark: 1 };
    let seen = 0;
    for (let draw = 0; draw < ATLAS_DRAWS; draw += 1) {
      for (let i = 0; i < (ATLAS_SLOTS[draw] ?? 0); i += 1) {
        const slot = spriteAt(draw, i, times, E);
        if (slot.a === 0) continue;
        seen += 1;
        const half = CELL / 2;
        const x = slot.scos * half - slot.ssin * half + slot.tx;
        const y = slot.ssin * half + slot.scos * half + slot.ty;
        const p = [
          () => particleAt("converge", i, times.convergeT, E.seed, E.converge, E.burnMs),
          () => particleAt("spark", i, times.sparkT, E.seed, E.hit, E.burnMs),
          () => particleAt("ash", i, times.ashT, E.seed, E.ash, E.burnMs),
        ][draw]!();
        expect(x).toBeCloseTo(p.x, 6);
        expect(y).toBeCloseTo(p.y, 6);
        expect(slot.a).toBeCloseTo(p.alpha, 12);
      }
    }
    expect(seen).toBeGreaterThan(20);
  });

  it("reads deflection, not sparks, when the attack was blocked, in silver", () => {
    const sparks = spriteAt(1, 2, { ...OFF, sparkT: 80 }, E);
    const blocked = spriteAt(1, 2, { ...OFF, sparkT: 80 }, { ...E, blocked: true });
    expect(blocked).not.toEqual(sparks);
    expect(blocked.b).toBeGreaterThan(blocked.r);
    expect(sparks.r).toBeGreaterThan(sparks.b);
  });

  it("fades the glow with the dark and leaves the sparks and the ash alone", () => {
    const times: Times = { convergeT: 200, sparkT: 120, ashT: 300, dark: 1 };
    const half: Times = { ...times, dark: 0.5 };
    let seen = 0;
    for (const draw of [0]) {
      for (let i = 0; i < (ATLAS_SLOTS[draw] ?? 0); i += 1) {
        const full = spriteAt(draw, i, times, E);
        if (full.a === 0) continue;
        seen += 1;
        expect(spriteAt(draw, i, half, E).a).toBeCloseTo(full.a * 0.5, 12);
        expect(spriteAt(draw, i, { ...times, dark: 0 }, E).a).toBe(0);
      }
    }
    expect(seen).toBeGreaterThan(10);
    for (const draw of [1, 2]) for (let i = 0; i < (ATLAS_SLOTS[draw] ?? 0); i += 1) expect(spriteAt(draw, i, half, E).a).toBe(spriteAt(draw, i, times, E).a);
  });

  it("is live only while a draw can show something", () => {
    expect([0, 1, 2].map((draw) => drawLive(draw, OFF, E))).toEqual([false, false, false]);
    expect(drawLive(0, { ...OFF, convergeT: 100 }, E)).toBe(true);
    expect(drawLive(0, { ...OFF, convergeT: 100, dark: 0 }, E)).toBe(false);
    expect(drawLive(0, { ...OFF, convergeT: 100000 }, E)).toBe(false);
    expect(drawLive(1, { ...OFF, sparkT: 100 }, E)).toBe(true);
    expect(drawLive(1, { ...OFF, sparkT: 100000 }, E)).toBe(false);
    expect(drawLive(2, { ...OFF, ashT: 100 }, E)).toBe(true);
    expect(drawLive(2, { ...OFF, ashT: 5000 }, E)).toBe(false);
    // Where a draw is not live every one of its slots is empty.
    for (const [draw, times] of [[1, { ...OFF, sparkT: 100000 }], [2, { ...OFF, ashT: 5000 }], [0, { ...OFF, dark: 0, convergeT: 100 }], [0, { ...OFF, convergeT: 100000 }]] as const) for (let i = 0; i < (ATLAS_SLOTS[draw] ?? 0); i += 1) expect(spriteAt(draw, i, times, E).a).toBe(0);
  });

  it("is deterministic for a seed", () => {
    const times: Times = { convergeT: 100, sparkT: 60, ashT: 200, dark: 1 };
    expect(spriteAt(0, 5, times, E)).toEqual(spriteAt(0, 5, times, E));
    expect(spriteAt(0, 5, times, E)).not.toEqual(spriteAt(0, 5, times, { ...E, seed: 42 }));
  });
});

describe("rgbOf", () => {
  it("reads a hex color as 0..1 channels", () => {
    expect(rgbOf("#000000")).toEqual([0, 0, 0]);
    expect(rgbOf("#FF8000")).toEqual([1, 128 / 255, 0]);
  });
});
