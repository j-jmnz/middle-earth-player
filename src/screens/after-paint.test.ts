import { describe, expect, it } from "vitest";

import { needsOpen, valueFor } from "./after-paint.ts";

describe("opened after paint", () => {
  it("opens a key that is not held, and only that key", () => {
    expect(needsOpen(null, "a")).toBe(true);
    expect(needsOpen({ key: "a", value: 1 }, "b")).toBe(true);
    expect(needsOpen({ key: "a", value: 1 }, null)).toBe(false);
  });

  it("keeps the value of a key already open, so a screen shown again keeps its session", () => {
    const held = { key: "a", value: { store: 1 } };
    expect(needsOpen(held, "a")).toBe(false);
    expect(valueFor(held, "a")).toBe(held.value);
  });

  it("never gives the value of one key for another", () => {
    expect(valueFor({ key: "a", value: 1 }, "b")).toBeNull();
    expect(valueFor({ key: "a", value: 1 }, null)).toBeNull();
    expect(valueFor(null, "a")).toBeNull();
  });
});
