import { describe, expect, it } from "vitest";

import { changeLines } from "./stale-words";

describe("changeLines", () => {
  it("shows up to three lines and counts the rest", () => {
    expect(changeLines(undefined)).toEqual([]);
    expect(changeLines(["a.", "b.", "c."])).toEqual(["a.", "b.", "c."]);
    expect(changeLines(["a.", "b.", "c.", "d."])).toEqual(["a.", "b.", "c.", "and 1 more change."]);
    expect(changeLines(["a.", "b.", "c.", "d.", "e."])).toEqual(["a.", "b.", "c.", "and 2 more changes."]);
  });
});
