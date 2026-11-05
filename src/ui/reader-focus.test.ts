// When a screen reader's focus follows the table's moment: it moves when the key changed, stays put (but the moment is still announced) while
// the reader is on a card the new moment asks about, and does nothing while the key is the same.
import { describe, expect, it } from "vitest";

import { focusPlan } from "./reader-focus.ts";

describe("the focus plan", () => {
  it("moves focus when the key changed", () => {
    expect(focusPlan("defense:1", "defense:2", false)).toBe("focus");
  });

  it("only announces when the key changed and the reader is on a card the new moment still asks about", () => {
    expect(focusPlan("commit", "defense:1", true)).toBe("announce");
  });

  it("does nothing while the key is the same, held or not", () => {
    expect(focusPlan("commit", "commit", false)).toBe("none");
    expect(focusPlan("commit", "commit", true)).toBe("none");
  });
});
