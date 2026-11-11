import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ROOT, tracked } from "./tracked.ts";

// A source file, tracked or new and not ignored, stays at or under MOST_LINES (counted as `wc -l` does: newline characters). The files over it today are listed at their
// current counts: one may not grow, and an entry whose file is back under the limit is stale and goes. Move files with pnpm move.
const MOST_LINES = 500;

// Generated files are exempt: pnpm data build and pnpm effects open write them.
const GENERATED = ["src/effects/generated/", "src/effects/open-lines.ts", "src/ui/icons/", "src/catalog/version.ts"];

const OVER_LIMIT: Readonly<Record<string, number>> = {
  "src/effects/authored/families/sidequests.ts": 899,
  "src/rules/combat/combat.test.ts": 598,
  "src/play/layout/layout.test.ts": 584,
  "src/screens/images/queue.native.ts": 548,
  "src/campaign/fixtures.test.ts": 508,
  "src/play/choice/table-choice.test.ts": 503,
  "src/effects/authored/raid-on-the-grey-havens.ts": 501,
};

function lineCount(file: string): number {
  return readFileSync(path.join(ROOT, file), "utf8").split("\n").length - 1;
}

const sources = tracked().filter((file) => /\.tsx?$/.test(file) && !GENERATED.some((prefix) => file.startsWith(prefix)));
const counts = new Map(sources.map((file) => [file, lineCount(file)]));

describe("file size", () => {
  it(`keeps every source file at or under ${MOST_LINES} lines, the listed ones at their count`, () => {
    const over = [...counts]
      .filter(([file, lines]) => lines > (OVER_LIMIT[file] ?? MOST_LINES))
      .map(([file, lines]) => `${file}: ${lines} lines, at most ${OVER_LIMIT[file] ?? MOST_LINES}`);
    expect(over).toEqual([]);
  });

  it("lists each file in OVER_LIMIT at its count, not above it", () => {
    const loose = Object.entries(OVER_LIMIT).filter(([file, limit]) => (counts.get(file) ?? 0) > MOST_LINES && (counts.get(file) ?? 0) < limit).map(([file, limit]) => `${file}: ${counts.get(file)} lines, listed at ${limit}`);
    expect(loose, "lower the entry to the count").toEqual([]);
  });

  it("lists in OVER_LIMIT only files that are still over the limit", () => {
    const stale = Object.keys(OVER_LIMIT).filter((file) => (counts.get(file) ?? 0) <= MOST_LINES).map((file) => `${file}: ${counts.get(file) ?? "missing"} lines`);
    expect(stale, "remove the entry").toEqual([]);
  });
});
