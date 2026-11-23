import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { ROOT } from "../data/paths.ts";
import { changedRecords, chooseTests, namePattern, TEST_LINES_USAGE, untitledRecords } from "./test-lines.ts";

const runLines = (...args: string[]) => spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", path.join(ROOT, "scripts/tools/test-lines.ts"), ...args], { cwd: ROOT, encoding: "utf8", env: { ...process.env, LOG_LEVEL: "info" } });

// pnpm test lines: which records moved, which test files name them, and the `-t` pattern that picks their tests.
const dump = (...rows: [string, string[], string][]) => Object.fromEntries(rows.map(([id, lines, json]) => [id, { lines, json }]));

describe("test lines", () => {
  it("lists the records that are added, removed or changed, with the lines of both trees", () => {
    const base = dump(["1:forced:1", ["1:A:1"], "a"], ["1:action:1", ["1:A:2"], "same"], ["2:response:1", ["2:A:1"], "gone"], ["3:constant:1", ["3:A:1"], "old"]);
    const now = dump(["1:forced:1", ["1:A:1"], "b"], ["1:action:1", ["1:A:2"], "same"], ["4:constant:1", ["4:A:1"], "new"], ["3:constant:1", ["3:A:2"], "new"]);
    expect(changedRecords(base, now)).toEqual({ records: ["1:forced:1", "2:response:1", "3:constant:1", "4:constant:1"], lines: ["1:A:1", "2:A:1", "3:A:1", "3:A:2", "4:A:1"] });
    expect(changedRecords(base, base)).toEqual({ records: [], lines: [] });
  });

  it("matches a whole id only, so one line does not pick the tests of another", () => {
    const pattern = new RegExp(namePattern(["01026:A:1", "02:forced:1"]));
    expect(pattern.test("01026:A:1 it draws a card")).toBe(true);
    expect(pattern.test("card specs 01026:A:1: fails without its records")).toBe(true);
    expect(pattern.test("01026:A:10 it draws")).toBe(false);
    expect(pattern.test("101026:A:1 it draws")).toBe(false);
    expect(pattern.test("02:forced:1")).toBe(true);
  });

  it("takes the test files that name an id, counting the titles that hold one", () => {
    const sources = {
      "a.test.ts": 'it("11111:A:1 draws", () => {});\nit("11111:A:2 does not", () => {});\nit("another", () => {});',
      "b.test.ts": '// 11111:A:1 is read in a comment only\nit("something", () => {});',
      "c.test.ts": 'it("22222:A:1 elsewhere", () => {});',
    };
    expect(chooseTests(new Set(["11111:A:1"]), sources)).toEqual([
      { file: "a.test.ts", titles: 1 },
      { file: "b.test.ts", titles: 0 },
    ]);
    expect(chooseTests(new Set(["99999:A:1"]), sources)).toEqual([]);
    expect(TEST_LINES_USAGE).toContain("pnpm test lines");
  });

  it("finds the records no test title holds, in any file", () => {
    const sources = { "a.test.ts": 'it("11111:A:1 draws", () => {});', "b.test.ts": 'it("a test with no id in its title", () => {}); // 22222:A:1' };
    const records = [{ id: "11111:forced:1", lines: ["11111:A:1"] }, { id: "22222:response:1", lines: ["22222:A:1"] }, { id: "33333:action:1", lines: ["33333:A:1"] }];
    expect(untitledRecords(records, sources)).toEqual(["22222:response:1", "33333:action:1"]);
  });

  it("runs a file whose tests have no id in their titles whole, and says a code with no records has none", { timeout: 120_000 }, () => {
    // 11206:response:1 is tested in a file whose titles lack the line id: `-t` would skip it, so the file runs whole.
    const listed = runLines("11206", "--list");
    expect(listed.status, listed.stderr).toBe(0);
    expect(`${listed.stdout}${listed.stderr}`).toMatch(/drowned-ruins-cards\.test\.ts runs whole/);
    const none = runLines("99999999");
    expect(none.status).toBe(1);
    expect(none.stderr).toMatch(/no card with records, and not a commit/);
    expect(none.stderr).not.toMatch(/git rev-parse/);
  });
});
