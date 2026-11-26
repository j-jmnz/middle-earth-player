// Rules: rr.in-play-and-out-of-play (data/rules/entries.json); ledger line 17027:B:2 (a stage that cannot be defeated holds progress past its quest points).
// The strip at a stage card's foot says its progress and its quest points. Progress past the points shows the whole count in the strip, and the card wears no progress token (progressInStrip).
import { describe, expect, it } from "vitest";

import { progressInStrip, stripCenterX, stripText } from "./table-canvas-views.ts";
import type { CardSlot } from "../layout/layout.ts";

const slot = (progress: number) => ({ progress }) as CardSlot;

describe("stripText", () => {
  it("says the progress and the quest points, and a progress past the points in full", () => {
    expect(stripText(slot(3), 12)).toBe("3 / 12");
    expect(stripText(slot(12), 12)).toBe("12 / 12");
    expect(stripText(slot(404), 12)).toBe("404 / 12");
    expect(stripText(slot(404), 12, "P2")).toBe("P2 · 404 / 12");
  });

  it("keeps the words of a stage that loses and says nothing without quest points", () => {
    expect(stripText(slot(5), 8, null, true)).toBe("5 / 8 · lose");
    expect(stripText(slot(5), null)).toBeNull();
  });
});

describe("progressInStrip", () => {
  it("08123:B:4 progress past the quest points is told in the strip, so the card wears no progress token", () => {
    expect(progressInStrip(20, 12)).toBe(true);
    expect(progressInStrip(12, 12)).toBe(false);
    expect(progressInStrip(3, 12)).toBe(false);
    expect(progressInStrip(3, null)).toBe(false);
  });
});

describe("stripCenterX", () => {
  // A location 46 wide with a count 24 wide: the resource token (time counters, 08157:A:1) stands bottom left, 19 wide with its edge.
  it("08157:A:1 moves the count right of the resource token a location wears, so the token never covers the digit", () => {
    expect(stripCenterX(0, 46, 12, null, false, 18, 1)).toBe(23);
    expect(stripCenterX(0, 46, 12, null, true, 18, 1)).toBe(33);
  });

  it("a wide card keeps the count in the middle, and the progress token still wins on a narrow one", () => {
    expect(stripCenterX(0, 120, 12, null, true, 18, 1)).toBe(60);
    expect(stripCenterX(0, 46, 12, 28, true, 18, 1)).toBe(14);
  });
});
