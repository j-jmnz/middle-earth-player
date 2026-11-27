import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ROOT } from "./tracked.ts";

// A scenario file that lists a researched or recommended reading names the sources it read: a URL, or "agent recommendation" where none settles it
// (.claude/rules/authority.md, Open points). The review of the Haradrim cycle found readings with no sources more than once.
const SCENARIOS = path.join(ROOT, "docs", "scenarios");
const STATUS = /\((?:[^()]*\b)?(?:researched|recommended)\b/;
const SOURCE = /https?:\/\/|agent recommendation/;

function markdownIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? markdownIn(path.join(dir, entry.name)) : entry.name.endsWith(".md") ? [path.join(dir, entry.name)] : []));
}

describe("scenario files name the sources of their readings", () => {
  it("has a URL or an agent recommendation in every file that holds a researched or recommended reading", () => {
    const bare = markdownIn(SCENARIOS)
      .filter((file) => {
        const text = readFileSync(file, "utf8");
        return STATUS.test(text) && !SOURCE.test(text);
      })
      .map((file) => path.relative(ROOT, file));
    expect(bare).toEqual([]);
  });

  it("finds a status with no source", () => {
    expect(STATUS.test("- Random stage (recommended). Basis: the printed line.")).toBe(true);
    expect(SOURCE.test("- Random stage (recommended). Basis: the printed line.")).toBe(false);
    expect(SOURCE.test("Sources read: https://example.com/a")).toBe(true);
  });
});
