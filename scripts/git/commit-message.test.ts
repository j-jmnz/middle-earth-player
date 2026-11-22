import { describe, expect, it } from "vitest";

import { COMMIT_TYPES, SUBJECT_MAX, actionProblem, bodyProblem, hookSubjects, subjectOf, subjectProblem } from "./commit-message.ts";

describe("commit subjects (.claude/rules/commit-standards.md, Subject line)", () => {
  it("accepts every type followed by a summary", () => {
    for (const type of COMMIT_TYPES) expect(subjectProblem(`${type}: Make staging attackers take additional attacks`)).toBeUndefined();
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

  it("refuses a trailing checkpoint marker but not a summary about the game's checkpoint", () => {
    for (const subject of ["feat: Add Helm's Deep Defense keyword, checkpoint", "feat: Build the engine half (checkpoint)", "fix: Record goldens - Checkpoint"]) {
      expect(subjectProblem(subject)).toMatch(/checkpoint marker/);
    }
    expect(subjectProblem("fix: Read the checkpoint written on a pause on Continue")).toBeUndefined();
  });

  it("refuses a summary that is not an action (commit-standards.md, Subject line)", () => {
    for (const subject of ["fix: The table menu scrolls on a short screen", "feat: Each contract shows both sides", "feat: Adds Check now", "fix: Fixed the menu", "feat: Showing both sides", "feat: Settings check for updates"]) {
      expect(subjectProblem(subject)).toMatch(/starts with/);
    }
    for (const summary of ["Scroll the table menu", "Show both sides of a contract", "Bring back the ribbon", "Embed the font", "Speed up the replay", "Focus the first row", "Pass the turn", "Make the release notes list every change", "Keep all changes"]) {
      expect(actionProblem(summary)).toBeUndefined();
    }
  });

  it("reads a message file's subject past blank and comment lines", () => {
    expect(subjectOf("\n# Please enter the commit message\nrepo: Add the hook\n\nBody\n")).toBe("repo: Add the hook");
  });

  it("leaves autosquash and in-progress merge messages to the squash", () => {
    expect(hookSubjects("fixup! feat: Add the deck builder\n", false)).toEqual([]);
    expect(hookSubjects("Merge branch 'main' into topic\n", true)).toEqual([]);
    expect(hookSubjects("Add the deck builder\n", false)).toEqual(["Add the deck builder"]);
  });

  it("refuses a body that links a Claude Code session, outside comment lines", () => {
    // Built from parts so this file holds no link (scripts/checks/private-data.test.ts).
    const link = ["https://claude.ai", "code", "session_01abc"].join("/");
    expect(bodyProblem("repo: Add the hook\n\nBody\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n")).toBeUndefined();
    expect(bodyProblem(`repo: Add the hook\n\nClaude-Session: ${link}\n`)).toContain("names a Claude Code session");
    expect(bodyProblem(`repo: Add the hook\n\nSee ${link}\n`)).toContain("names a Claude Code session");
    expect(bodyProblem(`repo: Add the hook\n# Claude-Session: ${link}\n`)).toBeUndefined();
  });

  it("refuses a GitHub closing keyword before an issue, which would close it at the merge (docs/agents/issue-standards.md, Finish)", () => {
    for (const line of ["Closes #12", "fixes: #12", "This resolved #3 too", "Fixed owner/repo#4"]) expect(bodyProblem(`fix: A\n\n${line}\n`)).toContain("Settles #<n>");
    for (const line of ["Settles #12", "Refs #12", "Prefixes #3", "Fixes the log", "# Closes #12"]) expect(bodyProblem(`fix: A\n\n${line}\n`)).toBeUndefined();
  });
});
