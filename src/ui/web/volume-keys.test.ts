// The volume row's keys on the web and the desktop (volume-keys.ts).
import { describe, expect, it } from "vitest";

import { volumeKey } from "./volume-keys.ts";

describe("volume keys", () => {
  it("steps 5% on the arrows, 10% on Page Up and Page Down, and never past either end", () => {
    expect(volumeKey("ArrowRight", 0.8)).toBeCloseTo(0.85);
    expect(volumeKey("ArrowDown", 0.8)).toBeCloseTo(0.75);
    expect(volumeKey("PageUp", 0.8)).toBeCloseTo(0.9);
    expect(volumeKey("PageDown", 0.05)).toBe(0);
    expect(volumeKey("ArrowUp", 1)).toBe(1);
  });

  it("goes to either end on Home and End, and leaves other keys to the page", () => {
    expect(volumeKey("Home", 0.5)).toBe(0);
    expect(volumeKey("End", 0.5)).toBe(1);
    expect(volumeKey("Tab", 0.5)).toBeNull();
    expect(volumeKey(" ", 0.5)).toBeNull();
  });
});
