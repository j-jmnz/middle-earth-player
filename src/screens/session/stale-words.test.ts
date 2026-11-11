import { describe, expect, it } from "vitest";

import { changeLines, restartAsk, restartNote } from "./stale-words";

describe("changeLines", () => {
  it("shows up to three lines and counts the rest", () => {
    expect(changeLines(undefined)).toEqual([]);
    expect(changeLines(["a.", "b.", "c."])).toEqual(["a.", "b.", "c."]);
    expect(changeLines(["a.", "b.", "c.", "d."])).toEqual(["a.", "b.", "c.", "and 1 more change."]);
    expect(changeLines(["a.", "b.", "c.", "d.", "e."])).toEqual(["a.", "b.", "c.", "and 2 more changes."]);
  });
});

describe("Restart's words", () => {
  it("names what the moves lost and what is kept, for a campaign game and a standalone one", () => {
    expect(restartAsk(39, false)).toBe("Restart throws away the 39 moves of this game and deals it again. Your log and decks are kept.");
    expect(restartAsk(1, true)).toBe("Restart throws away the 1 move of this game and deals it again. Your decks are kept.");
    expect(restartAsk(0, false)).toBe("Restart deals this game again. Your log and decks are kept.");
    expect(restartNote(true)).not.toContain("log");
    expect(restartNote(false)).toContain("Your log and decks are kept.");
  });
});
