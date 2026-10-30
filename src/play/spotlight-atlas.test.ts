// The Atlas layout of the combat spotlight's particles (spotlight-atlas.ts): two draws, every slot at its sprite's place.
import { describe, expect, it } from "vitest";

import { ATLAS_CELL, ATLAS_SLOTS, CELL, drawLive, spriteAt, type Emitters, type Times } from "./spotlight-atlas.ts";
import { ATLAS_DRAWS, PARTICLE_COUNT, PARTICLE_DRAW, particleAt } from "./spotlight-particles.ts";

const E: Emitters = {
  seed: 41,
  burnMs: 450,
  blocked: false,
  hit: { x: 420, y: 180, size: 234, dir: -0.3 },
  ash: { x: 520, y: 180, size: 234, w: 168 },
};
const OFF: Times = { sparkT: -1, ashT: -1 };

describe("the atlas draws", () => {
  it("are the draws the particles allow, each as large as its kinds need", () => {
    expect(ATLAS_SLOTS.length).toBe(ATLAS_DRAWS);
    expect(Math.max(...Object.values(PARTICLE_DRAW)) + 1).toBe(ATLAS_DRAWS);
    expect(ATLAS_SLOTS[0]).toBe(Math.max(PARTICLE_COUNT.spark, PARTICLE_COUNT.deflect));
    expect(ATLAS_SLOTS[1]).toBe(PARTICLE_COUNT.ash);
    expect(ATLAS_CELL).toEqual([1, 0]);
  });
});

describe("spriteAt", () => {
  it("is empty (alpha 0) for every slot when no clock runs", () => {
    for (let draw = 0; draw < ATLAS_DRAWS; draw += 1) for (let i = 0; i < (ATLAS_SLOTS[draw] ?? 0); i += 1) expect(spriteAt(draw, i, OFF, E).a).toBe(0);
  });

  it("puts the center of the sprite's cell at the particle's point, whatever its turn", () => {
    const times: Times = { sparkT: 120, ashT: 300 };
    let seen = 0;
    for (let draw = 0; draw < ATLAS_DRAWS; draw += 1) {
      for (let i = 0; i < (ATLAS_SLOTS[draw] ?? 0); i += 1) {
        const slot = spriteAt(draw, i, times, E);
        if (slot.a === 0) continue;
        seen += 1;
        const half = CELL / 2;
        const x = slot.scos * half - slot.ssin * half + slot.tx;
        const y = slot.ssin * half + slot.scos * half + slot.ty;
        const p = draw === 0 ? particleAt("spark", i, times.sparkT, E.seed, E.hit, E.burnMs) : particleAt("ash", i, times.ashT, E.seed, E.ash, E.burnMs);
        expect(x).toBeCloseTo(p.x, 6);
        expect(y).toBeCloseTo(p.y, 6);
        expect(slot.a).toBeCloseTo(p.alpha, 12);
      }
    }
    expect(seen).toBeGreaterThan(20);
  });

  it("reads deflection, not sparks, when the attack was blocked, in silver", () => {
    const sparks = spriteAt(0, 2, { ...OFF, sparkT: 80 }, E);
    const blocked = spriteAt(0, 2, { ...OFF, sparkT: 80 }, { ...E, blocked: true });
    expect(blocked).not.toEqual(sparks);
    expect(blocked.b).toBeGreaterThan(blocked.r);
    expect(sparks.r).toBeGreaterThan(sparks.b);
  });

  it("is live only while a draw can show something", () => {
    expect([0, 1].map((draw) => drawLive(draw, OFF, E))).toEqual([false, false]);
    expect(drawLive(0, { ...OFF, sparkT: 100 }, E)).toBe(true);
    expect(drawLive(0, { ...OFF, sparkT: 100000 }, E)).toBe(false);
    expect(drawLive(1, { ...OFF, ashT: 100 }, E)).toBe(true);
    expect(drawLive(1, { ...OFF, ashT: 5000 }, E)).toBe(false);
    // Where a draw is not live every one of its slots is empty.
    for (const [draw, times] of [[0, { ...OFF, sparkT: 100000 }], [1, { ...OFF, ashT: 5000 }]] as const) for (let i = 0; i < (ATLAS_SLOTS[draw] ?? 0); i += 1) expect(spriteAt(draw, i, times, E).a).toBe(0);
  });

  it("is deterministic for a seed", () => {
    const times: Times = { sparkT: 60, ashT: 200 };
    expect(spriteAt(0, 5, times, E)).toEqual(spriteAt(0, 5, times, E));
    expect(spriteAt(0, 5, times, E)).not.toEqual(spriteAt(0, 5, times, { ...E, seed: 42 }));
  });
});
