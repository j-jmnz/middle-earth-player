import { describe, expect, it } from "vitest";

import { moveChoices, moveItem, nearestSlot, shiftsFor, type SlotRect } from "./order.ts";

const column: SlotRect[] = [
  { x: 0, y: 0, width: 100, height: 50 },
  { x: 0, y: 50, width: 100, height: 70 },
  { x: 0, y: 120, width: 100, height: 50 },
];
const grid: SlotRect[] = [
  { x: 0, y: 0, width: 100, height: 100 },
  { x: 100, y: 0, width: 100, height: 100 },
  { x: 0, y: 100, width: 100, height: 100 },
  { x: 100, y: 100, width: 100, height: 100 },
];

describe("moveItem", () => {
  it("moves a deck later and earlier without touching the input", () => {
    const ids = ["a", "b", "c", "d"];
    expect(moveItem(ids, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(ids, 3, 1)).toEqual(["a", "d", "b", "c"]);
    expect(ids).toEqual(["a", "b", "c", "d"]);
  });

  it("clamps the target and keeps the order when nothing moves", () => {
    expect(moveItem(["a", "b", "c"], 0, 9)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, -4)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });
});

describe("nearestSlot", () => {
  it("picks the slot by row and column", () => {
    expect(nearestSlot(grid, 150, 20)).toBe(1);
    expect(nearestSlot(grid, 30, 180)).toBe(2);
    expect(nearestSlot(grid, 500, 500)).toBe(3);
    expect(nearestSlot(grid, -40, -40)).toBe(0);
  });
});

describe("shiftsFor", () => {
  it("packs one column under the held deck, whatever the heights", () => {
    const shifts = shiftsFor(column, 0, 2);
    // Order becomes 1, 2, 0: deck 1 at the top, deck 2 under it, deck 0 last.
    expect(shifts[1]).toEqual({ x: 0, y: -50 });
    expect(shifts[2]).toEqual({ x: 0, y: -50 });
    expect(shifts[0]).toEqual({ x: 0, y: 170 - 50 });
  });

  it("moves nothing when the deck is held over its own slot", () => {
    expect(shiftsFor(column, 1, 1)).toEqual([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]);
  });

  it("sends a grid's decks to the neighbouring slot, across rows", () => {
    const shifts = shiftsFor(grid, 3, 1);
    // Order becomes 0, 3, 1, 2.
    expect(shifts[0]).toEqual({ x: 0, y: 0 });
    expect(shifts[3]).toEqual({ x: 0, y: -100 });
    expect(shifts[1]).toEqual({ x: -100, y: 100 });
    expect(shifts[2]).toEqual({ x: 100, y: 0 });
  });
});

describe("moveChoices", () => {
  it("offers each direction that has room", () => {
    expect(moveChoices(0, 3)).toEqual({ up: false, down: true });
    expect(moveChoices(1, 3)).toEqual({ up: true, down: true });
    expect(moveChoices(2, 3)).toEqual({ up: true, down: false });
  });
  it("offers nothing for one deck or a deck not in the list", () => {
    expect(moveChoices(0, 1)).toEqual({ up: false, down: false });
    expect(moveChoices(-1, 3)).toEqual({ up: false, down: false });
  });
});
