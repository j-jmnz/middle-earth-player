// Plain words (docs/design-system-table.md, Choice tray): a sentence in the words of the dock and the tray stays short. A longer thought is split into sentences, none dropped.
// The test reads the string literals and template fragments of the words modules (the text between two `${}` counts alone, so a sentence the code builds from several parts is
// checked in its parts and by the sheet tests as a whole).
import fs from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const LIMIT = 25;
const root = path.resolve(import.meta.dirname, "..");
const files = [
  ...fs.readdirSync(import.meta.dirname).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts")).map((name) => path.join(import.meta.dirname, name)),
  path.join(root, "cards", "dungeon-preview.ts"),
];

const words = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

function fragments(file: string): { text: string; line: number }[] {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const found: { text: string; line: number }[] = [];
  const visit = (node: ts.Node): void => {
    const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) found.push({ text: node.text, line });
    else if (ts.isTemplateExpression(node)) {
      found.push({ text: node.head.text, line });
      for (const span of node.templateSpans) found.push({ text: span.literal.text, line });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("the sentences of the words", () => {
  it(`stay within ${LIMIT} words each`, () => {
    const long = files.flatMap((file) => fragments(file).flatMap(({ text, line }) => text.split(/(?<=[.!?])\s+/).filter((sentence) => words(sentence) > LIMIT).map((sentence) => `${path.basename(file)}:${line} (${words(sentence)}) ${sentence}`)));
    expect(long).toEqual([]);
  });
});
