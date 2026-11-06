import { describe, expect, it } from "vitest";

import { renderNotes, type NotesInput } from "./notes.ts";
import { parseCommit } from "./version.ts";

const base: NotesInput = {
  tag: "v0.4.0",
  previousTag: "v0.3.2",
  changes: [
    parseCommit("feat: Lost in Mirkwood is playable (#40)", ""),
    parseCommit("fix: Staging attackers make their additional attacks (#41)", "Breaking: Saves made in 0.3 lose their open scenario"),
    parseCommit("style: The quest card shows its stage number (#42)", ""),
    parseCommit("repo: Refresh the card data (#43)", ""),
    parseCommit("repo: Tidy the brief (#44)", ""),
  ],
  repository: "j-jmnz/middle-earth-lcg",
  catalogVersion: 123,
  engineVersion: 25,
  previousEngineVersion: 25,
};

describe("release notes (.claude/rules/release-standards.md, Release notes)", () => {
  it("lists player-facing commits by section, counts repo commits and links the comparison", () => {
    const notes = renderNotes(base);
    expect(notes).toContain("## Before you update\n\n- Saves made in 0.3 lose their open scenario\n");
    expect(notes).toContain("## New\n\n- Lost in Mirkwood is playable (#40)\n");
    expect(notes).toContain("## Fixes\n\n- Staging attackers make their additional attacks (#41)\n");
    expect(notes).toContain("## Look and feel\n\n- The quest card shows its stage number (#42)\n");
    expect(notes).not.toContain("Under the hood");
    expect(notes).not.toContain("Refresh the card data");
    expect(notes).toContain("Plus 2 project changes");
    expect(notes).toContain("https://github.com/j-jmnz/middle-earth-lcg/compare/v0.3.2...v0.4.0");
    expect(notes.indexOf("Before you update")).toBeLessThan(notes.indexOf("## New"));
  });

  it("warns that an open scenario is dropped when the engine version moved", () => {
    const notes = renderNotes({ ...base, changes: [], previousEngineVersion: 24 });
    expect(notes).toContain("## Before you update\n\n- A scenario left open in an earlier release is dropped");
  });

  it("adds the APK's checksums, and marks the first release without a project count or comparison", () => {
    const apk = { name: "middle-earth-lcg-v0.1.0.apk", sha256: "ab12", certificateSha256: "cd34" };
    const notes = renderNotes({ ...base, tag: "v0.1.0", previousTag: undefined, previousEngineVersion: undefined, apk });
    expect(notes.startsWith("The first release.\n")).toBe(true);
    expect(notes).not.toContain("Plus ");
    expect(notes).not.toContain("compare/");
    expect(notes).toContain("`middle-earth-lcg-v0.1.0.apk` SHA-256: `ab12`");
    expect(notes).toContain("Signing certificate SHA-256: `cd34`");
  });
});
