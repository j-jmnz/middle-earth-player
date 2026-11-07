// Rules: none (the banner's timing is the app's own, docs/design-system-table.md, Banner).
import { describe, expect, it } from "vitest";

import { paceScale } from "../../ui/motion-tokens.ts";
import { bannerBeatMs, HOLD_MS, momentHoldMs, summaryHoldMs } from "./banner-time.ts";

describe("the banner's timing", () => {
  it("keeps 650 ms beats and a 4.5 s hold at Normal and Quick, and 1.5 times both at Slow", () => {
    expect(paceScale("normal")).toBe(1);
    expect(paceScale("quick")).toBe(1);
    expect(paceScale("slow")).toBe(1.5);
    expect(bannerBeatMs("normal")).toBe(650);
    expect(bannerBeatMs("quick")).toBe(650);
    expect(bannerBeatMs("slow")).toBe(975);
    expect(HOLD_MS).toBe(4500);
    expect(momentHoldMs("normal", "timer", 3)).toBe(4500 + 3 * 650);
    expect(momentHoldMs("quick", "timer", 3)).toBe(4500 + 3 * 650);
    expect(momentHoldMs("slow", "timer", 3)).toBe(Math.round((4500 + 3 * 650) * 1.5));
    expect(summaryHoldMs("normal", "timer")).toBe(4500);
    expect(summaryHoldMs("slow", "timer")).toBe(6750);
  });

  it("never closes by itself when tapped is chosen, the round summary included", () => {
    for (const speed of ["normal", "quick", "slow"] as const) {
      expect(momentHoldMs(speed, "tap", 4)).toBeNull();
      expect(summaryHoldMs(speed, "tap")).toBeNull();
    }
  });
});
