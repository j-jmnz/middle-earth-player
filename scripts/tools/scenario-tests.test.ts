import ts from "typescript";
import { describe, expect, it } from "vitest";

import type { Effect } from "../../src/catalog/boundary.ts";
import { stubProblem } from "../../test/harness/card-spec.ts";
import { NAME, withoutStubs } from "../checks/tracked.ts";
import { cutAtWord, extendSpec, planTests, renderStubs, stubsFor } from "./scenario-tests.ts";

// pnpm scenario tests <id>: a failing stub for each record no test names, grouped by card, written into the spec file and never again for a line it names.
const record = (id: string, cardCode: string, lines: string[], timing = "forced"): Effect => ({ id, cardCode, lines, timing }) as unknown as Effect;
const EFFECTS_FIXTURE = [record("2:forced:1", "2", ["2:A:1"]), record("1:action:1", "1", ["1:A:2"], "action"), record("1:response:1", "1", ["1:A:1", "1:A:3"], "response"), record("1:whenRevealed:2", "1", ["1:A:1"], "whenRevealed"), record("3:forced:1", "3", ["3:A:1"])];
const TEXT: Record<string, string> = { "1:A:1": "Response: After a hero\n  attacks, draw a card.", "1:A:2": "Action: Exhaust to heal.", "2:A:1": 'Forced: "quoted" text.' };
const stubs = stubsFor(EFFECTS_FIXTURE, ["2:forced:1", "1:action:1", "1:response:1", "1:whenRevealed:2"], (line) => TEXT[line], (code) => `Card ${code}`);

const valid = (source: string): boolean => ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.ESNext } }).diagnostics?.length === 0;

describe("scenario tests stubs", () => {
  it("takes only the unnamed records, one stub for records that share a line, sorted by card then line", () => {
    expect(stubs.map((stub) => [stub.code, stub.line, stub.records.map((one) => one.id)])).toEqual([
      ["1", "1:A:1", ["1:response:1", "1:whenRevealed:2"]],
      ["1", "1:A:2", ["1:action:1"]],
      ["2", "2:A:1", ["2:forced:1"]],
    ]);
  });

  it("writes each stub with its line id, card, printed line and timing, as a row that is a stub", () => {
    const text = renderStubs(stubs);
    expect(text).toContain("// 1 Card 1.");
    expect(text).toContain("// 1:A:1 printed: Response: After a hero attacks, draw a card.");
    expect(text).toContain("timing response, whenRevealed");
    expect(text.indexOf("// 1 Card 1.")).toBeLessThan(text.indexOf("// 2 Card 2."));
    expect(text).toContain('{ line: "2:A:1", name: "Forced: \\"quoted\\" text.", todo: ');
    expect(valid(`const ROWS = [\n${text}\n];`)).toBe(true);
  });

  it("extends a ROWS array before its end, fills an empty one, and refuses a file with none", () => {
    const block = renderStubs(stubs);
    const rows = `import x;\nexport const ROWS: readonly Row[] = [\n  { line: "9:A:1", act: [], expect: [] },\n];\n\ncardSpecs("id", ROWS);\n`;
    const extended = extendSpec(rows, block) ?? "";
    expect(extended.indexOf('line: "9:A:1"')).toBeLessThan(extended.indexOf('line: "1:A:1"'));
    expect(extended.indexOf('line: "2:A:1"')).toBeLessThan(extended.indexOf("];\n\ncardSpecs"));
    const empty = extendSpec("const ROWS: readonly Row[] = [];\nrest\n", block) ?? "";
    expect(empty).toMatch(/^const ROWS: readonly Row\[\] = \[\n {2}\/\/ 1 Card 1\./);
    expect(empty.endsWith("];\nrest\n")).toBe(true);
    expect(extendSpec("nothing here\n", block)).toBeNull();
  });

  it("plans nothing for no stubs, a new file for a missing spec, and a problem for a file it cannot extend", () => {
    expect(planTests("id", "Name", "x", [])).toEqual({ file: "src/campaign/scenarios/id/spec.test.ts", stubs: [], problem: null });
    const created = planTests("id", "Name", null, stubs);
    expect("text" in created && created.created && valid(created.text)).toBe(true);
    expect("problem" in planTests("id", "Name", "no array", stubs)).toBe(true);
  });

  it("a written stub is a failing row until its todo is deleted", () => {
    expect(stubProblem({ line: "1:A:1", todo: "write it", act: [], expect: [] })).toMatch(/row 1:A:1 is a stub/);
    expect(stubProblem({ line: "1:A:1", act: [], expect: [] })).toBeNull();
  });

  it("cuts a stub's name at a word, not in the middle of one", () => {
    const text = "Response: After a hero attacks an enemy engaged with another player, draw a card.";
    expect(cutAtWord(text, 70)).toBe("Response: After a hero attacks an enemy engaged with another player");
    expect(cutAtWord("Short text.", 70)).toBe("Short text.");
    expect(cutAtWord("x".repeat(100), 70)).toBe("x".repeat(70));
    expect(renderStubs(stubsFor([record("5:forced:1", "5", ["5:A:1"])], ["5:forced:1"], () => text, () => "Five"))).toContain('name: "Response: After a hero attacks an enemy engaged with another player",');
  });

  it("counts a stub as no name for a record or a line, and a filled row as one", () => {
    const names = (source: string): string[] => [...withoutStubs(source).matchAll(NAME)].map((found) => found[1]!);
    const real = stubsFor([record("11111:forced:1", "11111", ["11111:A:1"]), record("22222:action:1", "22222", ["22222:A:2"], "action")], ["11111:forced:1", "22222:action:1"], () => "Printed text.", (code) => `Card ${code}`);
    const block = renderStubs(real);
    expect(names(`const ROWS = [\n${block}\n];`)).toEqual([]);
    // A stub that spans lines, and a layout with braces inside it, are one row.
    expect(names('const ROWS = [\n  {\n    line: "77777:A:1",\n    todo: "x",\n    layout: { heroes: [{ code: "1" }] },\n  },\n  { line: "88888:A:1", act: [], expect: [] },\n];')).toEqual(["88888:A:1"]);
    // The row an author filled names its line again, even with the stub comments left above it.
    const filled = block.replace(/, todo: "[^"]*"/g, "");
    expect(names(`const ROWS = [\n${filled}\n];`).sort()).toEqual(["11111:A:1", "22222:A:2"]);
  });

  it("writes no second stub for a line the spec file holds a row for, stub or not", () => {
    const first = planTests("id", "Name", null, stubs);
    const text = "text" in first ? first.text : "";
    expect(planTests("id", "Name", text, stubs)).toEqual({ file: "src/campaign/scenarios/id/spec.test.ts", stubs: [], problem: null });
  });
});
