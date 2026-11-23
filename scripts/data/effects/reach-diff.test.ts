import { describe, expect, it } from "vitest";

import { formatChanges, lineDiff, reaching, type CardDump, type Dump } from "./reach-diff.ts";

const card = (text: string, records: Record<string, unknown>, lines: Record<string, string> = { "1:A:1": "Draw 1 card." }): CardDump => ({ name: "One", lines, text, records });
const rec = (instructions: unknown[]) => ({ id: "1:action:1", lines: ["1:A:1"], instructions });
const dump = (cards: Record<string, CardDump>): Dump => ({ cards });

describe("lineDiff", () => {
  it("marks the lines only at the base with - and the lines only in the tree with +, in order", () => {
    expect(lineDiff(["a", "b", "c"], ["a", "x", "c", "d"])).toEqual(["- b", "+ x", "+ d"]);
    expect(lineDiff(["a"], ["a"])).toEqual([]);
  });
});

describe("reaching", () => {
  const base = dump({ "1": card("draw 1", { "1:action:1": rec([{ verb: "Draw", amount: 1 }]) }), "2": card("same", { "2:action:1": rec([]) }) });

  it("lists nothing when no card differs", () => {
    expect(reaching(base, base)).toEqual([]);
    expect(formatChanges([], "main")).toContain("No card");
  });

  it("lists a card whose record JSON changed, with the printed line of the record that moved and the render's difference", () => {
    const now = dump({ ...base.cards, "1": card("draw 2", { "1:action:1": rec([{ verb: "Draw", amount: 2 }]) }) });
    const found = reaching(base, now);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ code: "1", changed: ["1:action:1"], added: [], removed: [], lines: { "1:A:1": "Draw 1 card." }, diff: ["- draw 1", "+ draw 2"] });
    const text = formatChanges(found, "main");
    expect(text).toContain("1 card reached against main");
    expect(text).toContain("## 1 One");
    expect(text).toContain("1:A:1: Draw 1 card.");
  });

  it("lists a card whose JSON moved with the same render, and one whose render moved with the same JSON", () => {
    const sameText = dump({ ...base.cards, "1": card("draw 1", { "1:action:1": rec([{ verb: "Draw", amount: 2 }]) }) });
    expect(reaching(base, sameText)[0]).toMatchObject({ changed: ["1:action:1"], diff: [] });
    const sameJson = dump({ ...base.cards, "2": card("other words", { "2:action:1": rec([]) }) });
    expect(reaching(base, sameJson)[0]).toMatchObject({ code: "2", changed: [], diff: ["- same", "+ other words"] });
  });

  it("lists an added and a removed record, and a card that is in one tree only", () => {
    const now = dump({ "1": card("draw 1", { "1:action:1": rec([{ verb: "Draw", amount: 1 }]), "1:response:1": { id: "1:response:1", lines: ["1:A:1"], instructions: [] } }), "3": card("new", { "3:action:1": rec([]) }, { "3:A:1": "New." }) });
    const found = reaching(base, now);
    expect(found.map((change) => [change.code, change.added, change.removed])).toEqual([
      ["1", ["1:response:1"], []],
      ["2", [], ["2:action:1"]],
      ["3", ["3:action:1"], []],
    ]);
  });
});
