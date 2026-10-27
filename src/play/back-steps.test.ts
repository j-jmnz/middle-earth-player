import { afterEach, describe, expect, it, vi } from "vitest";

import { playLayers, runBackStep } from "./back-steps.ts";
import { onScrubCancel, scrubMoved, scrubOpen } from "./scrub-open.ts";
import { twoHanded } from "./seat-fixture.ts";
import { createTableStore } from "./store.ts";

// The Back steps the play layer carries out itself, in the order back.ts picks them: spotlight, scrub, peek.
const { state, ctx } = twoHanded();

afterEach(() => {
  onScrubCancel(null);
  scrubMoved(-1, false);
});

describe("runBackStep", () => {
  it("ends a peek, cancels a scrub and skips a spotlight, and leaves every other step to the screen", () => {
    const store = createTableStore({ ctx, game: state });
    store.getState().peek(1);
    expect(runBackStep("closeMenu", store)).toBe(false);
    expect(runBackStep("leave", store)).toBe(false);
    expect(store.getState().viewedSeat).toBe(1);
    expect(runBackStep("endPeek", store)).toBe(true);
    expect(store.getState().viewedSeat).toBeNull();
    const cancel = vi.fn();
    onScrubCancel(cancel);
    expect(runBackStep("cancelScrub", store)).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(runBackStep("skipSpotlight", store)).toBe(true);
  });
});

describe("playLayers", () => {
  it("reports a peek, a scrub and a spotlight as they are", () => {
    const store = createTableStore({ ctx, game: state });
    expect(playLayers(store)).toEqual({ spotlightOpen: false, scrubOpen: false, peekOpen: false });
    store.getState().peek(1);
    scrubMoved(0, true, true);
    expect(scrubOpen()).toBe(true);
    expect(playLayers(store)).toEqual({ spotlightOpen: false, scrubOpen: true, peekOpen: true });
  });
});
