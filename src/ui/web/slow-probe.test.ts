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
  it("counts the frames as the page is, with each thing taken away, and as the page is again", async () => {
    let css: string | null = null;
    const applied: (string | null)[] = [];
    const line = await runProbes({
      rate: () => Promise.resolve(css?.startsWith("canvas") ? 59.6 : 24.2),
      wait: () => Promise.resolve(),
      style: (next) => {
        css = next;
        applied.push(next);
      },
    });
    expect(line).toBe("base 24, paused 24, fog 24, canvas 60, img 24, all 24, base 24");
    expect(applied.filter((entry) => entry !== null)).toEqual(PROBES.map(([, rule]) => rule));
    expect(applied.at(-1)).toBeNull();
  });
});
