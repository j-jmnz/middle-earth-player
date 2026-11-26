// Rules: rr.the-word-choose (data/rules/entries.json). A verb of a mechanic family whose handler opens a choice window (`askTarget`, or `openBranch` for a Choose the engine builds) is a pick the sheet words, so the
// words tests must count it (`ENGINE_ASKING` and `asksWithOption` in test/harness/record-walk.ts). This reads the family sources, not a game: for each verb a family's manifest lists, it follows the calls
// of the verb's `case` clause through the functions of the family's own folder and fails on a verb that reaches a window and is neither counted nor exempt below.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { ASKING_VERB_NAMES } from "../../test/harness/record-walk.ts";
import { ROOT } from "../data/paths.ts";

const FAMILIES = path.join(ROOT, "src/rules/families");
const WINDOWS = new Set(["askTarget", "openBranch"]);

// A verb that reaches a window through the folder's functions and still needs no words of its own, with the reason.
const EXEMPT: Readonly<Record<string, string>> = {};

type Unit = { calls: Set<string> };

function filesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? filesIn(path.join(dir, entry.name)) : entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path.join(dir, entry.name)] : []));
}

// The names a node calls, as plain calls (`f(x)`) and method-like calls (`a.f(x)`).
function callsOf(node: ts.Node): Set<string> {
  const calls = new Set<string>();
  const visit = (at: ts.Node): void => {
    if (ts.isCallExpression(at)) {
      const callee = at.expression;
      if (ts.isIdentifier(callee)) calls.add(callee.text);
      else if (ts.isPropertyAccessExpression(callee)) calls.add(callee.name.text);
    }
    ts.forEachChild(at, visit);
  };
  visit(node);
  return calls;
}

/** The verbs a family folder's manifest lists that reach a choice window, from the sources of the folder. */
export function askingVerbsOf(folder: string): string[] {
  const functions = new Map<string, Unit>();
  const clauses = new Map<string, Set<string>>();
  let manifest: string[] = [];
  for (const file of filesIn(folder)) {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if (ts.isFunctionDeclaration(node) && node.name && node.body) functions.set(node.name.text, { calls: callsOf(node.body) });
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) functions.set(node.name.text, { calls: callsOf(node.initializer.body) });
      if (ts.isCaseClause(node) && ts.isStringLiteral(node.expression)) {
        const calls = clauses.get(node.expression.text) ?? new Set<string>();
        for (const statement of node.statements) for (const call of callsOf(statement)) calls.add(call);
        clauses.set(node.expression.text, calls);
      }
      // `export const manifest: RulesFamily = { name: "...", verbs: [...], ... }`
      if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === "verbs" && ts.isArrayLiteralExpression(node.initializer)) manifest = node.initializer.elements.filter(ts.isStringLiteral).map((item) => item.text);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  const reaches = (start: Iterable<string>): boolean => {
    const seen = new Set<string>();
    const queue = [...start];
    while (queue.length > 0) {
      const name = queue.shift()!;
      if (WINDOWS.has(name)) return true;
      if (seen.has(name)) continue;
      seen.add(name);
      for (const next of functions.get(name)?.calls ?? []) queue.push(next);
    }
    return false;
  };
  return manifest.filter((verb) => reaches(clauses.get(verb) ?? []));
}

const found = readdirSync(FAMILIES, { withFileTypes: true }).filter((entry) => entry.isDirectory()).flatMap((entry) => askingVerbsOf(path.join(FAMILIES, entry.name)));

describe("the verbs the engine asks about", () => {
  it("finds the verbs of the families that open a choice window", () => {
    expect(found.length).toBeGreaterThan(40);
    expect(found).toContain("CapRefresh");
    expect(found).toContain("TriggerScour");
  });

  it("counts each one in the words check, or exempts it with a reason", () => {
    const missing = found.filter((verb) => !ASKING_VERB_NAMES.has(verb) && EXEMPT[verb] === undefined);
    expect(missing, "add the verb to ENGINE_ASKING in test/harness/record-walk.ts (or to asksWithOption when it asks only with an option)").toEqual([]);
  });

  it("holds no exemption for a verb that does not reach a window", () => {
    expect(Object.keys(EXEMPT).filter((verb) => !found.includes(verb))).toEqual([]);
  });
});
