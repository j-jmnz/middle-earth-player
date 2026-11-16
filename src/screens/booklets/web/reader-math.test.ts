import { describe, expect, it } from "vitest";

import { clampPage, clampZoom, fitScale, keyAction, pixelScale, PIXEL_BUDGET, stepWheel, wheelIdle, wheelPixels, WHEEL_LOCK_MS, WHEEL_THRESHOLD, zoomAfterWheel, ZOOM_MAX, ZOOM_MIN } from "./reader-math";

const none = { ctrl: false, meta: false, alt: false, shift: false };

describe("pages and zoom", () => {
  it("keeps a page inside the book", () => {
    expect(clampPage(0, 10)).toBe(1);
    expect(clampPage(11, 10)).toBe(10);
    expect(clampPage(4.7, 10)).toBe(4);
    expect(clampPage(Number.NaN, 10)).toBe(1);
    expect(clampPage(3, 0)).toBe(1);
  });

  it("fits a whole page to the window", () => {
    expect(fitScale(800, 1000, 400, 500)).toBe(2);
    expect(fitScale(800, 600, 400, 500)).toBeCloseTo(1.2);
    expect(fitScale(800, 600, 0, 500)).toBe(1);
  });

  it("zooms in on a roll up, out on a roll down, within the limits", () => {
    expect(zoomAfterWheel(1, -100)).toBeGreaterThan(1);
    expect(zoomAfterWheel(2, 100)).toBeLessThan(2);
    expect(zoomAfterWheel(1, 400)).toBe(ZOOM_MIN);
    expect(zoomAfterWheel(3.9, -400)).toBe(ZOOM_MAX);
    expect(clampZoom(9)).toBe(ZOOM_MAX);
  });

  it("reads a wheel in lines and pages as pixels", () => {
    expect(wheelPixels(100, 0)).toBe(100);
    expect(wheelPixels(3, 1)).toBe(48);
    expect(wheelPixels(1, 2)).toBe(400);
  });
});

describe("keys", () => {
  it("pages with the arrows, Page keys, Home, End and Space", () => {
    expect(keyAction("PageDown", none)).toBe("next");
    expect(keyAction("ArrowRight", none)).toBe("next");
    expect(keyAction(" ", none)).toBe("next");
    expect(keyAction(" ", { ...none, shift: true })).toBe("previous");
    expect(keyAction("PageUp", none)).toBe("previous");
    expect(keyAction("ArrowLeft", none)).toBe("previous");
    expect(keyAction("Home", none)).toBe("first");
    expect(keyAction("End", none)).toBe("last");
  });

  it("zooms with plus, minus and zero, and leaves scrolling and the browser's shortcuts alone", () => {
    expect(keyAction("+", none)).toBe("zoomIn");
    expect(keyAction("-", none)).toBe("zoomOut");
    expect(keyAction("0", none)).toBe("zoomReset");
    expect(keyAction("ArrowDown", none)).toBeNull();
    expect(keyAction("Tab", none)).toBeNull();
    expect(keyAction("PageDown", { ...none, ctrl: true })).toBeNull();
    expect(keyAction("=", { ...none, meta: true })).toBeNull();
  });
});

describe("the wheel turns a page after a deliberate roll", () => {
  it("adds small deltas up to the threshold, then turns once and locks", () => {
    let state = wheelIdle;
    let at = 1000;
    let turns = 0;
    for (let index = 0; index < 20; index += 1) {
      const step = stepWheel(state, 10, at);
      state = step.state;
      turns += step.turn;
      at += 16;
    }
    expect(turns).toBe(1);
    expect(WHEEL_THRESHOLD).toBeGreaterThan(10);
  });

  it("turns again after the lock, in the other direction when the roll reverses", () => {
    const first = stepWheel(wheelIdle, WHEEL_THRESHOLD, 1000);
    expect(first.turn).toBe(1);
    expect(stepWheel(first.state, WHEEL_THRESHOLD, 1000 + WHEEL_LOCK_MS - 1).turn).toBe(0);
    expect(stepWheel(first.state, -WHEEL_THRESHOLD, 1000 + WHEEL_LOCK_MS + 1).turn).toBe(-1);
  });

  it("forgets a roll that stopped", () => {
    const half = stepWheel(wheelIdle, WHEEL_THRESHOLD - 10, 1000);
    expect(half.turn).toBe(0);
    expect(stepWheel(half.state, WHEEL_THRESHOLD - 10, 2000).turn).toBe(0);
  });
});

describe("pixelScale", () => {
  it("draws at the screen's resolution while the canvas stays small", () => {
    expect(pixelScale(600, 800, 1, 2)).toBe(2);
    expect(pixelScale(600, 800, 1, 0.5)).toBe(1);
  });

  it("lowers the resolution of a canvas past the budget", () => {
    const scale = pixelScale(600, 800, 8, 2);
    expect(600 * 800 * scale * scale).toBeLessThanOrEqual(PIXEL_BUDGET * 1.001);
    expect(scale).toBeLessThan(16);
  });
});
