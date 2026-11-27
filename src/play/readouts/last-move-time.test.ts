import { describe, expect, it } from "vitest";

import { heldLine, lookHoldMs } from "./last-move-time.ts";

const moment = (title: string) => ({ title, tone: "plain" as const, lines: [] });

describe("heldLine", () => {
  it("keeps the line across the moments that have none, replaces it with a new one, and drops it on an Undo", () => {
    const first = heldLine(null, { seq: 4, undone: false, lean: moment("Sam Gamgee is destroyed") });
    expect(first).toEqual({ seq: 4, move: moment("Sam Gamgee is destroyed") });
    // A window the table passed for the player made a step the table shows: the line stays.
    expect(heldLine(first, { seq: 5, undone: false, lean: null })).toBe(first);
    expect(heldLine(first, { seq: 6, undone: false, lean: moment("Quest failed") })).toEqual({ seq: 6, move: moment("Quest failed") });
    expect(heldLine(first, { seq: 7, undone: true, lean: null })).toBeNull();
    expect(heldLine(null, { seq: 8, undone: false, lean: null })).toBeNull();
  });
});

describe("lookHoldMs", () => {
  it("is 4.5 s, and half as long again at Slow", () => {
    expect(lookHoldMs("normal")).toBe(4500);
    expect(lookHoldMs("quick")).toBe(4500);
    expect(lookHoldMs("slow")).toBe(6750);
  });
});
