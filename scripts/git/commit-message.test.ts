import { describe, expect, it } from "vitest";

import { COMMIT_TYPES, SUBJECT_MAX, subjectProblem } from "./commit-message.ts";

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
});
