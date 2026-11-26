import ts from "typescript";
import { describe, expect, it } from "vitest";

import type { Ask } from "../../src/play/words/asks.ts";
import { entryProblems } from "../../test/harness/words-judge.ts";
import { extendAsks, newAsksFile, renderWordsStubs, statusOf, STATUS_MEANING, tableRows } from "./scenario-words.ts";

// pnpm scenario words <id>: the rows the Words task owes, the stubs for the missing entries, and the Table step rows code can answer.
const valid = (source: string): boolean => ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.ESNext } }).diagnostics?.length === 0;
const pick = (problem: string | null) => ({ kind: "pick" as const, verdict: { key: "k", line: "k: Verb / Say it.", problem } });
const STUBS = renderWordsStubs([
  { key: "1:forced:1 @0 Pick", kind: "pick", effectId: "1:forced:1", cardName: "Card", timing: "forced", printed: "Forced: after it\n engages, discard." },
  { key: "1:forced:1 @0 yes", kind: "branch", effectId: "1:forced:1", cardName: "Card", timing: "forced", printed: "Forced: after it engages, discard." },
]);

describe("scenario words status", () => {
  it("calls an entry ok, or breaks with its own faults and the words verdict", () => {
    expect(statusOf(pick(null), {}, [])).toEqual({ status: "ok", detail: "" });
    expect(statusOf(pick(null), { todo: "x" }, ["a stub"]).status).toBe("breaks");
    expect(statusOf(pick("bare"), {}, [])).toEqual({ status: "breaks", detail: "bare" });
  });

  it("calls a row with no entry MISSING only when the words test fails; with the families' words passing it is `review` for a card only this scenario deals and `chain` for a shared one; a Choose's sentence is optional", () => {
    expect(statusOf(pick("a bare \"Choose a hero.\""), undefined, []).status).toBe("MISSING");
    expect(statusOf(pick("a bare \"Choose a hero.\""), undefined, [], true).status).toBe("MISSING");
    expect(statusOf(pick(null), undefined, [], true).status).toBe("review");
    expect(statusOf(pick(null), undefined, [], false).status).toBe("chain");
    expect(statusOf({ kind: "choose", verdict: null }, undefined, [], true).status).toBe("optional");
  });

  it("has one meaning for each status, the set the header and the docs name", () => {
    expect(Object.keys(STATUS_MEANING)).toEqual(["ok", "breaks", "MISSING", "review", "chain", "optional", "ORPHAN"]);
    expect(STATUS_MEANING.review).toContain("What each task is held to, Words");
  });
});

describe("scenario words stubs", () => {
  it("writes one comment for each record with its printed line, then an entry with a todo for each key", () => {
    expect(STUBS.match(/^ {2}\/\/ 1:forced:1 \(Card, forced\): Forced: after it engages, discard\.$/gm)).toHaveLength(1);
    expect(STUBS).toContain('"1:forced:1 @0 Pick": { todo: "write the sentence and the verb from the printed line" },');
    expect(STUBS).toContain('"1:forced:1 @0 yes": { todo: "write the row label from the printed line" },');
  });

  it("adds the stubs before the end of the ASKS table, keeps every entry, and refuses a file with no table", () => {
    const source = 'import type { Ask } from "../asks.ts";\n\nexport const ASKS: Readonly<Record<string, Ask>> = {\n  // a\n  "9:forced:1 @0 Pick": { note: "Say it." },\n};\n';
    const text = extendAsks("asks.ts", source, STUBS);
    expect(text.indexOf('"9:forced:1 @0 Pick"')).toBeLessThan(text.indexOf('"1:forced:1 @0 Pick"'));
    expect(text.endsWith("},\n};\n")).toBe(true);
    expect(valid(text)).toBe(true);
    expect(() => extendAsks("asks.ts", "nothing\n", STUBS)).toThrow(/asks\.ts has no/);
    // A table that does not end with a line `};` is not written into at the wrong place.
    const loose = 'export const ASKS: Readonly<Record<string, Ask>> = {\n  "a @0 Pick": { note: "x" },\n}\nexport const OTHER = {\n};\n';
    expect(() => extendAsks("src/play/words/asks/odd.ts", loose, STUBS)).toThrow(/src\/play\/words\/asks\/odd\.ts: the ASKS table does not end with a line `\};`/);
    expect(() => extendAsks("asks.ts", "export const ASKS: Readonly<Record<string, Ask>> = {\n", STUBS)).toThrow(/asks\.ts/);
  });

  it("opens the one-line table `pnpm scenario new` writes, empty or with shared tables, before it adds the stubs", () => {
    for (const table of ["{}", "{ ...ONE, ...TWO }"]) {
      const source = `import type { Ask } from "../asks.ts";\n\n// words\nexport const ASKS: Readonly<Record<string, Ask>> = ${table};\n`;
      const text = extendAsks("asks.ts", source, STUBS);
      expect(valid(text.replace(/^ {2}\.\.\.\w+,\n/gm, ""))).toBe(true);
      expect(text).toContain('"1:forced:1 @0 Pick"');
      expect(text.endsWith("},\n};\n")).toBe(true);
      expect(text.includes("...ONE,\n  ...TWO,\n") || table === "{}").toBe(true);
    }
  });

  it("makes a new file for a scenario with none", () => {
    expect(valid(newAsksFile("id", "Name", STUBS))).toBe(true);
  });

  it("a stub fails the entry check until its todo is deleted", () => {
    const stub: Ask = { todo: "write it" };
    expect(entryProblems("k", stub)[0]).toMatch(/a stub/);
    expect(entryProblems("k", { note: "Say it." })).toEqual([]);
  });
});

describe("scenario words Table rows", () => {
  const base = { id: "x", widgets: { hide: false, lifeTracker: false, pursuitTracker: 6 }, files: new Map<string, string>(), setup: [{ id: "1:setup:1", printed: "Setup: add it." }], doc: null, tableTest: false, dialsSource: "" };

  it("says whether each declared widget is read in src/play or src/screens, and leaves out `hide` and the ones that are off", () => {
    const read = tableRows({ ...base, files: new Map([["src/play/readouts/pursuit.ts", "game.widgets.pursuitTracker"]]) });
    expect(read.find((row) => row.what === "widget pursuitTracker")?.state).toBe("wired");
    expect(read.some((row) => row.what.includes("lifeTracker") || row.what.includes("hide"))).toBe(false);
    expect(tableRows(base).find((row) => row.what === "widget pursuitTracker")?.state).toBe("NOT READ");
  });

  it("finds the readout files that name the id, and sends the rest to a hand check", () => {
    const files = new Map([["src/play/readouts/x.ts", 'if (game.scenarioId !== "x") return []']]);
    const found = tableRows({ ...base, files, dialsSource: 'import { a } from "./x.ts";' }).find((row) => row.what.startsWith("readout files"));
    expect(found?.state).toBe("found");
    expect(found?.detail).toContain("in scenario-dials.ts: src/play/readouts/x.ts");
    expect(tableRows(base).find((row) => row.what.startsWith("readout files"))?.state).toBe("check by hand");
    expect(tableRows(base).filter((row) => row.what.startsWith("setup record"))).toHaveLength(1);
  });

  it("checks the scenario file's Table section and the table test", () => {
    expect(tableRows(base).find((row) => row.what === "scenario file")?.state).toBe("missing");
    expect(tableRows({ ...base, doc: "# X\n\n## Readings\n" }).find((row) => row.what.includes("Table section"))?.state).toBe("missing");
    expect(tableRows({ ...base, doc: "# X\n\n## Table\n\n- `1:A:1` a pill.\n", tableTest: true }).find((row) => row.what.includes("Table section"))?.state).toBe("ok");
    expect(tableRows({ ...base, tableTest: true }).find((row) => row.what === "table test")?.state).toBe("ok");
  });
});
