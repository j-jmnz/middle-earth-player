import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../src/effects/index.ts";

import { loadCards } from "../data/load-cards.ts";
import { allRulings, rulingsIn, type Ruling } from "../docs/rulings.ts";
import { ROOT, tracked } from "./tracked.ts";

// A reading a doc stamps as the user's (`pnpm doc rulings`) is settled until the user changes it, so a test holds it: a stamped reading that names a printed line id
// (`<code>:<side>:<n>`) has a test that names that line (or a record that implements it), and one that names a card code has a test that names that card. The
// logic is scripts/checks/line-coverage.test.ts's. The readings below name something no test names today, at their count per file: a count may not grow,
// and one that is back to what the tests hold fails as stale, so lower it or remove the entry. Write the test from the printed words, not from the record.
const MISSES: Readonly<Record<string, number>> = {};

const NAME = /(?<![\w:])(\d{2,6}:[A-Za-z]+:\d+)(?![\w])/g;
const CODE = /(?<![\w:.-])\d{5,6}(?![\w])/g;

const testFiles = tracked(["src", "test"]).filter((file) => /\.(ts|tsx)$/.test(file) && (file.startsWith("test/") || /\.test\.tsx?$/.test(file)));
const named = new Set<string>();
const codes = new Set<string>();
for (const file of testFiles) {
  const text = readFileSync(path.join(ROOT, file), "utf8");
  for (const found of text.matchAll(NAME)) named.add(found[1]!);
  for (const found of text.matchAll(CODE)) codes.add(found[0]);
}
for (const effect of EFFECTS) if (named.has(effect.id)) for (const line of effect.lines) named.add(line);
const cardCodes = new Set(loadCards().map((card) => card.code));
const namedCode = (code: string): boolean => codes.has(code) || [...named].some((id) => id.startsWith(`${code}:`));

/** What a stamped reading names that no test names: its line ids, and its card codes that are cards and are in no line id it names. */
export function unnamed(ruling: Ruling): string[] {
  const lines = ruling.lineIds.filter((id) => !named.has(id));
  const bare = ruling.codes.filter((code) => cardCodes.has(code) && !ruling.lineIds.some((id) => id.startsWith(`${code}:`)) && !namedCode(code));
  return [...lines, ...bare];
}

const misses = allRulings().map((ruling) => ({ ruling, names: unnamed(ruling) })).filter((miss) => miss.names.length > 0);
const perFile = new Map<string, number>();
for (const { ruling } of misses) perFile.set(ruling.file, (perFile.get(ruling.file) ?? 0) + 1);

describe("rulings", () => {
  it("finds the stamped readings of the brief and the scenario files", () => {
    expect(allRulings().length).toBeGreaterThan(50);
  });

  it("reads a stamp, its date, and the line ids and codes of its sentence", () => {
    const text = '## Cards\n\nPlain. Sam (01026:A:1, 12345) reads so (user ruling, 2026-11-05). Next.\n- **Rulings (user decision, 2026-11-06).** Frodo (123456) too.';
    const [first, second] = rulingsIn("x.md", text);
    expect(first).toMatchObject({ section: "Cards", dates: ["2026-11-05"], lineIds: ["01026:A:1"], codes: ["01026", "12345"] });
    expect(first?.sentence.startsWith("Sam")).toBe(true);
    expect(second).toMatchObject({ dates: ["2026-11-06"], codes: ["123456"] });
  });

  it("has a test that names each line or card a stamped reading names, the listed files at their count", () => {
    const over = [...perFile].filter(([file, count]) => count > (MISSES[file] ?? 0));
    expect(over.map(([file, count]) => `${file}: ${count} readings, at most ${MISSES[file] ?? 0}`)).toEqual([]);
  });

  it("lists in MISSES only files that still miss, at their count", () => {
    const loose = Object.entries(MISSES).filter(([file, count]) => (perFile.get(file) ?? 0) !== count).map(([file, count]) => `${file}: ${perFile.get(file) ?? 0}, listed at ${count}`);
    expect(loose, "lower or remove the entry").toEqual([]);
  });

  it("finds a line id or a card no test names", () => {
    const base = { file: "x.md", section: "", line: 1, sentence: "", dates: [] };
    expect(unnamed({ ...base, lineIds: ["99999:A:9"], codes: ["99999"] })).toEqual(["99999:A:9"]);
    expect(unnamed({ ...base, lineIds: [], codes: ["99999"] })).toEqual([]);
  });
});
