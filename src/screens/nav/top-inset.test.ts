import { describe, expect, it } from "vitest";

import { TOP_ROOM, topInsetOf } from "./top-inset.ts";

describe("top inset with the status bar hidden", () => {
  it("keeps a notch's or a cutout's inset", () => {
    expect(topInsetOf(59, 1)).toBe(59);
  });

  it("keeps TOP_ROOM at the UI scale when the screen reports no inset", () => {
    expect(topInsetOf(0, 1)).toBe(TOP_ROOM);
    expect(topInsetOf(0, 1.25)).toBe(TOP_ROOM * 1.25);
  });
});
