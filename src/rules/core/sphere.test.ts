import { describe, expect, it } from "vitest";

import { spherePays } from "./printed.ts";

describe("spherePays", () => {
  it("lets a Fellowship pool pay Fellowship and neutral costs only", () => {
    expect(spherePays("fellowship", "fellowship")).toBe(true);
    expect(spherePays("fellowship", "neutral")).toBe(true);
    expect(spherePays("fellowship", null)).toBe(true);
    for (const cost of ["leadership", "tactics", "spirit", "lore", "baggins"] as const) {
      expect(spherePays("fellowship", cost), cost).toBe(false);
    }
  });

  it("keeps the Baggins pool apart from Fellowship", () => {
    expect(spherePays("baggins", "baggins")).toBe(true);
    expect(spherePays("baggins", "neutral")).toBe(true);
    expect(spherePays("baggins", "fellowship")).toBe(false);
    expect(spherePays("leadership", "fellowship")).toBe(false);
  });
});
