import { readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

// A row's trailing control (the CountStepper of the card lists) is a button. Inside the row's own Pressable it makes a button in a button, which the web reports and a screen reader reads as one control inside another (issue 187).
// The trailing node of a ListRow is a sibling of the Pressable, never one of its descendants.

/** The lines where `{trailing}` or `trailing ??` is written inside a Pressable of a source text. */
function trailingInPressable(text: string): number[] {
  const tree = ts.createSourceFile("x.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: number[] = [];
  const visit = (node: ts.Node, inPressable: boolean): void => {
    const here = inPressable || ((ts.isJsxElement(node) ? node.openingElement.tagName.getText(tree) : "") === "Pressable");
    const reads = (ts.isJsxExpression(node) && node.expression != null && ts.isIdentifier(node.expression) && node.expression.text === "trailing") || (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken && ts.isIdentifier(node.left) && node.left.text === "trailing");
    if (here && reads) found.push(tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1);
    ts.forEachChild(node, (child) => visit(child, here));
  };
  visit(tree, false);
  return found;
}

const read = (file: string): string => readFileSync(join(__dirname, file), "utf8");

describe("a list row's trailing control", () => {
  it("finds a trailing node inside a Pressable, and nothing else", () => {
    expect(trailingInPressable("const a = <Pressable>{trailing}</Pressable>;")).toEqual([1]);
    expect(trailingInPressable("const a = <Pressable>{({ pressed }) => <View>{trailing ?? <Chevron />}</View>}</Pressable>;")).toEqual([1]);
    expect(trailingInPressable("const a = <View><Pressable /> {trailing}</View>;")).toEqual([]);
  });

  it("lies beside the press of the row, not inside it", () => {
    expect(trailingInPressable(read("chrome-frame.tsx"))).toEqual([]);
    expect(trailingInPressable(read("list-row-split.tsx"))).toEqual([]);
    expect(read("list-row-split.tsx")).toContain("{trailing}");
  });
});
