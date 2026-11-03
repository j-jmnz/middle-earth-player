import { describe, expect, it } from "vitest";

import { twoHanded } from "../store/seat-fixture.ts";
import { createTableStore } from "../store/store.ts";
import { UpdateLog } from "./update-log.ts";

// Which update of the store moved a layout (phase 26): each is used once, by the first layout after it.
const { state, ctx } = twoHanded();

function logged() {
  const store = createTableStore({ ctx, game: state });
  const log = new UpdateLog(store.getState().game);
  store.subscribe((now, before) => log.note(now, before));
  return { store, log };
}

describe("UpdateLog", () => {
  it("has nothing pending before anything moves, and nothing for a change of neither the game nor the seat peeked at", () => {
    const { store, log } = logged();
    expect(log.pending()).toBeNull();
    store.getState().select(null);
    store.getState().clearRefusal();
    expect(log.pending()).toBeNull();
  });

  it("is the same state for a peek, so a peek pops nothing", () => {
    const { store, log } = logged();
    store.getState().peek(1);
    const peek = log.pending();
    expect(peek?.prev).toBe(state);
    expect(peek?.next).toBe(state);
  });

  it("is the pair of states a dispatch moved between, and is used once", () => {
    const { store, log } = logged();
    store.getState().dispatch({ type: "Pass" });
    const update = log.pending();
    expect(update?.prev).toBe(state);
    expect(update?.next).toBe(store.getState().game);
    expect(update?.prev).not.toBe(update?.next);
    log.consume();
    expect(log.pending()).toBeNull();
  });

  it("gives a later peek its own pair, never the stale change of a state a layout did not use", () => {
    const { store, log } = logged();
    // A state arrives that no layout uses (a change that only touched the other seat's counts), then the player peeks.
    store.getState().dispatch({ type: "Pass" });
    const moved = store.getState().game;
    store.getState().peek(0);
    const update = log.pending();
    expect(update?.prev).toBe(moved);
    expect(update?.next).toBe(moved);
  });

  it("is the state pair, with the seat peeked at reset, when a dispatch ends a peek", () => {
    const { store, log } = logged();
    store.getState().peek(1);
    log.consume();
    store.getState().dispatch({ type: "Pass" });
    const update = log.pending();
    expect(update?.prev).toBe(state);
    expect(update?.next).not.toBe(state);
    expect(store.getState().viewedSeat).toBeNull();
  });
});
