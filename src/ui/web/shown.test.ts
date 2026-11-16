// Whether an element is on screen (shown.ts): what checkVisibility says, and shown where the browser lacks it.
import { describe, expect, it } from "vitest";

import { shown } from "./shown.ts";

describe("shown", () => {
  it("follows checkVisibility, and counts an element as shown without it", () => {
    expect(shown({ checkVisibility: () => false })).toBe(false);
    expect(shown({ checkVisibility: () => true })).toBe(true);
    expect(shown({})).toBe(true);
  });
});
