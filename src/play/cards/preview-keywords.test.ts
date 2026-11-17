// Rules: rr.keywords (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import { drawnKeywords, type PreviewKeyword } from "./preview-keywords.ts";

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
