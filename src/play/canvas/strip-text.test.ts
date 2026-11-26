// Rules: rr.in-play-and-out-of-play (data/rules/entries.json); ledger line 17027:B:2 (a stage that cannot be defeated holds progress past its quest points).
// The strip at a stage card's foot says its progress and its quest points; the progress token beside it holds the number in full.
import { describe, expect, it } from "vitest";

import { stripText } from "./table-canvas-views.ts";
import type { CardSlot } from "../layout/layout.ts";

const slot = (progress: number) => ({ progress }) as CardSlot;

describe("stripText", () => {
  it("says the progress and the quest points, and caps a progress past the points so the token's number stays the one read in full", () => {
    expect(stripText(slot(3), 12)).toBe("3 / 12");
    expect(stripText(slot(12), 12)).toBe("12 / 12");
    expect(stripText(slot(404), 12)).toBe("12+ / 12");
    expect(stripText(slot(404), 12, "P2")).toBe("P2 · 12+ / 12");
  });

  it("keeps the words of a stage that loses and says nothing without quest points", () => {
    expect(stripText(slot(5), 8, null, true)).toBe("5 / 8 · lose");
    expect(stripText(slot(5), null)).toBeNull();
  });
});
