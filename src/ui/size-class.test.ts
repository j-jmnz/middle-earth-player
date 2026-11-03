import { describe, expect, it } from "vitest";

import { EXPANDED_MIN, MEDIUM_MIN, READABLE, WIDE, capWidth, columnsFor, gutter, isShortWindow, isTabletScreen, paneWidths, showsRail, sizeClass } from "./size-class.ts";

describe("size class", () => {
  it("tells a tablet by its shorter side", () => {
    expect(isTabletScreen(390, 844)).toBe(false);
    expect(isTabletScreen(844, 390)).toBe(false);
    expect(isTabletScreen(744, 1133)).toBe(true);
    expect(isTabletScreen(834, 1194)).toBe(true);
    expect(isTabletScreen(600, 960)).toBe(true);
    expect(isTabletScreen(599, 960)).toBe(false);
  });

  it("classes the device windows", () => {
    expect(sizeClass(390)).toBe("compact");
    expect(sizeClass(844)).toBe("expanded");
    expect(sizeClass(744)).toBe("medium");
    expect(sizeClass(1133)).toBe("expanded");
    expect(sizeClass(834)).toBe("medium");
    expect(sizeClass(1194)).toBe("expanded");
    expect(sizeClass(600)).toBe("medium");
    expect(sizeClass(960)).toBe("expanded");
  });

  it("changes class exactly at the thresholds", () => {
    expect(sizeClass(MEDIUM_MIN - 1)).toBe("compact");
    expect(sizeClass(MEDIUM_MIN)).toBe("medium");
    expect(sizeClass(EXPANDED_MIN - 1)).toBe("medium");
    expect(sizeClass(EXPANDED_MIN)).toBe("expanded");
  });

  it("measures in logical points at another scale", () => {
    expect(sizeClass(834, 1.15)).toBe("medium");
    expect(sizeClass(1194, 1.15)).toBe("expanded");
    expect(sizeClass(1194, 0.875)).toBe("expanded");
    expect(sizeClass(744, 0.875)).toBe("expanded");
    expect(sizeClass(390, 0.875)).toBe("compact");
    expect(sizeClass(430, 0.875)).toBe("compact");
  });

  it("calls a phone on its side short and a tablet not", () => {
    expect(isShortWindow(390)).toBe(true);
    expect(isShortWindow(844)).toBe(false);
    expect(isShortWindow(834)).toBe(false);
    expect(isShortWindow(744)).toBe(false);
    expect(isShortWindow(390, 1.15)).toBe(true);
    expect(isShortWindow(540, 1.15)).toBe(true);
    expect(isShortWindow(560, 1.15)).toBe(false);
  });

  it("shows the rail only when expanded", () => {
    expect(showsRail("compact")).toBe(false);
    expect(showsRail("medium")).toBe(false);
    expect(showsRail("expanded")).toBe(true);
  });

  it("caps a column outside compact, scaled", () => {
    expect(capWidth("compact", "readable")).toBeNull();
    expect(capWidth("medium", "readable")).toBe(READABLE);
    expect(capWidth("expanded", "wide")).toBe(WIDE);
    expect(capWidth("medium", "readable", 1.15)).toBeCloseTo(READABLE * 1.15, 6);
  });

  it("centres a capped column with a gutter, and none in compact", () => {
    expect(gutter(390, "compact", "readable")).toBe(0);
    expect(gutter(834, "medium", "readable")).toBe(97);
    expect(gutter(500, "medium", "readable")).toBe(0);
    expect(gutter(1194, "expanded", "wide")).toBe(77);
  });

  it("splits the width into a side pane held to its range and a main pane", () => {
    for (const kind of ["list-detail", "supporting"] as const) {
      for (const width of [840, 1000, 1100, 1366]) {
        const { side, main, gap } = paneWidths(kind, width);
        expect(gap).toBe(24);
        expect(side + gap + main).toBeLessThanOrEqual(width);
        expect(side + gap + main).toBeGreaterThanOrEqual(width - 1);
        expect(side).toBeGreaterThanOrEqual(320);
        expect(side).toBeLessThanOrEqual(kind === "list-detail" ? 400 : 480);
      }
    }
    expect(paneWidths("list-detail", 1366).side).toBe(400);
    expect(paneWidths("supporting", 1366).side).toBe(480);
    expect(paneWidths("list-detail", 840).side).toBe(320);
  });

  it("takes another range for a screen that asks", () => {
    expect(paneWidths("list-detail", 1366, 1, { min: 360, max: 440 }).side).toBe(440);
    expect(paneWidths("list-detail", 840, 1, { min: 360, max: 440 }).side).toBe(360);
    expect(paneWidths("supporting", 1000, 1, { min: 360, max: 440 }).side).toBe(360);
  });

  it("floors the side so the panes and the gap fit a fractional width", () => {
    const { side, main, gap } = paneWidths("supporting", 901, 1.15);
    expect(Number.isInteger(side)).toBe(true);
    expect(Number.isInteger(main)).toBe(true);
    expect(side + gap + main).toBeLessThanOrEqual(901);
    expect(side + gap + main).toBeGreaterThan(901 - 2);
  });

  it("never lets the side pane pass the room when the room is under the minimum", () => {
    const { side, main, gap } = paneWidths("list-detail", 330);
    expect(side).toBe(306);
    expect(main).toBe(0);
    expect(side + gap + main).toBeLessThanOrEqual(330);
    expect(paneWidths("list-detail", 10).side).toBe(0);
  });

  it("scales the panes' range and gap", () => {
    const { side, gap } = paneWidths("list-detail", 1400, 1.15);
    expect(side).toBe(Math.floor(400 * 1.15));
    expect(gap).toBeCloseTo(24 * 1.15, 6);
  });

  it("counts columns that fit, never under the minimum", () => {
    expect(columnsFor(342, 107, 10, 1, 3)).toBe(3);
    expect(columnsFor(100, 107, 10, 1, 3)).toBe(3);
    expect(columnsFor(1000, 166, 10)).toBe(5);
    expect(columnsFor(1000, 166, 10, 1.15)).toBe(4);
    expect(columnsFor(50, 300, 12)).toBe(1);
  });
});
