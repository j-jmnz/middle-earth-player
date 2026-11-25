import { describe, expect, it } from "vitest";

import { addedSharedLines, branchRows, isSharedEngine, parseNumstat, SHARED_ENGINE_LIMIT, sharedEngineProblems } from "./shared-engine.ts";

// The lines a branch adds to shared engine code stay at or under the limit unless a commit body says why (docs/agents/cycle-procedure.md, Design note for a new system). The commits are
// read from the merge base with origin/main; on main itself the range is empty, and a checkout that cannot reach the merge base skips the check with a notice.

const over = [{ added: SHARED_ENGINE_LIMIT + 1, file: "src/rules/core/zones.ts" }];

describe("shared engine: the rule", () => {
  it("passes a branch at or under the limit", () => {
    expect(sharedEngineProblems({ rows: [{ added: SHARED_ENGINE_LIMIT, file: "src/rules/core/zones.ts" }], bodies: ["feat: Add a scenario"] })).toEqual([]);
    expect(sharedEngineProblems({ rows: [], bodies: [] })).toEqual([]);
  });

  it("refuses a branch over the limit with no Shared engine line, and names the largest files", () => {
    const problems = sharedEngineProblems({ rows: [...over, { added: 5, file: "src/catalog/boundary.ts" }], bodies: ["feat: Add a scenario\n\nBody."] });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("src/rules/core/zones.ts +41");
  });

  it("passes a branch over the limit when a commit body has the line with a reason of 10 characters", () => {
    expect(sharedEngineProblems({ rows: over, bodies: ["feat: One", "feat: Two\n\nShared engine: the first hook of the cycle's family"] })).toEqual([]);
    expect(sharedEngineProblems({ rows: over, bodies: ["feat: Two\n\nShared engine: too short"] })).toHaveLength(1);
    expect(sharedEngineProblems({ rows: over, bodies: ["feat: Two\n\nSee Shared engine: the first hook of the family"] })).toHaveLength(1);
  });

  it("ignores test files and family files, and counts a new file", () => {
    expect(isSharedEngine("src/rules/core/zones.test.ts")).toBe(false);
    expect(isSharedEngine("src/rules/families/hidden/index.ts")).toBe(false);
    expect(isSharedEngine("src/catalog/families/hidden.ts")).toBe(false);
    expect(isSharedEngine("src/catalog/boundary.ts")).toBe(true);
    expect(isSharedEngine("src/effects/authored/x.ts")).toBe(false);
    const rows = [
      { added: 500, file: "src/rules/core/zones.test.ts" },
      { added: 500, file: "src/rules/families/hidden/index.ts" },
      { added: 500, file: "src/catalog/families/hidden.ts" },
      { added: 30, file: "src/rules/core/brand-new.ts" },
    ];
    expect(addedSharedLines(rows)).toBe(30);
    expect(sharedEngineProblems({ rows, bodies: [] })).toEqual([]);
  });

  it("reads git numstat output, a binary file as 0 lines", () => {
    expect(parseNumstat("3\t1\tsrc/rules/a.ts\n-\t-\tassets/x.png\n\n")).toEqual([
      { added: 3, file: "src/rules/a.ts" },
      { added: 0, file: "assets/x.png" },
    ]);
  });
});

const branch = branchRows();
if (branch === null) console.info("shared engine: the merge base with origin/main cannot be found (no origin/main ref, or a shallow checkout), so the commits are not read");

describe("shared engine: this branch", () => {
  it.skipIf(branch === null)("adds at most the limit to shared engine code, or a commit body gives the reason", () => {
    const { rows = [], bodies = [] } = branch ?? {};
    expect(sharedEngineProblems({ rows, bodies })).toEqual([]);
  });
});
