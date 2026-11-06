import { describe, expect, it } from "vitest";

import { dockWithNumbers, HEAD_COMPACT, headHeight, headPlan, headRoom, METER_FULL_LEAST, METER_MOST, NUMBERS_ROW } from "./command-head.ts";

describe("headPlan", () => {
  it("gives way by height: the full meter, then the compact one, then nothing", () => {
    expect(headPlan(HEAD_COMPACT - 1)).toBe("hidden");
    expect(headPlan(HEAD_COMPACT)).toBe("compact");
    expect(headPlan(METER_FULL_LEAST - 1)).toBe("compact");
    expect(headPlan(METER_FULL_LEAST)).toBe("full");
  });

  it("scales its thresholds with the UI scale", () => {
    expect(headPlan(HEAD_COMPACT * 1.15 - 1, 1.15)).toBe("hidden");
    expect(headPlan(METER_FULL_LEAST * 1.15 - 1, 1.15)).toBe("compact");
    expect(headPlan(METER_FULL_LEAST * 1.15, 1.15)).toBe("full");
  });

  it("draws nothing outside the Quest phase, whatever the room", () => {
    expect(headPlan(400, 1, false)).toBe("hidden");
  });
});

describe("headRoom", () => {
  it("is the column less the foot, the dock and the gap, never negative", () => {
    expect(headRoom(300, 8, 150, 4, 0)).toBe(138);
    expect(headRoom(100, 8, 150, 4, 0)).toBe(0);
    // Less what a covered row holds at the column's top.
    expect(headRoom(300, 8, 150, 4, 100)).toBe(38);
  });
});

describe("dockWithNumbers", () => {
  it("gives one dock height whether or not the meter has taken the numbers row", () => {
    const tall = 180;
    // Planned against it, the head's verdict is the same with the row (meter off) and without it (meter on).
    const verdict = (measured: number, dropped: boolean) => headPlan(headRoom(400, 8, dockWithNumbers(measured, NUMBERS_ROW, dropped), 4, 0));
    for (const column of [300, 340, 360, 400]) {
      const planned = (measured: number, dropped: boolean) => headRoom(column, 8, dockWithNumbers(measured, NUMBERS_ROW, dropped), 4, 0);
      expect(planned(tall, false)).toBe(planned(tall - NUMBERS_ROW, true));
    }
    expect(verdict(tall, false)).toBe(verdict(tall - NUMBERS_ROW, true));
  });
});

describe("headHeight", () => {
  it("is the full meter up to its tallest with its padding, the compact meter's whole room, and nothing hidden", () => {
    expect(headHeight("full", 400)).toBe(METER_MOST + 2);
    expect(headHeight("full", 150)).toBe(152);
    expect(headHeight("compact", 70)).toBe(70);
    expect(headHeight("hidden", 400)).toBe(0);
  });
});
