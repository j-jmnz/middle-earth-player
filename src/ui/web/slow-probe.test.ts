// The slow-state probe (src/ui/web/slow-probe.ts): when it runs, and what a run writes.
import { describe, expect, it } from "vitest";

import { PROBES, runProbes, slowState } from "./slow-probe.ts";

describe("slowState", () => {
  it("is three seconds in a row under seven tenths of the best rate", () => {
    expect(slowState([60, 30, 30, 30], 60)).toBe(true);
    expect(slowState([30, 30, 45], 60)).toBe(false);
    expect(slowState([30, 30], 60)).toBe(false);
    expect(slowState([70, 70, 70], 120)).toBe(true);
  });
});

describe("runProbes", () => {
  const host = (rate: (css: string | null, cured: boolean) => number, cure: string | null) => {
    let css: string | null = null;
    let cured = false;
    const applied: (string | null)[] = [];
    return {
      applied,
      rate: () => Promise.resolve(rate(css, cured)),
      wait: () => Promise.resolve(),
      style: (next: string | null) => {
        if (css !== null && cure !== null && css.startsWith(cure)) cured = true;
        css = next;
        applied.push(next);
      },
    };
  };
  it("writes each probe's rate with its CSS and after it, from the probe the run starts with", async () => {
    const page = host((css) => (css?.startsWith("canvas") ? 59.6 : 24.2), null);
    expect(await runProbes(page, 5, 42)).toBe("base 24, img 24>24, all 24>24, paused 24>24, tiles 24>24, blend 24>24, mask 24>24, canvas 60>24");
    expect(page.applied.filter((entry) => entry !== null)).toHaveLength(PROBES.length);
    expect(page.applied.at(-1)).toBeNull();
  });
  it("stops at the probe after which the page is fast again", async () => {
    const page = host((_css, cured) => (cured ? 60 : 24), "[data-probe-a]");
    expect(await runProbes(page, 0, 42)).toBe("base 24, paused 24>24, tiles 24>60");
  });
});
