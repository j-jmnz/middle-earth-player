// The web focus ring's test (keyboard-focus.ts): drawn for a keyboard's focus, not a click's.
import { describe, expect, it } from "vitest";

import { keyboardFocus } from "./keyboard-focus.ts";

describe("keyboardFocus", () => {
  it("follows what the browser says about the focused element", () => {
    expect(keyboardFocus({ activeElement: { matches: (selector) => selector === ":focus-visible" } })).toBe(true);
    expect(keyboardFocus({ activeElement: { matches: () => false } })).toBe(false);
  });

  it("draws the ring when there is nothing to ask", () => {
    expect(keyboardFocus(undefined)).toBe(true);
    expect(keyboardFocus({ activeElement: null })).toBe(true);
  });
});
