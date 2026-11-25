import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import path from "node:path";

import { GOLDEN_PINS } from "../../test/harness/golden-pins.ts";
import { seedFinderReads } from "../../test/harness/golden-readers.ts";

// The golden names of a scenario, read from its golden.json (the registry is not imported here: test-cost.test.ts).
const names = (scenarioId: string): string[] => {
  try {
    return (JSON.parse(readFileSync(path.resolve(import.meta.dirname, "..", "..", "src", "campaign", "scenarios", scenarioId, "golden.json"), "utf8")) as { name?: string }[]).flatMap((row) => (row.name ? [row.name] : []));
  } catch {
    return [];
  }
};

// The seed finders and fixture writers under scripts/e2e do not run in the suite; `pnpm scenario fixtures` runs them. A golden one of them reads with
// `goldenState` must be pinned (test/harness/golden-pins.ts), or the writer fails when someone runs it.
describe("golden pins", () => {
  const reads = seedFinderReads();

  it("finds the goldens the seed finders read", () => {
    expect(reads.length).toBeGreaterThan(10);
  });

  it("pins every golden a seed finder reads", () => {
    const unpinned = reads.filter(([scenarioId, name]) => !(GOLDEN_PINS[scenarioId] ?? []).includes(name)).map(([scenarioId, name, file]) => `${file} reads ${scenarioId} "${name}"`);
    expect(unpinned, "add each to GOLDEN_PINS (test/harness/golden-pins.ts) and write its golden.json again (docs/agents/agent-brief.md, Scenario procedure)").toEqual([]);
  });

  it("names, in every seed finder read and every pin, a golden of its golden.json", () => {
    expect(reads.filter(([scenarioId, name]) => !names(scenarioId).includes(name)).map(([scenarioId, name]) => `${scenarioId} "${name}"`)).toEqual([]);
    const stale = Object.entries(GOLDEN_PINS).flatMap(([scenarioId, pins]) => pins.filter((name) => !names(scenarioId).includes(name)).map((name) => `${scenarioId} "${name}"`));
    expect(stale).toEqual([]);
  });
});
