import { describe, expect, it } from "vitest";

import { poolCardWords, usedOnceWords } from "./log-facts.ts";

const nameOf = (code: string) => ({ "41044": "The Fervor of Lore", "41045": "The Might of Tactics", "41050": "The Oath" })[code] ?? code;

describe("usedOnceWords", () => {
  it("names each card used once, one to a line, and a card listed twice once (41044:A:3)", () => {
    expect(usedOnceWords(["41044", "41045", "41044"], nameOf)).toBe("The Fervor of Lore\nThe Might of Tactics");
    expect(usedOnceWords([], nameOf)).toBe("");
  });
});

describe("poolCardWords", () => {
  it("marks a pool card whose once-per-campaign Action is used, and only that one (41044:A:3)", () => {
    expect(poolCardWords({ code: "41044", attachedTo: "02116" }, ["41044"], nameOf)).toBe(`${nameOf("41044")} on ${nameOf("02116")} · used`);
    expect(poolCardWords({ code: "41044" }, [], nameOf)).toBe(nameOf("41044"));
    expect(poolCardWords({ code: "41045" }, ["41044"], nameOf)).toBe(nameOf("41045"));
  });
});
