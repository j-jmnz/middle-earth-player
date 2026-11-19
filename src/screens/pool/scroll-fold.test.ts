import { describe, expect, it } from "vitest";

import { FOLD_SLOP, OPEN_FOLD, foldOnScroll, openAt, type FoldScroll } from "./scroll-fold";

const ROOM = 120;
const END = 5000;

// Feeds offsets one after another, with the list able to scroll to `end`.
function run(offsets: number[], start: FoldScroll = OPEN_FOLD, end = END): FoldScroll {
  return offsets.reduce((state, y) => foldOnScroll(state, y, end, ROOM), start);
}

describe("the pool's filters fold on scroll", () => {
  it("fold once the list scrolls down past the filters", () => {
    expect(run([0, 40, 80, 130, 150]).folded).toBe(true);
  });

  it("stay open while the list is still within the filters' height", () => {
    expect(run([0, 30, 60, 100]).folded).toBe(false);
  });

  it("stay open through a small wobble", () => {
    expect(run([200, 200 + FOLD_SLOP - 1, 200], openAt(200)).folded).toBe(false);
  });

  it("fold on a slow scroll made of many small steps", () => {
    expect(run(Array.from({ length: 200 }, (_, i) => i)).folded).toBe(true);
  });

  it("show again when the list scrolls up", () => {
    const folded = run([0, 100, 200, 300]);
    expect(folded.folded).toBe(true);
    expect(run([290, 280, 260], folded).folded).toBe(false);
  });

  it("show again on a quick scroll up right after a fold", () => {
    const folded = run([0, 300]);
    expect(run([300 - FOLD_SLOP - 1], folded).folded).toBe(false);
  });

  it("show again at the top", () => {
    expect(run([0, 300, 0]).folded).toBe(false);
  });

  it("keep the fold while the list pulls its offset back to its new end", () => {
    const folded = run([4800, 5000], openAt(4800));
    expect(folded.folded).toBe(true);
    // The fold makes the list taller by the filters' height: its end, and the offset with it, move up by that much.
    const pulled = foldOnScroll(folded, END - ROOM, END - ROOM, ROOM);
    expect(pulled.folded).toBe(true);
    // The next scroll up from there still shows them.
    expect(foldOnScroll(pulled, END - ROOM - FOLD_SLOP - 1, END - ROOM, ROOM).folded).toBe(false);
  });

  it("keep the fold through iOS's bounce at the foot", () => {
    const folded = run([4800, 5000], openAt(4800));
    expect(run([5040, 5080, 5040, 5000], folded).folded).toBe(true);
  });

  it("keep the filters open on a scroll up after the list changes in the middle", () => {
    expect(run([480, 460, 440], openAt(500)).folded).toBe(false);
  });
});
