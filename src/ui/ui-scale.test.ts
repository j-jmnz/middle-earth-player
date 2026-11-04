import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, UI_SCALE_OPTIONS } from "./table-settings.ts";
import { scaled, touch, touchSlop, uiFactor, UI_SCALES } from "./ui-scale.ts";

describe("ui scale", () => {
  it("has a factor for every option, Medium being 1", () => {
    expect(Object.keys(UI_SCALES)).toEqual([...UI_SCALE_OPTIONS]);
    expect(uiFactor("small")).toBe(0.875);
    expect(uiFactor("medium")).toBe(1);
    expect(uiFactor("large")).toBe(1.15);
    expect(uiFactor(DEFAULT_SETTINGS.uiScale)).toBe(1);
  });

  it("multiplies a size", () => {
    expect(scaled(1, 24)).toBe(24);
    expect(scaled(0.875, 24)).toBe(21);
    expect(scaled(1.15, 20)).toBeCloseTo(23);
  });

  it("keeps a hit target at 44 or more", () => {
    expect(touch(0.875, 44)).toBe(44);
    expect(touch(1, 44)).toBe(44);
    expect(touch(1.15, 44)).toBeCloseTo(50.6);
    expect(touch(0.875, 56)).toBe(49);
    expect(touch(0.875, 40)).toBe(44);
  });

  it("gives the slop that brings a visible size to a 44 pt target", () => {
    expect(touchSlop(1, 36)).toBe(4);
    expect(touchSlop(0.875, 31.5)).toBe(6.25);
    expect(touchSlop(1, 44)).toBe(0);
    expect(touchSlop(1.15, 40)).toBeCloseTo(5.3);
    expect(touchSlop(1.15, 60)).toBe(0);
  });
});
