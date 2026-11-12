import type { EngineChange } from "../../src/rules/engine/version.ts";

// Which scenarios' open games a release can reach (.claude/rules/release-standards.md, Release notes). Pure: plan.ts reads git.
// A game is reached when a golden of its scenario now has other checks (src/campaign/digest.ts: the digest of the table after each
// move, pinned in golden.json) than at the previous release, or when ENGINE_CHANGES names it after the previous release's engine version.

/** What a scenario's golden.json pins of its checks: each golden's name and checks. */
export type GoldenChecks = readonly { name: string; checks?: readonly number[] }[];

export type Reach = { all: boolean; scenarios: readonly string[] };

const keyOf = (goldens: GoldenChecks): string | undefined => (goldens.every((golden) => golden.checks) ? JSON.stringify(goldens.map((golden) => [golden.name, golden.checks])) : undefined);

/** A scenario with no goldens at the previous release is new, so no game of it is open; one whose goldens had no checks then is compared by ENGINE_CHANGES only. */
export function reachedScenarios(input: {
  previousEngineVersion: number | undefined;
  engineChanges: readonly EngineChange[];
  previous: ReadonlyMap<string, GoldenChecks>;
  current: ReadonlyMap<string, GoldenChecks>;
}): Reach {
  const reached = new Set<string>();
  let all = false;
  for (const change of input.engineChanges) {
    if (input.previousEngineVersion === undefined || change.version <= input.previousEngineVersion) continue;
    if (change.scenarios === "all") all = true;
    else for (const id of change.scenarios) reached.add(id);
  }
  for (const [id, goldens] of input.current) {
    const before = input.previous.get(id);
    const now = keyOf(goldens);
    const then = before ? keyOf(before) : undefined;
    if (now !== undefined && then !== undefined && now !== then) reached.add(id);
  }
  return { all, scenarios: [...reached].sort() };
}

/** "A", "A and B", "A, B and C". */
export function joinNames(names: readonly string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
