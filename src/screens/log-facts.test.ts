import { describe, expect, it } from "vitest";

import { counterRows, usedOnceWords } from "./log-facts.ts";

const nameOf = (code: string) => ({ "41044": "The Fervor of Lore", "41045": "The Might of Tactics", "41050": "The Oath" })[code] ?? code;

describe("usedOnceWords", () => {
  it("names each card used once, one to a line, and a card listed twice once (41044:A:3)", () => {
    expect(usedOnceWords(["41044", "41045", "41044"], nameOf)).toBe("The Fervor of Lore\nThe Might of Tactics");
    expect(usedOnceWords([], nameOf)).toBe("");
  });
});

describe("counterRows", () => {
  it("says how many resource tokens the campaign card held when the scenario was won (41050:B:1)", () => {
    expect(counterRows({ "41050": 7 }, nameOf)).toEqual([{ code: "41050", label: "Tokens on The Oath", value: "7" }]);
    expect(counterRows({}, nameOf)).toEqual([]);
  });
});
