import { describe, expect, it } from "vitest";

import { coverColumns, coverWidth } from "./briefing-layout";

describe("the briefing's seat covers", () => {
  it("shows one cover a row until the pane is 600 wide", () => {
    expect(coverColumns(500)).toBe(1);
    expect(coverColumns(575)).toBe(1);
    expect(coverColumns(576)).toBe(2);
    expect(coverColumns(716)).toBe(2);
  });

  it("measures the pane in logical points, so a larger UI scale needs more room", () => {
    expect(coverColumns(576, 1.15)).toBe(1);
    expect(coverColumns(576 * 1.15, 1.15)).toBe(2);
  });

  it("splits a row of two covers with a 12 point gap", () => {
    expect(coverWidth(500, 1)).toBe(500);
    expect(coverWidth(576, 2)).toBe(282);
    expect(coverWidth(576 * 1.15, 2, 1.15)).toBe(Math.floor((576 * 1.15 - 12 * 1.15) / 2));
  });
});
