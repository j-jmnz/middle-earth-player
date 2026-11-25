import { addedScenarios, hasPipelineMeasure } from "../checks/pipeline-measure.ts";
import { sharedEngineProblems, type BranchCommit, type NumstatRow } from "../checks/shared-engine.ts";

// What the commits of a whole branch must hold, beyond what each message is held to (scripts/git/commit-message.ts reads a range with these). The CI job that checks a pull
// request's commits has the full history, so these run there, where the shard jobs' shallow checkout skips scripts/checks/pipeline-measure.test.ts.

/** The engine and the authored records: a change here can make a card play wrong for every scenario that deals it, and each review of such a change has found a fault its own tests passed. */
const REVIEWED_PATHS = /^src\/(rules\/|effects\/authored\/)/;
const TEST_FILE = /\.test\.tsx?$/;
/** `Reviewed: <who read the diff and what they looked at>`, at the start of a line of a commit body. */
const REVIEWED = /^Reviewed: \S.{9,}/m;

/** The changed files a review must have read: engine and record code, not their tests. */
export function reviewedFiles(changed: readonly string[]): string[] {
  return changed.filter((file) => REVIEWED_PATHS.test(file) && !TEST_FILE.test(file));
}

export type Range = {
  /** The files that differ between the merge base and the head. */
  changed: readonly string[];
  /** The whole message of each commit of the range, merges left out. */
  bodies: readonly string[];
  /** The source of src/campaign/playable.ts at the merge base and at the head. */
  playable: { base: string; head: string };
  /** The `git diff --numstat` rows between the merge base and the head; left out, the shared engine rule is not read. */
  numstat?: readonly NumstatRow[];
  /** Each commit's message with its own numstat rows: the `Shared engine:` reason counts only from a commit that touches shared engine code. Left out, every body counts as such a commit. */
  commits?: readonly BranchCommit[];
};

/** What a branch's commits lack: a `Reviewed:` line when engine or record code changed, a `Pipeline measure:` line when a scenario became playable, a `Shared engine:` line when the branch adds more than the limit to shared engine code (scripts/checks/shared-engine.ts). */
export function rangeProblems(range: Range): string[] {
  const problems: string[] = [];
  const engine = reviewedFiles(range.changed);
  if (engine.length > 0 && !range.bodies.some((body) => REVIEWED.test(body)))
    problems.push(
      `the branch changes ${engine.length} engine or record files (${engine.slice(0, 3).join(", ")}${engine.length > 3 ? ", ..." : ""}) and no commit body has a "Reviewed: <who read the diff and what they looked at>" line: run the reviewer on the diff (docs/agents/card-audit.md, Fix and review) and record it in the commit that closes the review`,
    );
  const added = addedScenarios(range.playable.base, range.playable.head);
  if (added.length > 0 && !hasPipelineMeasure(range.bodies))
    problems.push(`${added.join(", ")} added to PLAYABLE_SCENARIOS and no commit body has a "Pipeline measure:" line (docs/agents/agent-brief.md, Measure)`);
  if (range.numstat) problems.push(...sharedEngineProblems({ rows: range.numstat, commits: range.commits ?? range.bodies.map((body) => ({ body, rows: range.numstat ?? [] })) }));
  return problems;
}
