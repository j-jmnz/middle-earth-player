// The window's remembered place (desktop/bounds.ts), checked against the displays as they are now.
import { describe, expect, it } from "vitest";

import { DEFAULT_SIZE, restoreWindowState } from "./bounds.ts";

const screen = { x: 0, y: 0, width: 1920, height: 1080 };
const second = { x: 1920, y: 0, width: 1280, height: 1024 };

describe("restoreWindowState", () => {
  it("opens at the default size for no file or a file that is not an object", () => {
    for (const saved of [null, undefined, 3, "x", []]) expect(restoreWindowState(saved, [screen])).toEqual({ ...DEFAULT_SIZE, maximized: false });
  });

  it("keeps a saved size and place on a display", () => {
    expect(restoreWindowState({ x: 100, y: 50, width: 1000, height: 700, maximized: true }, [screen])).toEqual({ x: 100, y: 50, width: 1000, height: 700, maximized: true });
  });

  it("keeps a place on a second display, and drops it when that display is gone", () => {
    const saved = { x: 2000, y: 10, width: 900, height: 600 };
    expect(restoreWindowState(saved, [screen, second])).toMatchObject({ x: 2000, y: 10 });
    const alone = restoreWindowState(saved, [screen]);
    expect(alone).toEqual({ width: 900, height: 600, maximized: false });
  });

  it("drops a place with less than 100 px on any display", () => {
    expect(restoreWindowState({ x: 1880, y: 0, width: 900, height: 600 }, [screen]).x).toBeUndefined();
    expect(restoreWindowState({ x: -850, y: 0, width: 900, height: 600 }, [screen]).x).toBeUndefined();
    expect(restoreWindowState({ x: 1000, y: 1000, width: 900, height: 600 }, [screen]).x).toBeUndefined();
  });

  it("holds the size between the window minimum and the largest display", () => {
    expect(restoreWindowState({ width: 100, height: 100 }, [screen])).toMatchObject({ width: 844, height: 390 });
    expect(restoreWindowState({ width: 9000, height: 9000 }, [screen])).toMatchObject({ width: 1920, height: 1080 });
  });

  it("ignores values that are not finite numbers", () => {
    expect(restoreWindowState({ x: "1", y: NaN, width: Infinity, height: "tall", maximized: "yes" }, [screen])).toEqual({ ...DEFAULT_SIZE, maximized: false });
  });
});
