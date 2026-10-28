import { describe, expect, it } from "vitest";

import { GRID_GAP, gridCardWidth, gridOffset } from "./pool-grid.ts";

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
});
