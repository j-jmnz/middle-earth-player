import { describe, expect, it } from "vitest";

import { COMMIT_TYPES, SUBJECT_MAX, hookSubjects, subjectOf, subjectProblem } from "./commit-message.ts";

describe("commit subjects (.claude/rules/commit-standards.md, Subject line)", () => {
  it("accepts every type followed by a summary", () => {
    for (const type of COMMIT_TYPES) expect(subjectProblem(`${type}: Staging attackers make additional attacks`)).toBeUndefined();
  });

  it("refuses a missing or unknown type, a missing space, an empty summary and a scope", () => {
    for (const subject of ["Add open-source community files", "docs: Tidy the brief", "fix:No space", "fix: ", "Fix: Capital type", "fix(rules): Scoped"]) {
      expect(subjectProblem(subject)).toBeDefined();
    }
  });

  it("refuses a subject over the limit and one ending with a period", () => {
    expect(subjectProblem(`feat: ${"a".repeat(SUBJECT_MAX)}`)).toMatch(/limit/);
    expect(subjectProblem("fix: Close the period.")).toMatch(/period/);
  });

  it("reads a message file's subject past blank and comment lines", () => {
    expect(subjectOf("\n# Please enter the commit message\nrepo: Add the hook\n\nBody\n")).toBe("repo: Add the hook");
  });

  it("leaves autosquash and in-progress merge messages to the squash", () => {
    expect(hookSubjects("fixup! feat: Add the deck builder\n", false)).toEqual([]);
    expect(hookSubjects("Merge branch 'main' into topic\n", true)).toEqual([]);
    expect(hookSubjects("Add the deck builder\n", false)).toEqual(["Add the deck builder"]);
  });
});
