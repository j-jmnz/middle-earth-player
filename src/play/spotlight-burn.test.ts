// The burn of a destroyed target (docs/plans/combat-spotlight-redesign.md, §4): the field, the shader built from the same constants,
// and the ash born in the order the front passes. The shader is compiled and run by CanvasKit (Skia's own SkSL), which the app uses on the web.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { CanvasKit } from "canvaskit-wasm";
import { describe, expect, it } from "vitest";

import { ashOrder, BURN, BURN_SKSL, burnField, burnFront, burnSeed, burnThreshold } from "./spotlight-burn.ts";
import { MOTION } from "./motion-tokens.ts";
import { ashBirth, ashCell, PARTICLE_COUNT } from "./spotlight-particles.ts";

const BURN_MS = MOTION.spotlightBurn.ms;
const range = (to: number, step = 1) => Array.from({ length: Math.floor(to / step) + 1 }, (_, index) => index * step);

describe("the burn field", () => {
  it("stays in [0, 1] over the whole card, for any seed", () => {
    for (const seed of [0, 1, 7, 217, 4601, -3, 123456]) {
      let low = Infinity;
      let high = -Infinity;
      for (let i = 0; i <= 60; i += 1) {
        for (let j = 0; j <= 60; j += 1) {
          const value = burnField(i / 60, j / 60, seed);
          low = Math.min(low, value);
          high = Math.max(high, value);
        }
      }
      expect(low, `seed ${seed}`).toBeGreaterThanOrEqual(0);
      expect(high, `seed ${seed}`).toBeLessThanOrEqual(1);
      expect(high - low, `seed ${seed}`).toBeGreaterThan(0.4);
    }
  });

  it("is deterministic, differs by seed, is smooth, and burns the foot of the card first", () => {
    expect(burnField(0.3, 0.6, 12)).toBe(burnField(0.3, 0.6, 12));
    expect(burnField(0.3, 0.6, 12)).not.toBe(burnField(0.3, 0.6, 13));
    // The seed folds to 16 values.
    expect(burnField(0.3, 0.6, 12)).toBe(burnField(0.3, 0.6, 12 + BURN.seeds));
    expect(burnSeed(-1)).toBe(BURN.seeds - 1);
    for (let i = 0; i < 200; i += 1) expect(Math.abs(burnField(i / 200, 0.4, 3) - burnField(i / 200 + 0.001, 0.4, 3))).toBeLessThan(0.02);
    const mean = (v: number) => range(200).reduce((sum, i) => sum + burnField(i / 200, v, 3), 0) / 201;
    expect(mean(0.9)).toBeLessThan(mean(0.1));
  });

  it("burns everything by the end of the dissolve, rim and all", () => {
    expect(burnThreshold(0)).toBe(0);
    expect(burnThreshold(1) - BURN.rim).toBeGreaterThanOrEqual(1);
    expect(burnFront(0)).toBe(0);
    expect(burnFront(1 + BURN.rim)).toBe(1);
    expect(burnFront(0.5)).toBeGreaterThan(burnFront(0.2));
    // The front reaches a field value when the threshold does: burnThreshold(burnFront(f)) = f at the dissolve's own curve (inQuad).
    for (const f of [0.1, 0.4, 0.8]) expect(burnThreshold(burnFront(f) ** 2)).toBeCloseTo(f, 9);
  });
});

describe("the ash", () => {
  it("is born in the order the burn front passes its cells", () => {
    for (const seed of [0, 5, 91, 4601]) {
      const cells = range(PARTICLE_COUNT.ash - 1).map((i) => ashCell(i, seed));
      const order = ashOrder(cells, seed);
      expect(order).toHaveLength(PARTICLE_COUNT.ash);
      expect([...order].sort((a, b) => a - b)).toEqual(range(PARTICLE_COUNT.ash - 1));
      const births = order.map((i) => ashBirth(i, seed, BURN_MS));
      expect(births).toEqual([...births].sort((a, b) => a - b));
      // A sprite whose cell burns first is born first.
      expect(births[0]).toBeLessThan(births[births.length - 1] ?? 0);
      expect(Math.max(...births)).toBeLessThanOrEqual(BURN_MS);
    }
  });

  it("starts at the low-field cells: a cell is born once the dissolve's threshold passes its field value", () => {
    const seed = 17;
    for (let i = 0; i < PARTICLE_COUNT.ash; i += 1) {
      const cell = ashCell(i, seed);
      const field = burnField(cell.u, cell.v, seed);
      // The dissolve at the sprite's birth (inQuad over the burn) puts the threshold at its field value.
      const d = (ashBirth(i, seed, BURN_MS) / BURN_MS) ** 2;
      expect(burnThreshold(d)).toBeCloseTo(Math.min(field, 1 + BURN.rim), 9);
    }
  });
});

describe("the shader", () => {
  it("is built from the same constants and has the uniforms the layer sets", () => {
    expect(BURN_SKSL).toContain("uniform shader image;");
    expect(BURN_SKSL).toContain("uniform float threshold;");
    expect(BURN_SKSL).toContain("uniform float4 rect;");
    expect(BURN_SKSL).toContain("uniform float seed;");
    for (const value of [...BURN.cells, ...BURN.weight, BURN.lean, BURN.rim, ...BURN.hashScale, ...BURN.seedStep, BURN.hashShift]) expect(BURN_SKSL).toContain(Number.isInteger(value) ? `${value}.0` : String(value));
    expect(BURN_SKSL.split("{").length).toBe(BURN_SKSL.split("}").length);
  });

  // Skia's own compiler (CanvasKit, in the app's dependencies for the web) compiles the SkSL and runs it on a raster surface, so the shader
  // that the phone compiles is the one tested, and its burn matches the TypeScript field the ash is born from.
  it("compiles in Skia and burns the pixels the TypeScript field says it burns", async () => {
    // CanvasKit as Skia resolves it, so the version tested is the one the app ships.
    const fromSkia = createRequire(createRequire(import.meta.url).resolve("@shopify/react-native-skia/package.json"));
    const wasmDir = join(dirname(fromSkia.resolve("canvaskit-wasm/package.json")), "bin");
    const load = fromSkia("canvaskit-wasm") as (options: { locateFile: (file: string) => string }) => Promise<CanvasKit>;
    const kit = await load({ locateFile: (file) => join(wasmDir, file) });
    const errors: string[] = [];
    const effect = kit.RuntimeEffect.Make(BURN_SKSL, (message: string) => errors.push(message));
    expect(errors).toEqual([]);
    if (!effect) throw new Error("the burn shader did not compile in CanvasKit");
    const size = 64;
    const seed = burnSeed(4601);
    for (const threshold of [0.3, 0.45, 0.6]) {
      const surface = kit.MakeSurface(size, size);
      if (!surface) throw new Error("CanvasKit made no raster surface");
      const canvas = surface.getCanvas();
      const white = kit.Shader.MakeColor(kit.Color4f(1, 1, 1, 1), kit.ColorSpace.SRGB);
      const shader = effect.makeShaderWithChildren([0, 0, size, size, threshold, seed], [white]);
      const paint = new kit.Paint();
      paint.setShader(shader);
      canvas.drawRect(kit.XYWHRect(0, 0, size, size), paint);
      const pixels = surface.makeImageSnapshot().readPixels(0, 0, { width: size, height: size, colorType: kit.ColorType.RGBA_8888, alphaType: kit.AlphaType.Unpremul, colorSpace: kit.ColorSpace.SRGB }) as Uint8Array;
      let gone = 0;
      let kept = 0;
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const field = burnField((x + 0.5) / size, (y + 0.5) / size, 4601);
          const alpha = pixels[(y * size + x) * 4 + 3] ?? 0;
          if (field < threshold - 0.015) {
            expect(alpha, `gone ${x},${y} at ${threshold}`).toBe(0);
            gone += 1;
          } else if (field > threshold + 0.015) {
            expect(alpha, `kept ${x},${y} at ${threshold}`).toBe(255);
            kept += 1;
          }
        }
      }
      expect(gone).toBeGreaterThan(0);
      expect(kept).toBeGreaterThan(0);
      surface.delete();
    }
  });
});
