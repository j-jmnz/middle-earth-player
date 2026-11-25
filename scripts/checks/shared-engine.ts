import { spawnSync } from "node:child_process";

import { ROOT } from "./tracked.ts";

// A scenario adds its mechanics to the cycle's family (docs/agents/cycle-procedure.md, Design note for a new system); what it adds to shared engine code stays small. Shared engine code is
// src/rules and src/catalog outside their `families/` folders. The lines a branch adds there (git numstat, tests left out) stay at or under SHARED_ENGINE_LIMIT unless a commit body
// of the branch has `Shared engine: <reason>`. The limit is twice the median (20) of the 15 scenario squash commits before it was set; the five that were over it began a cycle or a new system.

export const SHARED_ENGINE_LIMIT = 40;

/** One row of `git diff --numstat`: the lines added to a file (0 for a binary file). */
export type NumstatRow = { added: number; file: string };

/** `Shared engine: <reason>` at the start of a line of a commit body, the reason at least 10 characters. */
const SHARED_REASON = /^Shared engine: \S.{9,}/m;
const TEST_FILE = /\.test\.tsx?$/;

/** Whether a file is shared engine code: under src/rules or src/catalog, and not in a family's own folder. */
export function isSharedEngine(file: string): boolean {
  if (TEST_FILE.test(file)) return false;
  return (/^src\/rules\//.test(file) && !/^src\/rules\/families\//.test(file)) || (/^src\/catalog\//.test(file) && !/^src\/catalog\/families\//.test(file));
}

/** The lines the rows add to shared engine code. */
export function addedSharedLines(rows: readonly NumstatRow[]): number {
  return rows.filter((row) => isSharedEngine(row.file)).reduce((sum, row) => sum + row.added, 0);
}

/** The rows of `git diff --numstat` output; a binary file's `-` counts 0. */
export function parseNumstat(text: string): NumstatRow[] {
  return text.split("\n").flatMap((line) => {
    const [added = "", , ...file] = line.split("\t");
    return file.length === 0 ? [] : [{ added: Number(added) || 0, file: file.join("\t") }];
  });
}

/** What a branch lacks when it adds more than the limit to shared engine code and no commit body gives the reason. */
export function sharedEngineProblems(range: { rows: readonly NumstatRow[]; bodies: readonly string[] }): string[] {
  const added = addedSharedLines(range.rows);
  if (added <= SHARED_ENGINE_LIMIT || range.bodies.some((body) => SHARED_REASON.test(body))) return [];
  const files = range.rows.filter((row) => isSharedEngine(row.file) && row.added > 0).sort((a, b) => b.added - a.added).slice(0, 3).map((row) => `${row.file} +${row.added}`);
  return [
    `the branch adds ${added} lines to shared engine code (limit ${SHARED_ENGINE_LIMIT}; ${files.join(", ")}): put the mechanic in the cycle's family behind one hook, or give the reason in a commit body line "Shared engine: <reason>" (docs/agents/cycle-procedure.md, Design note for a new system)`,
  ];
}

function git(args: readonly string[]): { ok: boolean; out: string } {
  const run = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { ok: run.status === 0, out: run.stdout };
}

/** The rows and commit bodies of HEAD since its merge base with origin/main, or null when the merge base cannot be found (no origin/main ref, or a shallow checkout that does not reach it). */
export function branchRows(): { rows: NumstatRow[]; bodies: string[] } | null {
  const merged = git(["merge-base", "HEAD", "origin/main"]);
  const base = merged.out.trim();
  if (!merged.ok || base === "") return null;
  const diff = git(["diff", "--numstat", "--no-renames", base, "HEAD"]);
  const log = git(["log", "--no-merges", "--format=%B%x00", `${base}..HEAD`]);
  if (!diff.ok || !log.ok) return null;
  return { rows: parseNumstat(diff.out), bodies: log.out.split("\0").map((body) => body.trim()).filter(Boolean) };
}
