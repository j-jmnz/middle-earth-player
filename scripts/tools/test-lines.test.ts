import { describe, expect, it } from "vitest";

import { changedRecords, chooseTests, namePattern, TEST_LINES_USAGE } from "./test-lines.ts";

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
});
