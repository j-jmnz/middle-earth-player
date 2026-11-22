import { describe, expect, it } from "vitest";

import { branchProblem, bumpOf, nextVersion, parseCommit, parseTag, tagOf, type Change } from "./version.ts";

const change = (subject: string, body = ""): Change => parseCommit(subject, body);

describe("release versions (docs/agents/release-standards.md, Versioning)", () => {
  it("reads and writes release tags only in v<major>.<minor>.<patch>", () => {
    expect(parseTag("v1.20.3")).toEqual({ major: 1, minor: 20, patch: 3 });
    for (const tag of ["1.2.3", "v1.2", "v01.2.3", "v1.2.3-rc.1"]) expect(parseTag(tag)).toBeUndefined();
    expect(tagOf({ major: 0, minor: 4, patch: 0 })).toBe("v0.4.0");
  });

  it("reads a commit's type, summary and Breaking lines", () => {
    expect(change("feat: Lost in Mirkwood is playable (#40)", "Body.\n\nBreaking: Saves from 0.3 open with no scenario\n")).toEqual({
      type: "feat",
      summary: "Lost in Mirkwood is playable (#40)",
      breaking: ["Saves from 0.3 open with no scenario"],
      closes: [],
      refs: [],
    });
    expect(change("README: add an Accessibility section").type).toBeUndefined();
  });

  it("reads the issues a body closes and the ones it refers to (docs/agents/issue-standards.md, Finish)", () => {
    const body = "Summary.\n\nSettles #11\nCloses #12\nfixes: #13, #14\nResolved #15 and #16\nRefs #17 #12\nThis line names #18 in passing.\n";
    expect(change("fix: A (#41)", body)).toMatchObject({ closes: [11, 12, 13, 14, 15, 16], refs: [17] });
    expect(change("fix: A", "Prefixes #3\nCloses issue 4")).toMatchObject({ closes: [], refs: [] });
  });

  it("bumps major for a Breaking line, minor for a feat, patch for a fix, style or refactor, and nothing for repo alone", () => {
    expect(bumpOf([change("fix: A", "Breaking: Saves reset")])).toBe("major");
    expect(bumpOf([change("fix: A"), change("feat: B")])).toBe("minor");
    for (const type of ["fix", "style", "refactor"]) expect(bumpOf([change(`${type}: A`), change("repo: B")])).toBe("patch");
    expect(bumpOf([change("repo: A"), change("Untyped")])).toBeUndefined();
  });

  it("starts at 0.1.0, keeps an automatic major bump minor before 1.0.0, and takes an asked bump as given", () => {
    expect(nextVersion(undefined, [], "auto")).toEqual({ major: 0, minor: 1, patch: 0 });
    expect(nextVersion(undefined, [], "major")).toEqual({ major: 1, minor: 0, patch: 0 });
    const breaking = [change("fix: A", "Breaking: Saves reset")];
    expect(nextVersion({ major: 0, minor: 3, patch: 2 }, breaking, "auto")).toEqual({ major: 0, minor: 4, patch: 0 });
    expect(nextVersion({ major: 1, minor: 3, patch: 2 }, breaking, "auto")).toEqual({ major: 2, minor: 0, patch: 0 });
    expect(nextVersion({ major: 0, minor: 3, patch: 2 }, [change("repo: A")], "auto")).toBeUndefined();
    expect(nextVersion({ major: 0, minor: 3, patch: 2 }, [change("repo: A")], "patch")).toEqual({ major: 0, minor: 3, patch: 3 });
    expect(nextVersion({ major: 0, minor: 3, patch: 2 }, [], "major")).toEqual({ major: 1, minor: 0, patch: 0 });
  });

  it("cuts releases from main, and only matching patches from a release branch", () => {
    expect(branchProblem("main", { major: 0, minor: 4, patch: 0 })).toBeUndefined();
    expect(branchProblem("release/v0.3", { major: 0, minor: 3, patch: 3 })).toBeUndefined();
    expect(branchProblem("release/v0.3", { major: 0, minor: 4, patch: 0 })).toBeDefined();
    expect(branchProblem("fix/staging-attacks", { major: 0, minor: 4, patch: 0 })).toBeDefined();
  });
});
