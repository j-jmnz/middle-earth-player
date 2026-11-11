import { describe, expect, it } from "vitest";

import { glossary } from "../rules/glossary.ts";
import { pageRulesLabel, rulesOnPage } from "./page-rules.ts";

describe("rulesOnPage", () => {
  const rows = glossary();

  it("lists the Rules Reference entries printed on a page, by column then title", () => {
    const ids = rulesOnPage(rows, "rules-reference", 3).map((entry) => entry.id);
    expect(ids).toContain("rr.action");
    expect(ids).toContain("rr.active-location");
    const columns = rulesOnPage(rows, "rules-reference", 3).map((entry) => entry.column);
    expect(columns).toEqual([...columns].sort((a, b) => a - b));
  });

  it("matches the book by the entry's document, and only on that page", () => {
    for (const entry of rulesOnPage(rows, "fellowship-of-the-ring", 4)) {
      expect(entry.doc).toBe("mec109");
      expect(entry.page).toBe(4);
    }
    expect(rulesOnPage(rows, "fellowship-of-the-ring", 4).map((entry) => entry.id)).toContain("mec109.hide-tests");
    expect(rulesOnPage(rows, "learn-to-play", 3).every((entry) => entry.doc === "learn-to-play")).toBe(true);
  });

  it("leaves out entries the glossary does not hold and pages with none", () => {
    expect(rulesOnPage(rows, "fellowship-of-the-ring", 1)).toEqual([]);
    expect(rulesOnPage(rows, "rules-reference", 9999)).toEqual([]);
    for (const book of ["rules-reference", "fellowship-of-the-ring", "learn-to-play", "the-dark-of-mirkwood", "dream-chaser", "ered-mithrin", "the-two-towers", "the-return-of-the-king"] as const) {
      for (let page = 1; page <= 40; page += 1) {
        for (const entry of rulesOnPage(rows, book, page)) expect(rows).toContain(entry);
      }
    }
  });
});

describe("pageRulesLabel", () => {
  it("says the page and the count", () => {
    expect(pageRulesLabel(12, 0)).toBe("Rules on this page, page 12: none");
    expect(pageRulesLabel(12, 1)).toBe("Rules on this page, page 12: 1 rule");
    expect(pageRulesLabel(12, 3)).toBe("Rules on this page, page 12: 3 rules");
  });
});
