import { describe, expect, it } from "vitest";

import { equalSplit, seedWidth, sideSplit } from "./split-columns";

const RANGE = { min: 360, max: 440 };

describe("sideSplit", () => {
  it("is null until the width is measured", () => {
    expect(sideSplit(0, 1, RANGE)).toBeNull();
  });
  it("keeps one column when the main column would starve (about 704 points)", () => {
    expect(sideSplit(704, 1, RANGE)).toBeNull();
  });
  it("splits a wide window with a side in range and a main of at least 400", () => {
    const panes = sideSplit(1040, 1, RANGE);
    expect(panes).not.toBeNull();
    expect(panes!.side).toBeGreaterThanOrEqual(360);
    expect(panes!.side).toBeLessThanOrEqual(440);
    expect(panes!.main).toBeGreaterThanOrEqual(400);
    expect(panes!.side + panes!.gap + panes!.main).toBe(1040);
  });
  it("scales the threshold", () => {
    expect(sideSplit(1040, 1.15, RANGE)?.main).toBeGreaterThanOrEqual(460);
    expect(sideSplit(840, 1.15, RANGE)).toBeNull();
  });
});

describe("equalSplit", () => {
  it("needs 360 a column", () => {
    expect(equalSplit(0, 1)).toBeNull();
    expect(equalSplit(704, 1)).toBeNull();
    expect(equalSplit(744, 1)).toEqual({ column: 360, gap: 24 });
    expect(equalSplit(1040, 1)?.column).toBe(508);
  });
});

describe("seedWidth", () => {
  it("is 0 in compact and the window less the page inset otherwise", () => {
    expect(seedWidth("compact", 390, 1, 24)).toBe(0);
    expect(seedWidth("medium", 834, 1, 24)).toBe(786);
    expect(seedWidth("expanded", 1194, 1, 0)).toBe(1194);
  });
});
