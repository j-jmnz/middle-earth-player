// The rows the command column's empty top covers (column-reach.ts): the count changes only when the dock and head cross a row's foot.
import { describe, expect, it } from "vitest";

import { columnReach, rowFeet } from "./column-reach.ts";

const feet = { staging: 120, engaged: 240 };
const column = { height: 400, foot: 8, dock: 100, head: 0, margin: 8, top: 0 };

describe("columnReach", () => {
  it("counts the rows wholly above the dock, the head and the margin", () => {
    // 400 - 8 - 100 - 8 = 284 free: both rows.
    expect(columnReach(column, feet)).toBe(2);
    expect(columnReach({ ...column, dock: 144 }, feet)).toBe(2);
    expect(columnReach({ ...column, dock: 145 }, feet)).toBe(1);
    expect(columnReach({ ...column, dock: 100, head: 60 }, feet)).toBe(1);
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
