import { describe, expect, it } from "vitest";

import { bottomInset, overrun } from "./bottom-inset.ts";

describe("the bottom inset a pinned bar keeps clear of", () => {
  it("keeps the phone's buttons' inset in portrait when the provider still reports the landscape table's 0", () => {
    const portrait = bottomInset(48, true, 0);
    expect(portrait.inset).toBe(48);
    expect(bottomInset(0, true, portrait.seen).inset).toBe(48);
  });

  it("takes the inset as it is in landscape", () => {
    expect(bottomInset(0, false, 48)).toEqual({ inset: 0, seen: 48 });
  });
});

describe("how far a pinned bar runs past the app's root view", () => {
  it("is the part below the root's bottom edge, and nothing when the bar ends inside it", () => {
    // The path's foot on a 891 pt phone, laid out 41 pt too tall (user screenshot, 2026-10-29).
    expect(overrun(932, 891)).toBe(41);
    expect(overrun(891, 891)).toBe(0);
    expect(overrun(850.4, 891)).toBe(0);
  });
});
