import { describe, expect, it } from "vitest";

import { GRID_GAP, gridCardWidth, gridOffset, poolColumns, recyclePool } from "./pool-grid.ts";

describe("pool grid", () => {
  it("lays the cards inside FlashList's equal columns, with equal gaps and none past the edge", () => {
    for (const [width, columns] of [
      [342, 3],
      [312, 3],
      [342, 2],
      [552, 3],
    ] as const) {
      const card = gridCardWidth(width, columns);
      const column = width / columns;
      const lefts = Array.from({ length: columns }, (_, index) => index * column + gridOffset(index, columns));
      for (let index = 1; index < columns; index += 1) expect(Math.abs(lefts[index] - (lefts[index - 1] + card) - GRID_GAP)).toBeLessThan(1.5);
      expect(lefts[columns - 1] + card).toBeLessThanOrEqual(width);
    }
  });

  it("lays out in logical points at another scale, so the cards still fill the list with equal gaps", () => {
    for (const scale of [0.875, 1.15]) {
      for (const [width, columns] of [
        [342, 3],
        [312, 3],
        [342, 2],
      ] as const) {
        const card = gridCardWidth(width, columns, scale);
        const column = width / columns;
        const gap = GRID_GAP * scale;
        const lefts = Array.from({ length: columns }, (_, index) => index * column + gridOffset(index, columns, scale));
        for (let index = 1; index < columns; index += 1) expect(Math.abs(lefts[index] - (lefts[index - 1] + card) - gap)).toBeLessThan(1.5 * scale + 0.01);
        expect(lefts[columns - 1] + card).toBeLessThanOrEqual(width);
        // A card is the same share of the list as the logical layout gives, times the scale.
        expect(card).toBeCloseTo(gridCardWidth(width / scale, columns) * scale, 6);
      }
    }
  });

  it("changes nothing at the default scale", () => {
    expect(gridCardWidth(342, 3, 1)).toBe(gridCardWidth(342, 3));
    expect(gridOffset(2, 3, 1)).toBe(gridOffset(2, 3));
  });

  it("gives every phone exactly 3 columns to browse and 2 to add, at any scale", () => {
    // A phone's list is its width less the 24 point page insets: 312 (a 360 pt phone) to 392 (a 440 pt one).
    for (const scale of [0.875, 1, 1.15]) {
      for (const width of [312, 342, 358, 382, 392]) {
        expect(poolColumns(width, false, scale)).toBe(3);
        expect(poolColumns(width, true, scale)).toBe(2);
      }
    }
  });

  it("fits more columns on a tablet's list", () => {
    expect(poolColumns(1000, false)).toBeGreaterThanOrEqual(8);
    expect(poolColumns(1000, true)).toBe(5);
    expect(poolColumns(700, false)).toBe(6);
    expect(poolColumns(560, true)).toBe(3);
    expect(poolColumns(1000, false, 1.15)).toBeLessThan(poolColumns(1000, false));
  });

  it("keeps the phone's recycle pool and grows it with the cells in view", () => {
    expect(recyclePool(3, 700, 190)).toBe(24);
    expect(recyclePool(2, 700, 300)).toBe(24);
    expect(recyclePool(9, 800, 150)).toBe(9 * (6 + 2));
    expect(recyclePool(3, 700, 0)).toBe(24);
  });
});
