import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ROOT } from "./tracked.ts";

// A release is only ever started by hand (.claude/rules/release-standards.md, Who releases): release.yml and the EAS e2e workflow
// run on workflow_dispatch alone, and no other workflow makes a tag or a GitHub release.
const GITHUB = path.join(ROOT, ".github", "workflows");
const EAS = path.join(ROOT, ".eas", "workflows");

function workflows(dir: string): string[] {
  return readdirSync(dir).filter((name) => /\.ya?ml$/.test(name)).map((name) => path.join(dir, name));
}

/** The event names under a workflow's top-level `on:` block (the keys indented one level below it). */
function triggers(file: string): string[] {
  const lines = readFileSync(file, "utf8").split("\n");
  const start = lines.findIndex((line) => /^on:\s*$/.test(line));
  if (start < 0) return [];
  const block = lines.slice(start + 1);
  const end = block.findIndex((line) => /^\S/.test(line));
  return (end < 0 ? block : block.slice(0, end)).flatMap((line) => /^ {2}([a-z_]+):/.exec(line)?.[1] ?? []);
}

describe("release trigger", () => {
  it("starts release.yml by hand only", () => {
    expect(triggers(path.join(GITHUB, "release.yml"))).toEqual(["workflow_dispatch"]);
  });

  it("starts the EAS e2e workflow by hand only", () => {
    expect(triggers(path.join(EAS, "e2e.yml"))).toEqual(["workflow_dispatch"]);
  });

  it("makes tags and GitHub releases only in release.yml", () => {
    const others = workflows(GITHUB).filter((file) => path.basename(file) !== "release.yml");
    const releasing = others.filter((file) => /gh release|git tag|git push[^\n]*--tags|action-gh-release/.test(readFileSync(file, "utf8")));
    expect(releasing.map((file) => path.basename(file))).toEqual([]);
  });
});
