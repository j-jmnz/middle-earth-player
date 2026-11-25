import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../src/effects/index.ts";

import { loadCards } from "../data/load-cards.ts";
import { allRulings, CODE, rulingsIn, type Ruling } from "../docs/rulings.ts";
import { NAME, ROOT, testFiles } from "./tracked.ts";

// A reading a doc stamps as the user's (`pnpm doc rulings`) is settled until the user changes it, so a test holds it: a reading of a card names a printed line id
// (`<code>:<side>:<n>`) or a card code, and a test TITLE (it, test or describe), a card-spec row's `line:` or a `lineSpec("<id>", ...)` call must name that line id,
// a record that implements it, or the code (a range such as "143015 to 143018" is each code in it). A name in a comment, a helper or a test's body does not count, and
// the title is the only place a reader looks. What the check cannot see: a reading that names no code or line id (a rule, a screen, a product decision); a title built
// in a loop or from a template (write the id in the describe title); and what the test does with the name, since a title can name a card and test something else, so
// write the test from the printed words and read the reading beside it. The readings below name something no test title names today, at their count per file: a count
// may not grow, and one that is back to what the tests hold fails as stale, so lower it or remove the entry.
const MISSES: Readonly<Record<string, number>> = {
  "docs/brief.md": 1, // 141017:A:3
  "docs/scenarios/ered-mithrin.md": 1, // 12168:B:1
  "docs/scenarios/the-two-towers/the-uruk-hai.md": 1, // 143071:B:1
};

const TITLE = /\b(?:it|test|describe)(?:\.\w+)?\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
const ROW = /\b(?:line:|lineSpec\()\s*["']([^"']+)["']/g;

/** The ids and codes a test file names where a reader looks: in a title, a card-spec row or a lineSpec call. */
function namedIn(text: string): { ids: string[]; codes: string[] } {
  const titles = [...text.matchAll(TITLE)].map((found) => found[2]!);
  return {
    ids: [...titles.flatMap((title) => [...title.matchAll(NAME)].map((id) => id[1]!)), ...[...text.matchAll(ROW)].map((found) => found[1]!)],
    codes: titles.flatMap((title) => [...title.matchAll(CODE)].map((code) => code[0])),
  };
}

const named = new Set<string>();
const codes = new Set<string>();
for (const file of testFiles()) {
  const found = namedIn(readFileSync(path.join(ROOT, file), "utf8"));
  for (const id of found.ids) named.add(id);
  for (const code of found.codes) codes.add(code);
}
for (const effect of EFFECTS) if (named.has(effect.id)) for (const line of effect.lines) named.add(line);
const cardCodes = new Set(loadCards().map((card) => card.code));
const namedCode = (code: string): boolean => codes.has(code) || [...named].some((id) => id.startsWith(`${code}:`));

/** What a stamped reading names that no test title names: its line ids, and its card codes that are cards and are in no line id it names. */
function unnamed(ruling: Ruling): string[] {
  const lines = ruling.lineIds.filter((id) => !named.has(id));
  const bare = ruling.codes.filter((code) => cardCodes.has(code) && !ruling.lineIds.some((id) => id.startsWith(`${code}:`)) && !namedCode(code));
  return [...lines, ...bare];
}

const misses = allRulings().map((ruling) => ({ ruling, names: unnamed(ruling) })).filter((miss) => miss.names.length > 0);
const perFile = new Map<string, number>();
for (const { ruling } of misses) perFile.set(ruling.file, (perFile.get(ruling.file) ?? 0) + 1);

// A scenario file path for the samples below, joined so the doc-path check (scripts/checks/agent-docs.test.ts) does not read it as a doc.
const BOX = ["docs", "scenarios", "x.md"].join("/");

describe("rulings", () => {
  it("finds the stamped readings of the brief and the scenario files", () => {
    expect(allRulings().length).toBeGreaterThan(50);
  });

  it("reads a stamp, its date, and the line ids and codes of its sentence", () => {
    const text = '## Cards\n\nPlain. Sam (01026:A:1, 12345) reads so (user ruling, 2026-11-05). Next.\n- **Rulings (user decision, 2026-11-06).** Frodo (123456) too.';
    const [first, second] = rulingsIn("x.md", text);
    expect(first).toMatchObject({ section: "Cards", dates: ["2026-11-05"], lineIds: ["01026:A:1"], codes: ["01026", "12345"], kind: "reading" });
    expect(first?.sentence.startsWith("Sam")).toBe(true);
    expect(second).toMatchObject({ dates: ["2026-11-06"], codes: ["123456"] });
  });

  it("has a test title that names each line or card a stamped reading names, the listed files at their count", () => {
    const over = [...perFile].filter(([file, count]) => count > (MISSES[file] ?? 0));
    expect(over.map(([file, count]) => `${file}: ${count} readings, at most ${MISSES[file] ?? 0}`)).toEqual([]);
  });

  it("lists in MISSES only files that still miss, at their count", () => {
    const loose = Object.entries(MISSES).filter(([file, count]) => (perFile.get(file) ?? 0) !== count).map(([file, count]) => `${file}: ${perFile.get(file) ?? 0}, listed at ${count}`);
    expect(loose, "lower or remove the entry").toEqual([]);
  });

  it("finds a line id or a card no test names", () => {
    const base = { file: "x.md", section: "", line: 1, lastLine: 1, sentence: "", dates: [], ruleIds: [], kind: "reading" as const };
    expect(unnamed({ ...base, lineIds: ["99999:A:9"], codes: ["99999"] })).toEqual(["99999:A:9"]);
    expect(unnamed({ ...base, lineIds: [], codes: ["99999"] })).toEqual([]);
  });

  it("counts a name in a title, a spec row or a lineSpec call, and not one in a comment or a body", () => {
    const source = [
      "// 111111:A:1 is in a comment, and 111112 too.",
      'describe("Sam (111113)", () => {',
      '  it("111114:A:2 reads so", () => { expect(send("111115:A:3")).toBe(1); });',
      "});",
      '{ line: "111116:A:1", act: [] }, lineSpec("111117:A:1", "x", check);',
    ].join("\n");
    expect(namedIn(source)).toEqual({ ids: ["111114:A:2", "111116:A:1", "111117:A:1"], codes: ["111113", "111114"] });
  });

  it("reads a stamp that heads a list or numbered items, a range of codes, and a stamp with no date", () => {
    const list = ["- **Uruk-hai** (`x`). Text. Rulings (user, 2026-11-07):", "  - Weariness (143031:A:1): keeps.", "  - Skill boons (143015 to 143017) attach (user ruling C1, 2026-11-08).", "- **Next** other."].join("\n");
    const [heading, ...rest] = rulingsIn(BOX, list);
    expect(rest).toEqual([]);
    expect(heading).toMatchObject({ line: 1, lastLine: 3, dates: ["2026-11-07", "2026-11-08"], lineIds: ["143031:A:1"], codes: ["143031", "143015", "143016", "143017"] });
    expect(heading?.bullet).toContain("Uruk-hai");
    const numbered = rulingsIn(BOX, "- Fire. Rulings (user, 2026-11-06): (1) Dagnir's cap; (2) engaged. Each has a test.");
    expect(numbered).toHaveLength(1);
    expect(numbered[0]?.sentence).toBe("Rulings (user, 2026-11-06): (1) Dagnir's cap; (2) engaged.");
    expect(rulingsIn(BOX, "- Delay (141078) wins (user decision). Other (user ruling: the test follows the travel).").map((r) => r.codes)).toEqual([["141078"], []]);
  });

  it("lists a sentence once when its whole bullet is listed, and tells a reading from a product decision", () => {
    const bullet = "- **The Withered Heath (user ruling, 2026-11-05).** It reads so (user ruling, 2026-11-05).";
    expect(rulingsIn(BOX, bullet)).toHaveLength(1);
    const brief = "## Screens\n\nThe table is landscape only (user request, 2026-10-25).\n\n## Core round\n\nA rule reads so (user decision, 2026-11-01). It names rr.travel (user request, 2026-11-02).";
    expect(rulingsIn("brief.md", brief).map((r) => r.kind)).toEqual(["decision", "reading", "reading"]);
  });
});
