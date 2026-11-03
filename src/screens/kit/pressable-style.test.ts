import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

// A Pressable with a `className` and a `style` function loses the function's result on the phone (NativeWind merges the class into
// the style, and the function never runs): the size, the radius and the pressed fill vanish (user report, 2026-10-25; the header of
// src/ui/buttons.tsx). Every Pressable puts its look on a view inside its children function instead.
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx$/.test(name) ? [path] : [];
  });
}

/** The Pressables in a source text that carry both a className and a style that is a function, as "line". */
function classNameWithStyleFunction(text: string, file = "x.tsx"): number[] {
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: number[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(tree) === "Pressable") {
      const props = new Map<string, ts.JsxAttribute>();
      for (const attribute of node.attributes.properties) if (ts.isJsxAttribute(attribute)) props.set(attribute.name.getText(tree), attribute);
      const style = props.get("style")?.initializer;
      const expression = style && ts.isJsxExpression(style) ? style.expression : undefined;
      if (props.has("className") && expression && (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression))) found.push(tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}

describe("Pressable styling", () => {
  it("finds a className beside a style function, and nothing else", () => {
    expect(classNameWithStyleFunction('const a = <Pressable className="p-2" style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })} />;')).toEqual([1]);
    expect(classNameWithStyleFunction('const a = <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })} />;')).toEqual([]);
    expect(classNameWithStyleFunction('const a = <Pressable className="p-2" style={{ minHeight: 44 }}>{({ pressed }) => <View />}</Pressable>;')).toEqual([]);
  });

  it("holds in no screen or table component", () => {
    const found = [...sources("src/ui"), ...sources("src/play"), ...sources("src/screens")].flatMap((file) => classNameWithStyleFunction(readFileSync(file, "utf8"), file).map((line) => `${file}:${line}`));
    expect(found).toEqual([]);
  });
});
