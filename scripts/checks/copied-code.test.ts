import { readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { ROOT, tracked } from "./tracked.ts";

// A function body of this many lines or more that two files of src hold word for word is a copy: one file owns it and the other imports it (docs/agents/agent-brief.md,
// What the review finds twice). The review of the Haradrim cycle found a helper copied across families in every scenario. Two files that are the web and the native
// variant of one module (`x.native.ts`, `x.canvaskit.ts`, `x.ts`) differ by platform on purpose and are not compared.
const MIN_LINES = 8;

// Copies that stand today, each with its reason; none may be added, and one that stopped being a copy is stale and goes.
const KNOWN: Readonly<Record<string, string>> = {
  "src/play/canvas/row-feet-probe.tsx:RowFeetProbe = src/play/canvas/table-canvas.native.tsx:RowFeetProbe": "the web gate keeps its own copy so that the phone file stays unchanged (docs/architecture.md, Screens)",
  "src/rules/families/attachments/fixture.ts:deck = src/rules/families/encounter/fixture.ts:deck": "each family's test fixture builds its own table; moving it to the shared kit is its own change",
  "src/rules/families/encounter/fixture.ts:seat = src/rules/families/play/fixture.ts:seat": "each family's test fixture builds its own table; moving it to the shared kit is its own change",
};

const platformStem = (file: string): string => file.replace(/\.(native|canvaskit|web)(?=\.tsx?$)/, "");

function copies(): string[] {
  const seen = new Map<string, { file: string; name: string }[]>();
  for (const file of tracked(["src"])) {
    if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file) || /^src\/effects\/(generated|authored)\//.test(file)) continue;
    const source = ts.createSourceFile(file, readFileSync(path.join(ROOT, file), "utf8"), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if ((ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node)) && node.body && ts.isBlock(node.body)) {
        const body = node.body.getText();
        if (body.split("\n").length >= MIN_LINES) {
          const name = ts.isFunctionDeclaration(node) && node.name ? node.name.text : "(anonymous)";
          const key = body.replace(/\s+/g, " ");
          seen.set(key, [...(seen.get(key) ?? []), { file, name }]);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  const found = new Set<string>();
  for (const sites of seen.values()) {
    for (const [index, first] of sites.entries()) {
      for (const second of sites.slice(index + 1)) {
        if (first.file === second.file || platformStem(first.file) === platformStem(second.file)) continue;
        found.add(`${first.file}:${first.name} = ${second.file}:${second.name}`);
      }
    }
  }
  return [...found].sort();
}

describe("copied code", () => {
  const found = copies();

  it(`finds no function body of ${MIN_LINES} lines or more written word for word in two files of src`, () => {
    expect(found.filter((copy) => !(copy in KNOWN)), "import one copy instead of writing it twice").toEqual([]);
  });

  it("lists in KNOWN only copies that still exist", () => {
    expect(Object.keys(KNOWN).filter((copy) => !found.includes(copy)), "remove the entry").toEqual([]);
  });
});
