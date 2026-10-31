import { describe, expect, it } from "vitest";

import { kindMoves, motionKind } from "./motion-kind.ts";

// Which motion a new layout plays when the seat drawn changed (phase 26). The states are only compared by identity.
const before = { name: "before" };
const after = { name: "after" };

describe("motionKind", () => {
  it("is a peek when the same state is drawn from another seat, and when the peek ends", () => {
    // Peeking at seat 1 while seat 0 acts, then back.
    expect(motionKind(before, before, 0, 1, 0, 0)).toBe("peek");
    expect(motionKind(before, before, 1, 0, 0, 0)).toBe("peek");
  });

  it("is the seat handoff when a new state turns the engine to another seat and the table follows it", () => {
    expect(motionKind(before, after, 0, 1, 0, 1)).toBe("handoff");
    expect(motionKind(before, after, 1, 0, 1, 0)).toBe("handoff");
  });

  it("is the state's own motions when a new state ends a peek: a pick, a peek, then Confirm on the dock", () => {
    // Seat 1 was drawn while seat 0 acted; the dock sent an intent that left seat 0 acting. The card played from the hand must lift and land.
    expect(motionKind(before, after, 1, 0, 0, 0)).toBe("ordinary");
  });

  it("is the state's own motions when the seat drawn did not change, whoever acts now", () => {
    expect(motionKind(before, after, 0, 0, 0, 0)).toBe("ordinary");
    expect(motionKind(before, before, 0, 0, 0, 0)).toBe("ordinary");
    // Peeking at seat 1, the engine turns to seat 1: that hand is on screen already, so the state plays its own motions.
    expect(motionKind(before, after, 1, 1, 0, 1)).toBe("ordinary");
    // A pass that moves the acting seat while the table stays on the seat it showed.
    expect(motionKind(before, after, 0, 0, 0, 1)).toBe("ordinary");
  });

  it("calls a new state that draws a seat that is not the acting one a peek batched with it", () => {
    expect(motionKind(before, after, 0, 1, 0, 0)).toBe("peek");
  });
});

describe("kindMoves", () => {
  it("draws a peek, its way back and a seat handoff at rest, and moves the cards of a new state", () => {
    expect(kindMoves("peek")).toBe(false);
    expect(kindMoves("handoff")).toBe(false);
    expect(kindMoves("ordinary")).toBe(true);
  });
});
