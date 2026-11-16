import { describe, expect, it } from "vitest";

import { spotlightSpan } from "./beats.ts";
import { SPOT } from "./shape.ts";
import { WARM_CODE, warmPlan } from "./warm-plan.ts";

describe("warmPlan", () => {
  const plan = warmPlan(844, 390);

  it("covers a hit with a fan and a turned shadow card, a destroyed target and a blocked attack", () => {
    const [hit, destroyed, blocked] = plan.clashes;
    expect(plan.clashes).toHaveLength(3);
    expect(hit?.attackers).toHaveLength(SPOT.fan);
    expect(hit?.more).toBeGreaterThan(0);
    expect(hit?.shadow).not.toBeNull();
    expect(hit?.shape).toMatchObject({ damage: 2, destroyed: false, shadow: true, first: true, last: false });
    expect(destroyed?.shape).toMatchObject({ destroyed: true, first: false, last: false });
    expect(blocked?.shape).toMatchObject({ damage: 0, destroyed: false, last: true });
  });

  it("draws one picture, on the screen's own area, and runs as long as three attacks", () => {
    expect(plan.codes).toEqual([WARM_CODE]);
    expect(plan.area.width).toBe(844);
    expect(plan.span).toBe(spotlightSpan(3));
    for (const clash of plan.clashes) expect(clash.stage.target.w).toBeGreaterThan(0);
  });
});
