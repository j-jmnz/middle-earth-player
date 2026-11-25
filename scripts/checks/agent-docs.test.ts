import { describe, expect, it } from "vitest";

import {
  AGENT_FILE_BYTES,
  CLAUDE_MD_BUDGET_BYTES,
  RULES_BUDGET_BYTES,
  SECTION_BYTES,
  claudeMdBytes,
  codeCitingStatus,
  copiedParagraphs,
  forbiddenLines,
  largeAgentFiles,
  largeSections,
  missingDocPaths,
  rulesBytes,
  scenarioHeadingsInBrief,
  statusProblems,
} from "./agent-docs.ts";

// The checks of .claude/rules/docs-standards.md (Agent context); each names the fix in its message.

// Sections over SECTION_BYTES today, at their size. None may grow; one split or cut below the limit leaves the list and
// fails here as stale. A new section may not join it: split it under `###` headings (docs-standards.md, The index).
const LARGE_SECTIONS: Readonly<Record<string, number>> = {
  "docs/design-system-table.md#Cards": 100985,
  "docs/scenarios/dream-chaser.md#Dream-chaser": 64878,
};

// Doc paths that may name a file that does not exist: test fixtures of `pnpm move`, and the desktop comment issue #181
// holds until a desktop change may touch it (scripts/checks/phone-files.test.ts).
const MISSING_ALLOWED: readonly string[] = [
  ".claude/rules/release-standards.md ← desktop/identity.ts",
  "docs/a.md ← scripts/tools/move.test.ts",
  "docs/phases/done/phase-01.md ← scripts/tools/move.test.ts",
  "docs/phases/phase-01.md ← scripts/tools/move.test.ts",
];

// The code that may name STATUS: the docs index lists it, and the move tests use it as a fixture.
const STATUS_CITERS: readonly string[] = ["scripts/docs/index.ts", "scripts/tools/move.test.ts"];

describe("agent context", () => {
  it(`keeps .claude/rules/ within ${RULES_BUDGET_BYTES} bytes and CLAUDE.md within ${CLAUDE_MD_BUDGET_BYTES} (every session loads them)`, () => {
    expect(rulesBytes(), "to add a rule every session needs, cut or move another; a rule few tasks need goes to docs/agents/").toBeLessThanOrEqual(RULES_BUDGET_BYTES);
    expect(claudeMdBytes(), "CLAUDE.md points to the docs; it does not hold them").toBeLessThanOrEqual(CLAUDE_MD_BUDGET_BYTES);
  });

  it(`keeps each agent file within ${AGENT_FILE_BYTES} bytes`, () => {
    expect(largeAgentFiles(), "an agent file says only what is that agent's own and points to the rule that owns the rest").toEqual({});
  });

  it(`grows no section past ${SECTION_BYTES} bytes, and the listed ones not past their size`, () => {
    const found = largeSections();
    const grown = Object.entries(found).filter(([key, size]) => size > (LARGE_SECTIONS[key] ?? SECTION_BYTES)).map(([key, size]) => `${key} ${size}`);
    expect(grown, "split the section under ### headings so `pnpm doc section` can give a part of it").toEqual([]);
    const stale = Object.keys(LARGE_SECTIONS).filter((key) => found[key] === undefined);
    expect(stale, "these are back under the limit: delete them from LARGE_SECTIONS").toEqual([]);
  });

  it("keeps docs/phases/STATUS.md to pointers: Open items are pointers to users' issues", () => {
    expect(statusProblems()).toEqual([]);
  });

  it("keeps scenario sections out of docs/brief.md (a scenario's rulings are in its own file in docs/scenarios/<box>/)", () => {
    expect(scenarioHeadingsInBrief()).toEqual([]);
  });

  it("writes no paragraph twice: say it once in the doc that owns it and point to it", () => {
    expect(copiedParagraphs()).toEqual([]);
  });

  it("keeps rules in their owners: agent files do not repeat a rule or read the loaded files again", () => {
    expect(forbiddenLines()).toEqual([]);
  });

  it("names only docs that exist", () => {
    const missing = missingDocPaths();
    expect(missing.filter((item) => !MISSING_ALLOWED.includes(item)), "a moved or deleted doc: move files with `pnpm move`, which rewrites the paths").toEqual([]);
    expect(MISSING_ALLOWED.filter((item) => !missing.includes(item)), "fixed: delete it from MISSING_ALLOWED").toEqual([]);
  });

  it("names the issue, not STATUS, for an open item in code", () => {
    expect(codeCitingStatus().filter((file) => !STATUS_CITERS.includes(file))).toEqual([]);
  });
});
