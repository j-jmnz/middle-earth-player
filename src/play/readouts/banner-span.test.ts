import { describe, expect, it } from "vitest";

import { bannerSpan } from "./banner-span.ts";

describe("the banner's band", () => {
  it("is centered on the screen and never reaches over the command column or into the left inset", () => {
    for (const [width, leftClear, rightClear] of [[844, 47, 47 + 253], [1024, 0, 280], [740, 0, 255], [915, 48, 48 + 275]] as const) {
      const { left, right } = bannerSpan(width, 472, leftClear, rightClear);
      expect(left).toBe(right);
      expect(left).toBeGreaterThanOrEqual(leftClear);
      expect(right).toBeGreaterThanOrEqual(rightClear);
      expect(width - left - right).toBeLessThanOrEqual(472);
    }
  });

  it("takes its whole width when the screen has room for it", () => {
    expect(bannerSpan(1366, 472, 0, 280)).toEqual({ left: 447, right: 447 });
  });
});
