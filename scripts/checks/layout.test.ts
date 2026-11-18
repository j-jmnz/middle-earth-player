import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ROOT, tracked } from "./tracked.ts";

// The repository's layout (docs/architecture.md, Repository map): no folder grows into a pile, each mechanic family is
// one folder, and every folder named for a scenario is named by its id in data/scenarios. Move files with pnpm move.

// More source files than this in one folder (tests aside) and it wants subfolders.
const MOST_FILES = 40;
// Folders that are a list by design: one record file per product pack, named by its pack code; one vocabulary file per mechanic family, named as its folder in src/rules/families.
const LISTS = new Set(["src/effects/authored/pool", "src/catalog/families"]);

function folders(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir)).filter((name) => statSync(path.join(ROOT, dir, name)).isDirectory()).sort();
}

const scenarioIds = new Set(readdirSync(path.join(ROOT, "data/scenarios")).filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -".json".length)));

describe("repository layout", () => {
  it(`keeps every source folder to ${MOST_FILES} files, tests aside`, () => {
    const counts = new Map<string, number>();
    for (const file of tracked()) {
      if (!/\.(ts|tsx|js)$/.test(file) || /\.test\.tsx?$/.test(file)) continue;
      const dir = path.posix.dirname(file);
      counts.set(dir, (counts.get(dir) ?? 0) + 1);
    }
    const piles = [...counts].filter(([dir, count]) => count > MOST_FILES && !LISTS.has(dir)).map(([dir, count]) => `${dir}: ${count}`);
    expect(piles).toEqual([]);
  });

  it("keeps each mechanic family in a folder of src/rules/families named as in src/catalog/families", () => {
    const families = readdirSync(path.join(ROOT, "src/catalog/families")).filter((name) => name.endsWith(".ts") && name !== "index.ts" && !name.endsWith(".test.ts")).map((name) => name.slice(0, -3)).sort();
    const loose = readdirSync(path.join(ROOT, "src/rules/families")).filter((name) => name !== "index.ts" && !statSync(path.join(ROOT, "src/rules/families", name)).isDirectory());
    expect(loose).toEqual([]);
    expect(folders("src/rules/families")).toEqual(families);
  });

  it("names every scenario folder by a scenario id in data/scenarios", () => {
    const strays = ["src/campaign/scenarios", "test/scenarios"].flatMap((dir) => folders(dir).filter((name) => !scenarioIds.has(name)).map((name) => `${dir}/${name}`));
    expect(strays).toEqual([]);
  });
});
