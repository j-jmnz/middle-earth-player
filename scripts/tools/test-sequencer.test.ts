import path from "node:path";

import { describe, expect, it } from "vitest";
import type { TestSpecification, Vitest } from "vitest/node";

import { heavyFirst } from "./test-sequencer.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const SLOW = ["scripts/card-smoke/**", "src/play/compiler.test.ts"];

// Real files, so Vitest's own sort can read their sizes: two heavy (a smoke shard and a golden), the rest light.
const FILES = [
  "scripts/tools/test-sequencer.test.ts",
  "scripts/card-smoke/suite-1.test.ts",
  "src/campaign/scenarios/a-shadow-of-the-past/golden.test.ts",
  "src/play/compiler.test.ts",
  "scripts/docs/index.test.ts",
  "src/campaign/fixtures.test.ts",
  "scripts/tools/move.test.ts",
];
const HEAVY = new Set(FILES.slice(1, 4));

const project = { name: "", config: { sequence: { groupOrder: 0 }, isolate: false } };
const specs = FILES.map((file) => ({ moduleId: path.join(ROOT, file), project }) as unknown as TestSpecification);
const fileOf = (spec: TestSpecification) => path.relative(ROOT, spec.moduleId);

function sequencer(timed: ReadonlyMap<string, number>, shard?: { index: number; count: number }) {
  const results = (spec: TestSpecification) => {
    const duration = timed.get(fileOf(spec));
    return duration === undefined ? undefined : { duration, failed: false };
  };
  const ctx = { config: { root: ROOT, shard }, cache: { getTestSpecificationResult: results } } as unknown as Vitest;
  return new (heavyFirst(SLOW))(ctx);
}

describe("the test sequencer", () => {
  it("runs the slow files and the goldens first when a file has no timing from an earlier run", async () => {
    const order = (await sequencer(new Map()).sort(specs)).map(fileOf);
    expect(new Set(order.slice(0, HEAVY.size))).toEqual(HEAVY);
    expect(order).toHaveLength(FILES.length);
  });

  it("keeps Vitest's longest-first order when every file has a timing", async () => {
    const timed = new Map(FILES.map((file, at) => [file, at]));
    const order = (await sequencer(timed).sort(specs)).map(fileOf);
    expect(order).toEqual([...FILES].reverse());
  });

  it("puts every file in exactly one shard and deals the heavy ones to every shard", async () => {
    const count = 3;
    const shards = await Promise.all(Array.from({ length: count }, (_, at) => sequencer(new Map(), { index: at + 1, count }).shard(specs)));
    const files = shards.flat().map(fileOf);
    expect(files.toSorted()).toEqual(FILES.toSorted());
    for (const shard of shards) expect(shard.map(fileOf).filter((file) => HEAVY.has(file))).toHaveLength(1);
  });
});
