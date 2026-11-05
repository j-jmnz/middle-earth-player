// The verbs that carry each flag of verb-flags.ts, read off every top-level instruction schema (the simple verbs of each family and the structural ones in effect-schema.ts). Built on first use.
import { instructionSchema } from "./effect-schema.ts";
import { verbFlagsOf, type CollectionUse, type SetupRole, type SetupRuns } from "./verb-flags.ts";

function verbsWhere(test: (flags: ReturnType<typeof verbFlagsOf>) => boolean): ReadonlySet<string> {
  return new Set(instructionSchema.options.filter((schema) => test(verbFlagsOf(schema))).map((schema) => schema.shape.verb.value));
}

const memo = new Map<string, ReadonlySet<string>>();
function memoized(key: string, build: () => ReadonlySet<string>): ReadonlySet<string> {
  const known = memo.get(key);
  if (known) return known;
  const built = build();
  memo.set(key, built);
  return built;
}

/** The verbs a Shadow effect runs in a frame for. */
export function verbsRunningInFrame(): ReadonlySet<string> {
  return memoized("frame", () => verbsWhere((flags) => flags.runsInFrame === true));
}

/** The verbs that make a quest card's Setup record run, by where the verb stands (see SetupRuns). */
export function setupRunVerbs(runs: SetupRuns): ReadonlySet<string> {
  return memoized(`setup:${runs}`, () => verbsWhere((flags) => flags.setupRuns === runs));
}

/** The verbs a record uses to reach into the player's collection. */
export function collectionVerbs(use: CollectionUse): ReadonlySet<string> {
  return memoized(`collection:${use}`, () => verbsWhere((flags) => flags.collection === use));
}

/** The verbs of a campaign card's Setup that the start deals itself, or resolves after the quest card's Setup (see SetupRole). */
export function setupRoleVerbs(role: SetupRole): ReadonlySet<string> {
  return memoized(`role:${role}`, () => verbsWhere((flags) => flags.setupRole === role));
}
