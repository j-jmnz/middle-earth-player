import { afterEach, describe, expect, it } from "vitest";

import { cancelScrub, onScrubCancel, scrubMoved, scrubOpen, setScrubOpen } from "./scrub-open.ts";

afterEach(() => {
  setScrubOpen(false);
  onScrubCancel(null);
});

describe("the open scrub", () => {
  it("is open from the canvas's word until it closes", () => {
    expect(scrubOpen()).toBe(false);
    setScrubOpen(true);
    expect(scrubOpen()).toBe(true);
    setScrubOpen(false);
    expect(scrubOpen()).toBe(false);
  });

  it("is cancelled by Back through the canvas's handler, and closed", () => {
    let calls = 0;
    onScrubCancel(() => (calls += 1));
    setScrubOpen(true);
    cancelScrub();
    expect(calls).toBe(1);
    expect(scrubOpen()).toBe(false);
  });

  it("cancels nothing without a canvas", () => {
    setScrubOpen(true);
    expect(() => cancelScrub()).not.toThrow();
  });
});

describe("the card under the finger", () => {
  it("ticks at the start and at each change of card, and opens and closes the scrub", () => {
    expect(scrubMoved(2, true)).toBe(true);
    expect(scrubOpen()).toBe(true);
    expect(scrubMoved(2, true)).toBe(false);
    expect(scrubMoved(3, true)).toBe(true);
    // Off the hand and back onto the card it left ticks again.
    expect(scrubMoved(-1, true)).toBe(false);
    expect(scrubMoved(3, true)).toBe(true);
    expect(scrubMoved(-1, false)).toBe(false);
    expect(scrubOpen()).toBe(false);
    // A new scrub on the same card ticks at its start.
    expect(scrubMoved(3, true)).toBe(true);
  });
});
