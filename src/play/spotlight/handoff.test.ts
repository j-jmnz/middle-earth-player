// The store the table canvas hands the combat spotlight's layer (spotlight/handoff.ts).
import { describe, expect, it, vi } from "vitest";

import { createHandoff } from "./handoff.ts";

describe("the spotlight handoff", () => {
  it("starts idle: no plan, no clock, nothing playing", () => {
    const state = createHandoff().getState();
    expect(state.plan).toBeNull();
    expect(state.progress).toBeNull();
    expect(state.playing).toBe(false);
    expect(state.k).toBe(1);
    expect(state.tableImages.size).toBe(0);
  });

  it("tells a subscriber when the canvas publishes, and each screen has its own", () => {
    const handoff = createHandoff();
    const heard = vi.fn();
    handoff.subscribe(heard);
    handoff.setState({ playing: true, k: 0.6 });
    expect(heard).toHaveBeenCalledTimes(1);
    expect(handoff.getState()).toMatchObject({ playing: true, k: 0.6 });
    expect(createHandoff().getState().playing).toBe(false);
  });
});
