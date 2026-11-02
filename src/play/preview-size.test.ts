import { describe, expect, it } from "vitest";

import { inspectSize, previewSideSize, previewSize, STRIP_GAP, STRIP_ITEM_W, stripGrid, fitInRoom } from "./preview-size.ts";

describe("the long-press preview", () => {
  it("fills a phone's width with a portrait card and leaves room for the buttons", () => {
    const size = previewSize(390, 760, false);
    expect(size.width).toBe(342);
    expect(size.height).toBeLessThanOrEqual(760 - 140);
    expect(size.width / size.height).toBeCloseTo(0.705, 2);
  });

  it("is bounded by the height on a short screen and on a tablet by a reading size", () => {
    expect(previewSize(800, 400, false).height).toBeLessThanOrEqual(260);
    expect(previewSize(1024, 1366, false).width).toBe(440);
  });

  it("lays a quest card on its side", () => {
    const size = previewSize(390, 760, true);
    expect(size.width).toBeGreaterThan(size.height);
    expect(size.width).toBeLessThanOrEqual(358);
  });

  it("on a landscape table, stands the card at the left as tall as the screen and leaves the right for its effects", () => {
    const size = previewSideSize(844, 390, false);
    expect(size.height).toBe(390 - 32);
    expect(size.width).toBeLessThan(844 * 0.55);
    expect(size.width / size.height).toBeCloseTo(0.705, 2);
    expect(previewSideSize(844, 390, true).width).toBeGreaterThan(previewSideSize(844, 390, true).height);
  });
});

describe("the Card screen's picture", () => {
  it("is sized by the pane's height and keeps the card's shape", () => {
    const size = inspectSize(600, 500);
    expect(size.height).toBe(468);
    expect(size.width / size.height).toBeCloseTo(0.705, 2);
  });

  it("is capped at 420 points wide on a roomy pane", () => {
    expect(inspectSize(700, 900).width).toBe(420);
  });

  it("is bounded by a narrow pane's width", () => {
    expect(inspectSize(300, 900).width).toBe(268);
  });

  it("scales the room and the card together", () => {
    const base = inspectSize(700, 900);
    const large = inspectSize(700 * 1.15, 900 * 1.15, 1.15);
    expect(large.width).toBe(Math.round(base.width * 1.15));
    expect(large.height).toBe(Math.round(base.height * 1.15));
  });
});

describe("the upright preview's strip of other cards (user request, 2026-11-02)", () => {
  it("never runs wider than its room, and shares the items evenly among the fewest rows", () => {
    for (const s of [0.875, 1, 1.15]) {
      for (const room of [288, 328, 358, 600]) {
        for (let count = 2; count <= 12; count += 1) {
          const grid = stripGrid(count, room, s);
          expect(grid.width, `${s} ${room} ${count}`).toBeLessThanOrEqual(room + 1e-9);
          expect(grid.perRow * grid.rows).toBeGreaterThanOrEqual(count);
          // No row could be dropped: one fewer row would not hold them at the most a row fits.
          const most = Math.floor((room + STRIP_GAP * s) / ((STRIP_ITEM_W + STRIP_GAP) * s));
          if (grid.rows > 1) expect(most * (grid.rows - 1)).toBeLessThan(count);
        }
      }
    }
    // Six stages' sides on a 390 pt phone: two rows of three, not five and one.
    expect(stripGrid(6, 358, 1)).toMatchObject({ perRow: 3, rows: 2 });
    expect(stripGrid(2, 358, 1)).toMatchObject({ perRow: 2, rows: 1 });
  });
});

describe("fitInRoom", () => {
  it("leaves a card that fits, and shrinks one that does not to the room, keeping its shape", () => {
    expect(fitInRoom({ width: 358, height: 252 }, 400)).toEqual({ width: 358, height: 252 });
    const shrunk = fitInRoom({ width: 358, height: 252 }, 126);
    expect(shrunk).toEqual({ width: 179, height: 126 });
    expect(fitInRoom({ width: 100, height: 140 }, -10)).toEqual({ width: 0, height: 0 });
  });
});
