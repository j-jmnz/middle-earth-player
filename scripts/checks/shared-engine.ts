import { spawnSync } from "node:child_process";

import { ROOT } from "./tracked.ts";

// A scenario adds its mechanics to the cycle's family (docs/agents/cycle-procedure.md, Design of a new system); what it adds to shared engine code stays small. Shared engine code is
// src/rules and src/catalog outside their `families/` folders. The net lines a branch adds there (git numstat added minus deleted over all shared files together, never below 0, tests and
// the test helpers below left out) stay at or under SHARED_ENGINE_LIMIT unless a commit of the branch that itself touches shared engine code has `Shared engine: <reason>` in its body.
// The numbers that set the limit are in the commit message that added it.

export const SHARED_ENGINE_LIMIT = 40;

/** One row of `git diff --numstat`: the lines added to a file and the lines deleted from it (0 for a binary file; a row without `deleted` deleted none). */
export type NumstatRow = { added: number; deleted?: number; file: string };
/** A commit of the branch: its whole message and the rows of its own numstat. */
export type BranchCommit = { body: string; rows: readonly NumstatRow[] };

/** `Shared engine: <reason>` at the start of a line of a commit body, the reason at least 10 characters. */
const SHARED_REASON = /^Shared engine: \S.{9,}/m;
const TEST_FILE = /\.test\.tsx?$/;
/** Test helpers that live beside engine code and are not engine code: the shared files the rule does not count. */
const TEST_HELPERS: ReadonlySet<string> = new Set(["src/rules/core/test-fixture.ts", "src/rules/quest/test-frame.ts"]);

/** Whether a file is shared engine code: under src/rules or src/catalog, and not in a family's own folder, a test or a test helper. */
export function isSharedEngine(file: string): boolean {
  if (TEST_FILE.test(file) || TEST_HELPERS.has(file)) return false;
  return (/^src\/rules\//.test(file) && !/^src\/rules\/families\//.test(file)) || (/^src\/catalog\//.test(file) && !/^src\/catalog\/families\//.test(file));
}

const net = (row: NumstatRow): number => row.added - (row.deleted ?? 0);

/** The net lines the rows add to shared engine code: added minus deleted over all its files together, so a split of one file into two adds nothing; never below 0. */
export function addedSharedLines(rows: readonly NumstatRow[]): number {
  return Math.max(0, rows.filter((row) => isSharedEngine(row.file)).reduce((sum, row) => sum + net(row), 0));
}

/** The rows of `git diff --numstat` output; a binary file's `-` counts 0. */
export function parseNumstat(text: string): NumstatRow[] {
  return text.split("\n").flatMap((line) => {
    const [added = "", deleted = "", ...file] = line.split("\t");
    return file.length === 0 ? [] : [{ added: Number(added) || 0, deleted: Number(deleted) || 0, file: file.join("\t") }];
  });
}

/** What a branch lacks when it adds more than the limit to shared engine code and no commit that touches shared engine code gives the reason. */
export function sharedEngineProblems(range: { rows: readonly NumstatRow[]; commits: readonly BranchCommit[] }): string[] {
  const added = addedSharedLines(range.rows);
  const touches = (commit: BranchCommit): boolean => commit.rows.some((row) => isSharedEngine(row.file));
  if (added <= SHARED_ENGINE_LIMIT || range.commits.some((commit) => touches(commit) && SHARED_REASON.test(commit.body))) return [];
  const files = range.rows.filter((row) => isSharedEngine(row.file) && net(row) > 0).sort((a, b) => net(b) - net(a)).slice(0, 3).map((row) => `${row.file} +${net(row)}`);
  return [
    `the branch adds ${added} lines to shared engine code (limit ${SHARED_ENGINE_LIMIT}; ${files.join(", ")}): put the mechanic in the cycle's family behind one hook, or give the reason in the body of a commit that changes shared engine code, as a line "Shared engine: <reason>" (docs/agents/cycle-procedure.md, Design of a new system). A stacked branch counts the lines of the branch it starts from until that one merges`,
  ];
}

/** The commits of `git log --no-merges --format=%x01%B%x02 --numstat`: each message with the rows of its own numstat. */
export function parseCommits(text: string): BranchCommit[] {
  return text.split("\x01").flatMap((chunk) => {
    const [body = "", stats = ""] = chunk.split("\x02");
    return body.trim() === "" ? [] : [{ body: body.trim(), rows: parseNumstat(stats) }];
  });
}

export const COMMIT_LOG_ARGS = ["log", "--no-merges", "--no-renames", "--format=%x01%B%x02", "--numstat"] as const;

function git(args: readonly string[]): { ok: boolean; out: string } {
  const run = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { ok: run.status === 0, out: run.stdout };
}

/** The rows and commits of HEAD since its merge base with origin/main, or null when the merge base cannot be found (no origin/main ref, or a shallow checkout that does not reach it). */
export function branchRows(): { rows: NumstatRow[]; commits: BranchCommit[] } | null {
  const merged = git(["merge-base", "HEAD", "origin/main"]);
  const base = merged.out.trim();
  if (!merged.ok || base === "") return null;
  const diff = git(["diff", "--numstat", "--no-renames", base, "HEAD"]);
  const log = git([...COMMIT_LOG_ARGS, `${base}..HEAD`]);
  if (!diff.ok || !log.ok) return null;
  return { rows: parseNumstat(diff.out), commits: parseCommits(log.out) };
}
