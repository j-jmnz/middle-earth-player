import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildGraph, citationsIn, headingsOf, INDEX_PATH, renderIndex, resolveSection, ROOT, sectionText } from "./index.ts";

describe("docs index", () => {
  const graph = buildGraph();

  it("is current (pnpm docs:index rewrites docs/INDEX.md)", () => {
    expect(readFileSync(path.join(ROOT, INDEX_PATH), "utf8")).toBe(renderIndex(graph));
  });

  it("resolves every doc section a code comment or a live doc cites", () => {
    expect(graph.unresolved.map((citation) => `${citation.from}: ${citation.doc}, "${citation.section}"`)).toEqual([]);
    expect(graph.citations.length).toBeGreaterThan(100);
  });

  it("reads a citation's doc and first section name", () => {
    const docs = new Map([["brief.md", "docs/brief.md"], ["design-system-table.md", "docs/design-system-table.md"]]);
    const text = "// (docs/brief.md, Card images; phase 5) and (docs/design-system-table.md, Spotlight; phase 24) and (docs/brief.md, phase 3)";
    expect(citationsIn("x.ts", text, docs).map((citation) => `${citation.doc}#${citation.section}`)).toEqual(["docs/brief.md#Card images", "docs/design-system-table.md#Spotlight"]);
  });

  it("matches a section by exact text, then prefix, then substring, then either half of an \"and\"", () => {
    const headings = headingsOf("# T\n\n## State\n\n## Play loop\n\n### Peeking at the other seat\n\n## Tablets\n");
    expect(resolveSection(headings, "State")?.text).toBe("State");
    expect(resolveSection(headings, "Peeking")?.text).toBe("Peeking at the other seat");
    expect(resolveSection(headings, "Standard 8 and Tablets")?.text).toBe("Tablets");
    expect(resolveSection(headings, "Table")).toBeNull();
  });

  it("prints one section with its subsections and stops at the next sibling", () => {
    const text = sectionText("design-system-table", "Spotlight");
    expect(text.split("\n")[1]).toBe("## Spotlight");
    expect(text).not.toContain("\n## Gestures");
  });
});
