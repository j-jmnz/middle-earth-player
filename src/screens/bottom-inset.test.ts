import { describe, expect, it } from "vitest";

import { bottomInset } from "./bottom-inset.ts";

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
