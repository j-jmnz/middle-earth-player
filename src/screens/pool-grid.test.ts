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
});
