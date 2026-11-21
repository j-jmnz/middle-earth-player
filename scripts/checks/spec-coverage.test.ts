import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { Effect } from "../../src/catalog/boundary.ts";

import { authoredRelOfScenario } from "../data/effects/authored-paths.ts";
import { ROOT } from "./tracked.ts";

// Every ledger line a scenario's records name (src/effects/authored/<id>.ts, `lines`) has a card-spec row (test/harness/card-spec.ts: `line: "<id>"`) or a test whose title starts with the line id, in the
// scenario's own folder (src/campaign/scenarios/<id>/), and a test file's header cannot claim a line no test of the folder covers (a header may point to a sibling file's test). It holds the scenarios that have a spec.test.ts (the card-spec track); an older scenario
// with scene files is not held to it. `pnpm test scenario <id>` runs it (scripts/tools/test-scenario.ts, COVERAGE_TESTS). A line with no behaviour a test can show is listed in EXEMPT with its reason.

/** Lines with no row or titled test in the scenario's folder, by scenario: the reason each is left, either that no test can show it or the test that does (a flag's family test is next to its engine). */
const EXEMPT: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "the-massing-at-osgiliath": {
    "00016:A:1": "the Setup is played and checked on every golden by the golden suite's opening check (golden.test.ts)",
    "00017:B:2": "tested with LimitHandPlaysPerRound in src/rules/families/wilderland/hand-plays.test.ts",
    "00018:B:1": "tested with the flag noEffectProgress in src/rules/families/quest/effect-progress.test.ts",
  },
};

const LINE = String.raw`[0-9A-Za-z.\-]+:[A-Z]:\d+`;
const SCENARIOS = path.join(ROOT, "src/campaign/scenarios");

const read = (file: string): string => readFileSync(file, "utf8");
const testFiles = (dir: string): string[] => readdirSync(dir).filter((name) => name.endsWith(".test.ts")).map((name) => path.join(dir, name));

/** The lines a test file covers: the rows it holds and the tests whose title starts with a line id. */
function coveredIn(source: string): Set<string> {
  const covered = new Set<string>();
  for (const found of source.matchAll(/\bline:\s*["']([^"']+)["']/g)) covered.add(found[1]!);
  for (const found of source.matchAll(new RegExp(String.raw`\b(?:it|test)(?:\.(?:only|skip))?\(\s*["'\`](${LINE})(?![\w:])`, "g"))) covered.add(found[1]!);
  return covered;
}

/** The line ids a test file's header names: every `//` comment line before its first line of code, imports aside (a skeleton puts its paragraph below the imports). */
function claimedByHeader(source: string): string[] {
  const header: string[] = [];
  for (const row of source.split("\n")) {
    if (row.startsWith("//")) header.push(row);
    else if (row.trim() !== "" && !row.startsWith("import ")) break;
  }
  return [...new Set(header.join("\n").match(new RegExp(LINE, "g")) ?? [])];
}

async function recordLines(id: string): Promise<Set<string>> {
  const file = path.join(ROOT, "src/effects/authored", `${authoredRelOfScenario(id)}.ts`);
  if (!existsSync(file)) return new Set();
  const made = (await import(/* @vite-ignore */ file)) as { AUTHORED_EFFECTS?: readonly Effect[] };
  return new Set((made.AUTHORED_EFFECTS ?? []).flatMap((effect) => effect.lines));
}

const specScenarios = readdirSync(SCENARIOS).filter((id) => existsSync(path.join(SCENARIOS, id, "spec.test.ts"))).sort();

describe("spec coverage", () => {
  it("reads a header below the imports as well as above them, and stops at the first line of code", () => {
    const skeleton = ['// Rules: rr.forced.', 'import { it } from "vitest";', "", "// Card specs: 111111:A:1 and 111111:A:2 are held.", "const ROWS = [", '  { line: "111111:A:1", act: [], expect: [] },', "];", "// 111111:A:3 in the body is not a claim."].join("\n");
    expect(claimedByHeader(skeleton)).toEqual(["111111:A:1", "111111:A:2"]);
    expect([...coveredIn(skeleton)]).toEqual(["111111:A:1"]);
    expect(claimedByHeader(skeleton).filter((line) => !coveredIn(skeleton).has(line))).toEqual(["111111:A:2"]);
  });

  it("holds at least the first card-spec scenario", () => {
    expect(specScenarios).toContain("the-uruk-hai");
  });

  describe.each(specScenarios)("%s", (id) => {
    const dir = path.join(SCENARIOS, id);
    const files = testFiles(dir);
    const exempt = EXEMPT[id] ?? {};

    it("has a row or a test titled with the line id for every line its records name", async () => {
      const covered = new Set(files.flatMap((file) => [...coveredIn(read(file))]));
      const lines = await recordLines(id);
      const missing = [...lines].filter((line) => !covered.has(line) && !(line in exempt)).sort();
      expect(missing, `lines with no row and no test titled with the line id in ${path.relative(ROOT, dir)}`).toEqual([]);
    });

    it("lists no exempt line that is covered or that no record names", async () => {
      const covered = new Set(files.flatMap((file) => [...coveredIn(read(file))]));
      const lines = await recordLines(id);
      const stale = Object.keys(exempt).filter((line) => covered.has(line) || !lines.has(line));
      expect(stale).toEqual([]);
    });

    it("has no test file whose header claims a line no test of the folder covers", () => {
      const covered = new Set(files.flatMap((file) => [...coveredIn(read(file))]));
      const claims = files.flatMap((file) => claimedByHeader(read(file)).filter((line) => !covered.has(line) && !(line in exempt)).map((line) => `${path.basename(file)}: ${line}`));
      expect(claims).toEqual([]);
    });
  });
});
