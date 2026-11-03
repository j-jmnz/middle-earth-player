import { describe, expect, it } from "vitest";

import { HEAD_COMPACT, HEAD_FULL, headPlan, headRoom, METER_FULL_LEAST, VICTORY_HEADER, VICTORY_ROW } from "./command-head.ts";

describe("headPlan", () => {
  it("hides under 70 pt, is compact to 150 pt and full from there", () => {
    expect(headPlan(HEAD_COMPACT - 1, 2).mode).toBe("hidden");
    expect(headPlan(HEAD_COMPACT, 2).mode).toBe("compact");
    expect(headPlan(HEAD_FULL - 1, 2).mode).toBe("compact");
    expect(headPlan(HEAD_FULL, 2).mode).toBe("full");
  });

  it("scales the thresholds with the UI scale", () => {
    expect(headPlan(HEAD_COMPACT * 1.15 - 1, 0, 1.15).mode).toBe("hidden");
    expect(headPlan(HEAD_FULL * 1.15, 0, 1.15).mode).toBe("full");
  });

  it("takes one victory line when compact, and a line for an empty display", () => {
    expect(headPlan(100, 5)).toMatchObject({ rows: 0, strip: VICTORY_HEADER });
    expect(headPlan(300, 0)).toMatchObject({ rows: 0, strip: VICTORY_HEADER });
  });

  it("gives the names what the meter leaves, at most three lines, then '+n more'", () => {
    expect(headPlan(300, 2)).toMatchObject({ rows: 2, more: 0, strip: VICTORY_HEADER + 2 * VICTORY_ROW });
    expect(headPlan(300, 7)).toMatchObject({ rows: 2, more: 5, moreLine: true, strip: VICTORY_HEADER + 3 * VICTORY_ROW });
    // 150 pt: one line fits, so the name carries "+n more" itself.
    const tight = headPlan(HEAD_FULL, 4);
    expect(tight).toMatchObject({ rows: 1, more: 3, moreLine: false, strip: VICTORY_HEADER + VICTORY_ROW });
    expect(HEAD_FULL - tight.strip).toBeGreaterThanOrEqual(METER_FULL_LEAST - VICTORY_ROW);
  });
});

describe("headRoom", () => {
  it("is the column less the foot, the dock and the gap, never negative", () => {
    expect(headRoom(300, 8, 150, 4)).toBe(138);
    expect(headRoom(100, 8, 150, 4)).toBe(0);
  });
});
