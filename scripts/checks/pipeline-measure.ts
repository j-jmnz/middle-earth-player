import { spawnSync } from "node:child_process";

import { ROOT } from "./tracked.ts";

// A scenario phase records its measures in the body of its last commit after a line `Pipeline measure:` (docs/agents/agent-brief.md, Measure). The commits of a branch since its merge
// base with origin/main must hold that line when the branch adds a scenario to PLAYABLE_SCENARIOS (src/campaign/playable.ts); the check is scripts/checks/pipeline-measure.test.ts.

const PLAYABLE_FILE = "src/campaign/playable.ts";

/** The scenario ids in the PLAYABLE_SCENARIOS array of the source of src/campaign/playable.ts. */
export function playableIn(source: string): string[] {
  const list = /PLAYABLE_SCENARIOS\s*:\s*readonly string\[\]\s*=\s*\[([^\]]*)\]/.exec(source)?.[1] ?? "";
  return [...list.matchAll(/"([^"]+)"/g)].map((match) => match[1] ?? "");
}

/** The ids the head's list has and the base's list has not. */
export function addedScenarios(baseSource: string, headSource: string): string[] {
  const had = new Set(playableIn(baseSource));
  return playableIn(headSource).filter((id) => !had.has(id));
}

/** Whether a commit body of the branch has a `Pipeline measure:` line. */
export function hasPipelineMeasure(bodies: readonly string[]): boolean {
  return bodies.some((body) => /^Pipeline measure:/m.test(body));
}

function git(args: readonly string[]): { ok: boolean; out: string } {
  const run = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  return { ok: run.status === 0, out: run.stdout };
}

export type Branch = { base: string; added: string[]; bodies: string[] };

/**
 * The merge base of HEAD with origin/main, the scenarios the branch's commits add to PLAYABLE_SCENARIOS and the commit bodies, or null when the merge base cannot be found (no origin/main
 * ref, or a shallow checkout that does not reach it). On main itself the range is empty.
 */
export function branchSince(): Branch | null {
  const merged = git(["merge-base", "HEAD", "origin/main"]);
  const base = merged.out.trim();
  if (!merged.ok || base === "") return null;
  const baseSource = git(["show", `${base}:${PLAYABLE_FILE}`]);
  const headSource = git(["show", `HEAD:${PLAYABLE_FILE}`]);
  if (!baseSource.ok || !headSource.ok) return null;
  const log = git(["log", "--format=%B%x00", `${base}..HEAD`]);
  return { base, added: addedScenarios(baseSource.out, headSource.out), bodies: log.out.split("\0").map((body) => body.trim()).filter(Boolean) };
}
