import { describe, expect, it } from "vitest";

import { carryWords } from "../../campaign/carry-words.ts";
import { carryLine, lineText, namesLine, poolCardLine } from "./log-facts.ts";

const nameOf = (code: string) => ({ "41044": "The Fervor of Lore", "41045": "The Might of Tactics", "41050": "The Oath" })[code] ?? code;
const codes = (line: ReturnType<typeof poolCardLine>) => line.filter((segment) => segment.code).map((segment) => segment.code);

describe("a pool card's line", () => {
  it("marks a pool card whose once-per-campaign Action is used, and only that one (41044:A:3)", () => {
    expect(lineText(poolCardLine({ code: "41044", attachedTo: "02116" }, ["41044"], nameOf))).toBe(`${nameOf("41044")} on ${nameOf("02116")} · used`);
    expect(lineText(poolCardLine({ code: "41044" }, [], nameOf))).toBe(nameOf("41044"));
    expect(lineText(poolCardLine({ code: "41045" }, ["41044"], nameOf))).toBe(nameOf("41045"));
  });

  it("makes each card's name, the host's too, a segment that opens it (user request, 2026-11-01)", () => {
    expect(codes(poolCardLine({ code: "41044", attachedTo: "02116" }, ["41044"], nameOf))).toEqual(["41044", "02116"]);
    expect(namesLine(["41044", "41045"], nameOf)).toEqual([{ text: nameOf("41044"), code: "41044" }, { text: ", " }, { text: nameOf("41045"), code: "41045" }]);
  });
});

describe("the next campaign's line", () => {
  it("reads as carryWords, each card's name a segment", () => {
    const kept = [{ code: "41044" }, { code: "41045", perPlayer: true }, { code: "41050" }, { code: "41050" }];
    expect(lineText(carryLine(kept, nameOf))).toBe(carryWords(kept, nameOf));
    expect(codes(carryLine(kept, nameOf))).toEqual(["41044", "41045", "41050"]);
    expect(lineText(carryLine([{ code: "41044" }, { code: "41045" }], nameOf))).toBe(carryWords([{ code: "41044" }, { code: "41045" }], nameOf));
  });
});
