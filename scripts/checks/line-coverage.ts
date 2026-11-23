import { readFileSync } from "node:fs";
import path from "node:path";

import type { Effect } from "../../src/catalog/boundary.ts";

import { ROOT, tracked } from "./tracked.ts";

// What scripts/checks/line-coverage.test.ts and `pnpm test scenario <id>` (scripts/tools/test-scenario.ts, the records part) read: the record ids and the printed line ids that the test files name.

/** Record ids with no test, each with the reason no test can show it. */
export const EXEMPT: Readonly<Record<string, string>> = {};

// A record id (01026:action:1) or a printed line id (01026:A:1), as a whole token.
const NAME = /(?<![\w:])(\d{2,6}:[A-Za-z]+:\d+)(?![\w])/g;

/** Every record id and line id that a test file names. */
export function namedInTests(): Set<string> {
  const named = new Set<string>();
  const files = tracked(["src", "test"]).filter((file) => /\.(ts|tsx)$/.test(file) && (file.startsWith("test/") || /\.test\.tsx?$/.test(file)));
  for (const file of files) for (const found of readFileSync(path.join(ROOT, file), "utf8").matchAll(NAME)) named.add(found[1]!);
  return named;
}

/** The ids of the records that no test names (by the record's id or by one of its lines), each once. */
export function unnamedRecords(effects: readonly Effect[], named: ReadonlySet<string>): string[] {
  return [...new Set(effects.filter((effect) => !named.has(effect.id) && !effect.lines.some((line) => named.has(line))).map((effect) => effect.id))];
}
