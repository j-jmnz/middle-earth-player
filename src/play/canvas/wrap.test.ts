import { describe, expect, it } from "vitest";

import { MIN_NAME_SCALE, nameScale, wrapName } from "./wrap.ts";

// One unit per character: a line of width 10 holds ten characters.
const measure = (text: string) => text.length;

describe("card names on the canvas", () => {
  it("wrap by word into lines that fit", () => {
    expect(wrapName("Gondorian Spearman", 10, measure)).toEqual(["Gondorian", "Spearman"]);
    expect(wrapName("Sam Gamgee", 10, measure)).toEqual(["Sam Gamgee"]);
  });

  it("stop at three lines and end the last with an ellipsis", () => {
    const lines = wrapName("Celebrimbor's Secret of the Elven Smiths", 10, measure);
    expect(lines).toHaveLength(3);
    expect(lines[2]?.endsWith("…")).toBe(true);
    for (const line of lines) expect(measure(line)).toBeLessThanOrEqual(10);
  });

  it("cut a word longer than the line", () => {
    expect(wrapName("Mablung-and-Damrod", 8, measure)).toEqual(["Mablung…"]);
  });
});

describe("a name that does not fit shrinks before it is cut", () => {
  it("keeps full size when its widest part fits", () => {
    expect(nameScale("Sam Gamgee", 10, measure)).toBe(1);
    expect(nameScale("Poros Garrison", 14, measure, 1)).toBe(1);
  });

  it("shrinks a single word to fit, and a one-line name as a whole", () => {
    expect(nameScale("Garrison", 6, measure)).toBe(0.75);
    expect(nameScale("Poros Garrison", 12, measure, 1)).toBeCloseTo(12 / 14);
  });

  it("never goes under the minimum, so the rest is cut with an ellipsis at the widened width", () => {
    const scale = nameScale("Mablung-and-Damrod", 8, measure);
    expect(scale).toBe(MIN_NAME_SCALE);
    expect(wrapName("Mablung-and-Damrod", 8 / scale, measure)[0]?.endsWith("…")).toBe(true);
  });
});
