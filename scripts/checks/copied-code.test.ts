import { readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { ROOT, tracked } from "./tracked.ts";

// A helper written again in a second file drifts from the first: a fix lands in one copy only. A function body that two files of src, test or scripts hold token for token is a copy:
// one file owns it and the other imports it. The tokens are compared without comments, spacing or line breaks, so a changed comment or a reflowed body is still found. A copy that also
// renames its locals or parameters is not found: that takes a syntax-tree comparison, and a rename is a deliberate edit that a reviewer reads. A body counts from MIN_LINES lines that hold a
// token. Functions are function declarations, function expressions, arrow functions (a block or one expression) and methods, named from their declaration or variable. Two files that are the
// web and the native variant of one module (`x.native.ts`, `x.canvaskit.ts`, `x.ts`) differ by platform on purpose and are not compared. Generated and authored effect records are data.
const MIN_LINES = 8;

// Copies that stand today, each with its reason; none may be added, and one that stopped being a copy is stale and goes.
const KNOWN: Readonly<Record<string, string>> = {
  "src/campaign/scenarios/a-storm-on-cobas-haven/campaign-card.test.ts:(anonymous) = src/campaign/scenarios/the-city-of-corsairs/campaign-card.test.ts:(anonymous)": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/campaign/scenarios/attack-on-dol-guldur/lines.test.ts:passUntil = src/campaign/scenarios/the-siege-of-annuminas/lines.test.ts:passUntil": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/campaign/scenarios/fire-in-the-night/boons.test.ts:(anonymous) = src/campaign/scenarios/the-ghost-of-framsburg/boons.test.ts:(anonymous)": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/campaign/scenarios/fire-in-the-night/campaign-card.test.ts:won = src/campaign/scenarios/mount-gundabad/campaign-card.test.ts:won": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/campaign/scenarios/fire-in-the-night/campaign-card.test.ts:won = src/campaign/scenarios/roam-across-rhovanion/campaign-card.test.ts:won": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/campaign/scenarios/fire-in-the-night/campaign-card.test.ts:won = src/campaign/scenarios/the-ghost-of-framsburg/campaign-card.test.ts:won": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/campaign/scenarios/fire-in-the-night/campaign-card.test.ts:won = src/campaign/scenarios/the-withered-heath/campaign-card.test.ts:won": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/campaign/scenarios/journey-up-the-anduin/campaign-card.test.ts:won = src/campaign/scenarios/lost-in-mirkwood/campaign-card.test.ts:won": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/campaign/scenarios/journey-up-the-anduin/campaign-card.test.ts:won = src/campaign/scenarios/the-kings-quest/campaign-card.test.ts:won": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/campaign/scenarios/lost-in-mirkwood/campaign-card.test.ts:won = src/campaign/scenarios/the-kings-quest/campaign-card.test.ts:won": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/campaign/scenarios/mount-gundabad/campaign-card.test.ts:won = src/campaign/scenarios/roam-across-rhovanion/campaign-card.test.ts:won": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/campaign/scenarios/mount-gundabad/campaign-card.test.ts:won = src/campaign/scenarios/the-ghost-of-framsburg/campaign-card.test.ts:won": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/campaign/scenarios/mount-gundabad/campaign-card.test.ts:won = src/campaign/scenarios/the-withered-heath/campaign-card.test.ts:won": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/campaign/scenarios/mount-gundabad/stages.test.ts:advanceTo = src/play/choice/gundabad-sheets.test.ts:advanceTo": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/campaign/scenarios/roam-across-rhovanion/campaign-card.test.ts:won = src/campaign/scenarios/the-ghost-of-framsburg/campaign-card.test.ts:won": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/campaign/scenarios/roam-across-rhovanion/campaign-card.test.ts:won = src/campaign/scenarios/the-withered-heath/campaign-card.test.ts:won": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/campaign/scenarios/temple-of-the-deceived/campaign.test.ts:opened = src/campaign/scenarios/the-drowned-ruins/campaign.test.ts:opened": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/campaign/scenarios/the-ghost-of-framsburg/campaign-card.test.ts:won = src/campaign/scenarios/the-withered-heath/campaign-card.test.ts:won": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/play/canvas/row-feet-probe.tsx:RowFeetProbe = src/play/canvas/table-canvas.native.tsx:RowFeetProbe": "the web gate keeps its own copy so that the phone file stays unchanged (docs/architecture.md, Screens)",
  "src/play/cards/contract-preview.test.ts:started = src/play/cards/loot-mark.test.ts:started": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/play/scenarios/assault-on-osgiliath-table.test.ts:speechDeps = src/play/scenarios/encounter-at-amon-din-table.test.ts:speechDeps": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/play/scenarios/assault-on-osgiliath-table.test.ts:speechDeps = src/play/scenarios/intruders-in-chetwood-table.test.ts:speechDeps": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/play/scenarios/encounter-at-amon-din-table.test.ts:speechDeps = src/play/scenarios/intruders-in-chetwood-table.test.ts:speechDeps": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/play/words/raid-on-the-grey-havens.test.ts:(anonymous) = src/play/words/scenarios/stormcaller.test.ts:(anonymous)": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/play/words/raid-on-the-grey-havens.test.ts:(anonymous) = src/play/words/voyage-across-belegaer.test.ts:(anonymous)": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/play/words/scenarios/stormcaller.test.ts:(anonymous) = src/play/words/voyage-across-belegaer.test.ts:(anonymous)": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/rules/families/attachments/fixture.ts:deck = src/rules/families/encounter/fixture.ts:deck": "each family's test fixture builds its own table; moving it to the shared kit is its own change",
  "src/rules/families/deck/moves.test.ts:settle = src/rules/families/deck/responses.test.ts:settle": "a test helper each scenario's test file keeps for itself; moving it to the shared kit (test/harness) is its own change",
  "src/rules/families/encounter/fixture.ts:seat = src/rules/families/play/fixture.ts:seat": "each family's test fixture builds its own table; moving it to the shared kit is its own change",
  "test/scenarios/a-storm-on-cobas-haven/scene.ts:havenTable = test/scenarios/the-city-of-corsairs/scene.ts:corsairsTable": "each scenario's scene or game file builds its own table; moving it to the shared kit (test/harness) is its own change",
  "test/scenarios/a-storm-on-cobas-haven/scene.ts:havenTable = test/scenarios/the-ghost-of-framsburg/scene.ts:framsburgTable": "each scenario's scene or game file builds its own table; moving it to the shared kit (test/harness) is its own change",
  "test/scenarios/the-city-of-corsairs/scene.ts:corsairsTable = test/scenarios/the-ghost-of-framsburg/scene.ts:framsburgTable": "each scenario's scene or game file builds its own table; moving it to the shared kit (test/harness) is its own change",
  "test/scenarios/the-passing-of-the-grey-company/game.ts:companyIntent = test/scenarios/the-weather-hills/game.ts:hillsIntent": "each scenario's scene or game file builds its own table; moving it to the shared kit (test/harness) is its own change",
};

const platformStem = (file: string): string => file.replace(/\.(native|canvaskit|web)(?=\.tsx?$)/, "");

interface Site {
  file: string;
  name: string;
}

/** The tokens of `text` without comments, as one string, and the number of source lines that hold a token. */
function tokensOf(source: ts.SourceFile, node: ts.Node): { key: string; lines: number } {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, source.languageVariant, source.text, undefined, node.getStart(source), node.getWidth(source));
  const parts: string[] = [];
  const lines = new Set<number>();
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    parts.push(scanner.getTokenText());
    lines.add(source.getLineAndCharacterOfPosition(scanner.getTokenStart()).line);
  }
  return { key: parts.join(" "), lines: lines.size };
}

/** The name a function is known by: its own, or the variable, property or method it is written under. */
function nameOf(node: ts.Node): string {
  if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isMethodDeclaration(node)) && node.name) return node.name.getText();
  const parent = node.parent;
  if ((ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent)) && parent.name) return parent.name.getText();
  return "(anonymous)";
}

/** The copies among `files`: each pair of sites in different files that hold one body. */
export function copiesIn(files: readonly { file: string; text: string }[]): string[] {
  const seen = new Map<string, Site[]>();
  for (const { file, text } of files) {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (node: ts.Node): void => {
      const isFunction = ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node);
      if (isFunction && node.body) {
        const { key, lines } = tokensOf(source, node.body);
        if (lines >= MIN_LINES) seen.set(key, [...(seen.get(key) ?? []), { file, name: nameOf(node) }]);
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

function copies(): string[] {
  const files = tracked(["src", "test"])
    .filter((file) => /\.tsx?$/.test(file) && !/^src\/effects\/(generated|authored)\//.test(file))
    .map((file) => ({ file, text: readFileSync(path.join(ROOT, file), "utf8") }));
  return copiesIn(files);
}

const BODY = ["{", ...Array.from({ length: 9 }, (_, i) => `  total += ${i + 1};`), "  return total;", "}"];
const withBody = (name: string, comment: string): string => `export function ${name}(total: number): number ${BODY.join(`\n${comment}`)}\n`;

describe("copied code", () => {
  const found = copies();

  it(`finds no function body of ${MIN_LINES} lines or more written token for token in two files`, () => {
    expect(found.filter((copy) => !(copy in KNOWN)), "import one copy instead of writing it twice").toEqual([]);
  });

  it("lists in KNOWN only copies that still exist", () => {
    expect(Object.keys(KNOWN).filter((copy) => !found.includes(copy)), "remove the entry").toEqual([]);
  });

  it("finds one body in two in-memory sources, whatever its comments and spacing", () => {
    const first = withBody("add", "");
    const second = withBody("sum", "  // another comment\n").replace(/  total/g, "      total");
    expect(copiesIn([{ file: "a.ts", text: first }, { file: "b.ts", text: second }])).toEqual(["a.ts:add = b.ts:sum"]);
  });

  it("names an arrow function from its variable and reads an expression body", () => {
    const arrow = `export const pick = (items: string[]) =>\n  items\n${"    .map((item) => item)\n".repeat(8)}    .join(",");\n`;
    expect(copiesIn([{ file: "a.ts", text: arrow }, { file: "b.ts", text: arrow.replace("pick", "choose") }])).toEqual(["a.ts:pick = b.ts:choose"]);
  });

  it("does not compare a file with itself or with its platform variant, and ignores a short body", () => {
    const text = withBody("add", "");
    expect(copiesIn([{ file: "a.ts", text }, { file: "a.ts", text: withBody("again", "") }])).toEqual([]);
    expect(copiesIn([{ file: "a.ts", text }, { file: "a.native.ts", text }])).toEqual([]);
    expect(copiesIn([{ file: "a.ts", text: "export function f(a: number) {\n  return a;\n}\n" }, { file: "b.ts", text: "export function f(a: number) {\n  return a;\n}\n" }])).toEqual([]);
  });
});
