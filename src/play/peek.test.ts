import { afterEach, describe, expect, it, vi } from "vitest";

import { fixtureDefinition } from "../rules/fixture.ts";
import { blankScenario, withSeat } from "../rules/state.ts";

import { dialName, dialTap, NO_DRAG, NO_HIGHLIGHT, NO_TARGETS, peekSeat, peekWords, seatDial } from "./peek.ts";
import { onScrubCancel, scrubMoved, scrubOpen } from "./scrub-open.ts";
import { twoHanded } from "./seat-fixture.ts";
import { createTableStore } from "./store.ts";
import { peekTo } from "./use-peek.ts";

// The peek at the other seat (phase 26; docs/brief.md, Table): a view only. The acting seat, the intents and the save never change.
const { state, ctx } = twoHanded();
const solo = blankScenario({ seatCount: 1, seed: 1, definition: fixtureDefinition(["stage"]) });

describe("peekSeat", () => {
  it("is a seat other than the acting one, in a game of two", () => {
    expect(peekSeat(state, 1)).toBe(1);
    expect(peekSeat({ ...state, activeSeat: 1 }, 0)).toBe(0);
  });

  it("is null for no seat, the acting seat (the way back), a seat outside the game and any seat of a solo game", () => {
    expect(peekSeat(state, null)).toBeNull();
    expect(peekSeat(state, 0)).toBeNull();
    expect(peekSeat(state, 2)).toBeNull();
    expect(peekSeat(state, -1)).toBeNull();
    expect(peekSeat(solo, 0)).toBeNull();
    expect(peekSeat(solo, 1)).toBeNull();
  });
});

describe("a tap on a dial", () => {
  it("peeks at a seat that is not shown, and opens the panel of the seat that is", () => {
    expect(dialTap(state, null, 1)).toEqual({ kind: "peek", seat: 1 });
    expect(dialTap(state, null, 0)).toEqual({ kind: "panel" });
    // Peeking at seat 1: its dial is the one shown, so it opens its panel; the acting seat's dial is the way back.
    expect(dialTap(state, 1, 1)).toEqual({ kind: "panel" });
    expect(dialTap(state, 1, 0)).toEqual({ kind: "peek", seat: null });
  });

  it("always opens the panel in a solo game, which has one dial and no peek", () => {
    expect(dialTap(solo, null, 0)).toEqual({ kind: "panel" });
    expect(dialTap(solo, null, 1)).toEqual({ kind: "panel" });
  });
});

describe("the dials' roles and words", () => {
  it("names the acting seat and the seat viewed, and leaves a seat that is neither bare", () => {
    expect(seatDial(2, 0, null, 0).role).toBe("acting");
    expect(seatDial(2, 0, null, 1).role).toBeNull();
    expect(seatDial(2, 0, 1, 0).role).toBe("acting");
    expect(seatDial(2, 0, 1, 1).role).toBe("viewing");
    expect(seatDial(3, 0, 2, 1).role).toBeNull();
    expect(dialName("Player 1 threat", "acting")).toBe("Player 1 threat, acting");
    expect(dialName("Player 2 threat", "viewing")).toBe("Player 2 threat, viewing");
    expect(dialName("Player 2 threat", null)).toBe("Player 2 threat");
  });

  it("hints what a tap on a dial that is not shown does, and keeps the panel's hint on the one that is", () => {
    expect(seatDial(2, 0, null, 1).hint).toBe("Shows Player 2's cards");
    expect(seatDial(2, 0, 1, 0).hint).toBe("Shows Player 1's cards");
    expect(seatDial(2, 0, null, 0).hint).toBeNull();
    expect(seatDial(2, 0, 1, 1).hint).toBeNull();
  });

  it("gives a solo dial no role and no peek hint", () => {
    expect(seatDial(1, 0, null, 0)).toEqual({ role: null, hint: null });
  });
});

describe("the banner words", () => {
  it("say whose area this is and who is acting, with the way back", () => {
    expect(peekWords(state, 1)).toEqual({ text: "Viewing Player 2 · Player 1 is acting", back: "Back to Player 1" });
    expect(peekWords({ ...state, activeSeat: 1 }, 0)).toEqual({ text: "Viewing Player 1 · Player 2 is acting", back: "Back to Player 2" });
  });

  it("say an eliminated seat is out of the game", () => {
    const out = withSeat(state, 1, { ...state.seats[1], eliminated: true });
    expect(peekWords(out, 1)).toEqual({ text: "Player 2 is out of the game", back: "Back to Player 1" });
  });

  it("are none when the table shows the acting seat", () => {
    expect(peekWords(state, null)).toBeNull();
    expect(peekWords(state, 0)).toBeNull();
    expect(peekWords(solo, 1)).toBeNull();
  });
});

describe("while peeking the canvas marks nothing", () => {
  it("has no glow, no pick, no mark and no dim, nothing to drag and no drop target", () => {
    expect(NO_HIGHLIGHT.tappable.size + NO_HIGHLIGHT.picked.size + NO_HIGHLIGHT.marks.size + NO_HIGHLIGHT.muted.size).toBe(0);
    expect(NO_HIGHLIGHT.dimOthers).toBe(false);
    expect(NO_HIGHLIGHT.share).toBeNull();
    expect(NO_DRAG).toEqual([]);
    expect(NO_TARGETS).toEqual([]);
  });
});

describe("the table store's viewed seat", () => {
  it("is null when the table opens, and a peek sets only it", () => {
    const store = createTableStore({ ctx, game: state });
    expect(store.getState().viewedSeat).toBeNull();
    const before = store.getState().game;
    store.getState().peek(1);
    expect(store.getState().viewedSeat).toBe(1);
    // Nothing of the game moved, and nobody else's turn came.
    expect(store.getState().game).toBe(before);
    expect(store.getState().game.activeSeat).toBe(0);
    expect(store.getState().history).toHaveLength(0);
    store.getState().peek(null);
    expect(store.getState().viewedSeat).toBeNull();
  });

  it("takes no peek at the acting seat, a seat outside the game or in a solo game", () => {
    const store = createTableStore({ ctx, game: state });
    store.getState().peek(0);
    expect(store.getState().viewedSeat).toBeNull();
    store.getState().peek(2);
    expect(store.getState().viewedSeat).toBeNull();
    const alone = createTableStore({ ctx, game: solo });
    alone.getState().peek(1);
    expect(alone.getState().viewedSeat).toBeNull();
  });

  it("ends when Undo goes back to an earlier state (the next-state cases are in table-choice.test.ts)", () => {
    const store = createTableStore({ ctx, game: state });
    expect(store.getState().dispatch({ type: "Pass" })).toBe(true);
    store.getState().peek(0);
    expect(store.getState().viewedSeat).toBe(0);
    expect(store.getState().undo()).toBe(true);
    expect(store.getState().viewedSeat).toBeNull();
  });
});

describe("a peek while a hand scrub is open", () => {
  afterEach(() => {
    onScrubCancel(null);
    scrubMoved(-1, false);
  });

  it("cancels the scrub first, and nothing is sent", () => {
    const store = createTableStore({ ctx, game: state });
    const cancel = vi.fn();
    onScrubCancel(cancel);
    scrubMoved(0, true, true);
    expect(scrubOpen()).toBe(true);
    const before = store.getState().game;
    peekTo(store, 1);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(scrubOpen()).toBe(false);
    expect(store.getState().viewedSeat).toBe(1);
    expect(store.getState().game).toBe(before);
  });

  it("leaves a scrub alone when the shown seat does not change", () => {
    const store = createTableStore({ ctx, game: state });
    const cancel = vi.fn();
    onScrubCancel(cancel);
    scrubMoved(0, true, true);
    peekTo(store, 0);
    peekTo(store, null);
    expect(cancel).not.toHaveBeenCalled();
    expect(scrubOpen()).toBe(true);
  });

  it("is cancelled again when the peek ends while it is open", () => {
    const store = createTableStore({ ctx, game: state });
    store.getState().peek(1);
    const cancel = vi.fn();
    onScrubCancel(cancel);
    scrubMoved(1, true, true);
    peekTo(store, null);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(store.getState().viewedSeat).toBeNull();
  });
});
