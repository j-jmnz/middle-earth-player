import { describe, expect, it } from "vitest";

import entries from "../../data/rules/entries.json";
import { parseRuleEntries } from "./rule-entry.ts";

describe("parseRuleEntries", () => {
  it("reads every committed rule span", () => {
    expect(parseRuleEntries(entries).length).toBe(entries.length);
  });

  it("refuses a span without its page", () => {
    expect(() => parseRuleEntries([{ id: "rr.x", doc: "rr", column: 1, title: "X", text: "", terms: [] }])).toThrow();
  });
});
