// The rows the command column's empty top covers (column-reach.ts): the count changes only when the dock and head cross a row's foot.
import { describe, expect, it } from "vitest";

import { dockWithNumbers, headPlan, headRoom, NUMBERS_ROW } from "../readouts/command-head.ts";
import { columnReach, coveredTop, rowFeet } from "./column-reach.ts";

const feet = { staging: 120, engaged: 240 };
const column = { height: 400, foot: 8, dock: 100, margin: 8, top: 0 };

describe("columnReach", () => {
  it("counts the rows wholly above the dock, the head and the margin", () => {
    // 400 - 8 - 100 - 8 = 284 free: both rows.
    expect(columnReach(column, feet)).toBe(2);
    expect(columnReach({ ...column, dock: 144 }, feet)).toBe(2);
    expect(columnReach({ ...column, dock: 145 }, feet)).toBe(1);
    expect(columnReach({ ...column, dock: 264 }, feet)).toBe(1);
    expect(columnReach({ ...column, dock: 265 }, feet)).toBe(0);
  });

  it("stays put while the dock moves by a few points inside a row", () => {
    const counts = [150, 152, 158, 170, 190].map((dock) => columnReach({ ...column, dock }, feet));
    expect(new Set(counts)).toEqual(new Set([1]));
  });

  it("counts the peek pill's room above the canvas against the rows", () => {
    expect(columnReach({ ...column, top: 45 }, feet)).toBe(1);
  });

  it("is 0 before the column, the dock or the rows are measured", () => {
    expect(columnReach({ ...column, height: 0 }, feet)).toBe(0);
    expect(columnReach({ ...column, dock: 0 }, feet)).toBe(0);
    expect(columnReach(column, null)).toBe(0);
  });
});

describe("rowFeet", () => {
  it("is each row's foot, its deepest peek included", () => {
    const zones = { staging: { x: 0, y: 10, w: 100, h: 80 }, engaged: { x: 0, y: 100, w: 100, h: 90 } };
    const slot = (zone: string, y: number, h: number) => ({ zone, y, h }) as never;
    expect(rowFeet({ zones: zones as never, slots: [slot("staging", 10, 80), slot("staging", 20, 80), slot("engaged", 100, 80), slot("play", 300, 80)] })).toEqual({ staging: 100, engaged: 190 });
  });
});

describe("coveredTop and the head", () => {
  const column = { height: 400, foot: 8, dock: 100, margin: 8, top: 0 };

  it("is where the covered rows end, margin included, and 0 with none", () => {
    expect(coveredTop(column, feet, 0)).toBe(0);
    expect(coveredTop(column, feet, 1)).toBe(128);
    expect(coveredTop(column, feet, 2)).toBe(248);
    expect(coveredTop({ ...column, top: 45 }, feet, 1)).toBe(173);
    expect(coveredTop(column, null, 2)).toBe(0);
  });

  it("gives the head only the room under the covered rows", () => {
    const room = (dock: number) => headRoom(400, 8, dock, 4, coveredTop(column, feet, columnReach({ ...column, dock }, feet)));
    // Reach 2 at dock 100: 400 - 8 - 100 - 4 - 248 = 40 under the engagement row, too little for the meter.
    expect(room(100)).toBe(40);
    expect(headPlan(room(100))).toBe("hidden");
    // Reach 1 at dock 150: 400 - 8 - 150 - 4 - 128 = 110, the full meter; at dock 200, 60, the compact one.
    expect(headPlan(room(150))).toBe("full");
    expect(headPlan(room(200))).toBe("compact");
    // Reach 0 (dock 270): no row is covered, the head has what the dock leaves (here nothing).
    expect(room(270)).toBe(118);
    expect(headPlan(room(270))).toBe("full");
  });

  it("keeps the reach while the meter comes and goes", () => {
    // The meter takes the dock's numbers row, so the dock measures shorter; planned against the dock with that row, the reach is the same in both states.
    for (const measured of [150, 180, 220]) {
      const without = columnReach({ ...column, dock: dockWithNumbers(measured, NUMBERS_ROW, false) }, feet);
      const withMeter = columnReach({ ...column, dock: dockWithNumbers(measured - NUMBERS_ROW, NUMBERS_ROW, true) }, feet);
      expect(withMeter, `${measured}`).toBe(without);
    }
  });
});
