import { describe, expect, it } from "vitest";

import { dockWithNumbers, HEAD_COMPACT, HEAD_FULL, headFull, headPlan, headRoom, METER_FULL_LEAST, NUMBERS_ROW, STRIP_GAP, STRIP_LEAST, VICTORY_HEADER, VICTORY_ROW, victoryRow } from "./command-head.ts";

describe("headPlan", () => {
  it("hides under 70 pt, is compact until the header, one 44 pt name row, the gap and the meter fit, and full from there", () => {
    expect(headPlan(HEAD_COMPACT - 1, 2).mode).toBe("hidden");
    expect(headPlan(HEAD_COMPACT, 2).mode).toBe("compact");
    expect(headPlan(HEAD_FULL - 1, 2).mode).toBe("compact");
    expect(headPlan(HEAD_FULL, 2).mode).toBe("full");
  });

  it("scales the thresholds with the UI scale", () => {
    expect(headPlan(HEAD_COMPACT * 1.15 - 1, 0, 1.15).mode).toBe("hidden");
    expect(headPlan(headFull(1.15) - 1, 0, 1.15).mode).toBe("compact");
    expect(headPlan(headFull(1.15), 0, 1.15).mode).toBe("full");
  });

  it("keeps a name row a 44 pt target at the small scale, and grows it above Medium", () => {
    expect(victoryRow(0.875)).toBe(44);
    expect(victoryRow(1)).toBe(VICTORY_ROW);
    expect(victoryRow(1.15)).toBeCloseTo(VICTORY_ROW * 1.15);
    expect(headFull(0.875)).toBeCloseTo((VICTORY_HEADER + STRIP_GAP + METER_FULL_LEAST) * 0.875 + 44);
    expect(headPlan(headFull(0.875), 2, 0.875).strip).toBeCloseTo(VICTORY_HEADER * 0.875 + 44);
  });

  it("takes one victory line when compact, and a line for an empty display", () => {
    expect(headPlan(100, 5)).toMatchObject({ rows: 0, strip: VICTORY_HEADER });
    expect(headPlan(300, 0)).toMatchObject({ rows: 0, strip: VICTORY_HEADER });
  });

  it("gives the names what the meter leaves, at most three lines, then '+n more'", () => {
    expect(headPlan(300, 2)).toMatchObject({ rows: 2, more: 0, strip: VICTORY_HEADER + 2 * VICTORY_ROW });
    expect(headPlan(300, 7)).toMatchObject({ rows: 2, more: 5, moreLine: true, strip: VICTORY_HEADER + 3 * VICTORY_ROW });
    // The least full head: one line fits, so the name carries "+n more" itself.
    const tight = headPlan(HEAD_FULL, 4);
    expect(tight).toMatchObject({ rows: 1, more: 3, moreLine: false, strip: VICTORY_HEADER + VICTORY_ROW });
    expect(HEAD_FULL - tight.strip).toBeGreaterThanOrEqual(METER_FULL_LEAST + STRIP_GAP);
  });
});

describe("headPlan without the meter (outside the Quest phase)", () => {
  const off = (room: number, count: number, scale = 1) => headPlan(room, count, scale, false);

  it("hides under 30 pt, is header-only until a name row fits, then full", () => {
    expect(off(STRIP_LEAST - 1, 2).mode).toBe("hidden");
    expect(off(STRIP_LEAST, 2)).toMatchObject({ mode: "compact", rows: 0, strip: VICTORY_HEADER });
    expect(off(VICTORY_HEADER + VICTORY_ROW - 1, 2).mode).toBe("compact");
    expect(off(VICTORY_HEADER + VICTORY_ROW, 2)).toMatchObject({ mode: "full", rows: 2 - 1, more: 1, moreLine: false });
    expect(off(STRIP_LEAST * 1.15 - 1, 0, 1.15).mode).toBe("hidden");
  });

  it("keeps the room the meter would take, up to five name rows", () => {
    expect(off(HEAD_FULL, 3)).toMatchObject({ rows: 3, more: 0, strip: VICTORY_HEADER + 3 * VICTORY_ROW });
    expect(off(HEAD_FULL, 4)).toMatchObject({ rows: 2, more: 2, moreLine: true, strip: VICTORY_HEADER + 3 * VICTORY_ROW });
    expect(off(300, 9)).toMatchObject({ rows: 4, more: 5, moreLine: true, strip: VICTORY_HEADER + 5 * VICTORY_ROW });
    expect(off(300, 0)).toMatchObject({ mode: "full", rows: 0, strip: VICTORY_HEADER });
  });

  it("matches the meter plan's mode only by its own thresholds", () => {
    expect(headPlan(HEAD_COMPACT - 1, 2, 1, true).mode).toBe("hidden");
    expect(off(HEAD_COMPACT - 1, 2).mode).toBe("full");
  });
});

describe("headRoom", () => {
  it("is the column less the foot, the dock and the gap, never negative", () => {
    expect(headRoom(300, 8, 150, 4)).toBe(138);
    expect(headRoom(100, 8, 150, 4)).toBe(0);
  });
});

describe("dockWithNumbers", () => {
  it("gives one dock height whether or not the meter has taken the numbers row", () => {
    const tall = 180;
    // Planned against it, the head's verdict is the same with the row (meter off) and without it (meter on).
    const verdict = (measured: number, dropped: boolean) => headPlan(headRoom(400, 8, dockWithNumbers(measured, NUMBERS_ROW, dropped), 4), 0).mode;
    for (const column of [300, 340, 360, 400]) {
      const planned = (measured: number, dropped: boolean) => headRoom(column, 8, dockWithNumbers(measured, NUMBERS_ROW, dropped), 4);
      expect(planned(tall, false)).toBe(planned(tall - NUMBERS_ROW, true));
    }
    expect(verdict(tall, false)).toBe(verdict(tall - NUMBERS_ROW, true));
  });
});
