import { describe, expect, it } from "vitest";

import { FX } from "./fx.ts";
import { stageOf, type StageArea } from "./stage.ts";
import { warmFor } from "./warm.ts";

const area: StageArea = { width: 800, height: 380, origin: { x: 0, y: 52 }, safe: { top: 0, right: 0, bottom: 0, left: 0 } };
const card = { w: 62, h: 86 };

describe("the spotlight's pictures decoded ahead", () => {
  it("names the enemy and its defender once, at a lone attacker's stage size with the camera's punch-in", () => {
    const warm = warmFor(["orc", "hero", "orc", null, ""], area, card, 1);
    const target = stageOf(area, card, 1, false, 1).target;
    expect(warm).toEqual({ codes: ["orc", "hero"], w: target.w * FX.push, h: target.h * FX.push });
  });

  it("is nothing when no attack is pending", () => {
    expect(warmFor([null, null], area, card, 1)).toBeNull();
  });

  it("is never smaller than the stage of a fan or of an attack with a shadow card", () => {
    const warm = warmFor(["orc"], area, card, 1);
    for (const [attackers, shadow] of [[1, true], [2, false], [3, true]] as const) expect(warm?.w ?? 0).toBeGreaterThanOrEqual(stageOf(area, card, attackers, shadow, 1).target.w * FX.push - 0.001);
  });
});
