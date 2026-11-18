import { afterEach, describe, expect, it } from "vitest";

import { groupKey, isRevealed, resetRevealed, reveal } from "./reveal";

afterEach(resetRevealed);

describe("the revealed groups", () => {
  it("remembers a group once shown, by kind and id", () => {
    const key = groupKey("set", "Core~Wilderlands");
    expect(isRevealed(key)).toBe(false);
    reveal(key);
    expect(isRevealed(key)).toBe(true);
    expect(isRevealed(groupKey("set", "Core~Other"))).toBe(false);
  });
});
