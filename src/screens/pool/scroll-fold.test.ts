import { describe, expect, it } from "vitest";

import { FOLD_QUIET, FOLD_SLOP, OPEN_FOLD, foldOnScroll, type FoldScroll } from "./scroll-fold";

const ROOM = 120;

// Feeds offsets one after another, each `step` ms after the last, from `start`.
function run(offsets: number[], start: FoldScroll = OPEN_FOLD, step = 16, from = 1000): FoldScroll {
  let state = start;
  offsets.forEach((y, i) => {
    state = foldOnScroll(state, y, from + i * step, ROOM);
  });
  return state;
}

describe("the pool's filters fold on scroll", () => {
  it("fold once the list scrolls down past the filters", () => {
    expect(run([0, 40, 80, 130, 150]).folded).toBe(true);
  });

  it("stay open while the list is still within the filters' height", () => {
    expect(run([0, 30, 60, 100]).folded).toBe(false);
  });

  it("stay open through a small wobble", () => {
    expect(run([200, 200 + FOLD_SLOP - 1, 200], { ...OPEN_FOLD, anchor: 200 }).folded).toBe(false);
  });

  it("fold on a slow scroll made of many small steps", () => {
    expect(run(Array.from({ length: 200 }, (_, i) => i)).folded).toBe(true);
  });

  it("show again when the list scrolls up", () => {
    const folded = run([0, 100, 200, 300], OPEN_FOLD, 200);
    expect(folded.folded).toBe(true);
    expect(run([290, 280, 260], folded, 200, 2000).folded).toBe(false);
  });

  it("show again at the top, even inside the quiet time", () => {
    const folded = foldOnScroll({ ...OPEN_FOLD, anchor: 100 }, 300, 1000, ROOM);
    expect(folded.folded).toBe(true);
    expect(foldOnScroll(folded, 0, 1001, ROOM).folded).toBe(false);
  });

  it("keep the fold while the list moves its offset after the fold", () => {
    const folded = foldOnScroll({ ...OPEN_FOLD, anchor: 900 }, 1000, 1000, ROOM);
    // Near the foot the taller list moves the offset up by the filters' height.
    const clamped = foldOnScroll(folded, 1000 - ROOM, 1000 + FOLD_QUIET / 2, ROOM);
    expect(clamped.folded).toBe(true);
    expect(foldOnScroll(clamped, 1000 - ROOM, 1000 + FOLD_QUIET * 2, ROOM).folded).toBe(true);
  });
});
