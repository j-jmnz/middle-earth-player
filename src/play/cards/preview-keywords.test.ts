// Rules: rr.keywords (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { idOf, tableFromLayout } from "../../../test/harness/scene-kit.ts";

import { drawnKeywords, previewKeywords, type PreviewKeyword } from "./preview-keywords.ts";

const chips: PreviewKeyword[] = [
  { word: "Archery 2", ruleId: "a" },
  { word: "When Revealed", ruleId: "b", timing: true },
  { word: "Doomed", ruleId: "c", lost: true },
  { word: "Shadow", ruleId: "d", timing: true },
];

describe("drawnKeywords", () => {
  it("drops the timing chips while Explain timing words is off", () => {
    expect(drawnKeywords(chips, false).map((chip) => chip.word)).toEqual(["Archery 2", "Doomed"]);
    expect(drawnKeywords([chips[1]!], false)).toEqual([]);
    expect(drawnKeywords(undefined, false)).toEqual([]);
  });

  it("keeps every chip, in order, while it is on", () => {
    expect(drawnKeywords(chips, true)).toEqual(chips);
    expect(drawnKeywords(undefined, true)).toEqual([]);
  });
});

describe("the Burn chip (The Battle of Lake-town)", () => {
  it("is drawn on a location with Burn X and opens its own definition, since no rules span defines it", () => {
    const made = tableFromLayout("the-battle-of-lake-town", { staging: ["50207", "50221"] });
    const chips = previewKeywords(made.state, made.ctx, idOf(made.state, "50221"), null, null);
    expect(chips.find((chip) => chip.word.startsWith("Burn"))).toMatchObject({ word: "Burn 3", ruleId: "local:burn" });
  });
});
