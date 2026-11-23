import type { Effect } from "../../src/catalog/boundary.ts";

// What scripts/checks/line-coverage.test.ts and `pnpm test scenario <id>` (scripts/tools/test-scenario.ts, the records part) read: the records that the test files (namedInTests, tracked.ts) do not name.

/** Record ids with no test, each with the reason no test can show it. */
export const EXEMPT: Readonly<Record<string, string>> = {};

/** The ids of the records that no test names (by the record's id or by one of its lines), each once. */
export function unnamedRecords(effects: readonly Effect[], named: ReadonlySet<string>): string[] {
  return [...new Set(effects.filter((effect) => !named.has(effect.id) && !effect.lines.some((line) => named.has(line))).map((effect) => effect.id))];
}
