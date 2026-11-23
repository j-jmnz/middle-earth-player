import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, symlinkSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs } from "../cli-args.ts";
import { ROOT } from "../data/paths.ts";
import { duration, runScript, type Log } from "../log.ts";

// A second working folder for a task that runs beside another (docs/development.md, Commands; docs/agents/card-audit.md (Running it) limits what runs side by side):
//
//   pnpm worktree add <branch> [<base-ref>]     a git worktree beside this folder on <branch> (made from <base-ref>, default origin/main, when the branch is new), ready to use
//   pnpm worktree remove <branch> [--force]     removes that folder (git refuses one with changes unless --force); the branch stays
//
// What a folder made by hand lacks, and what `add` does about it:
//   node_modules      `pnpm install --frozen-lockfile --prefer-offline` in the folder: the store is shared, so each package is a hard link and nothing is downloaded. A link to this folder's
//                     node_modules is not an install: git lists the link as a file (the `node_modules/` ignore line matches folders only), which private-data.test.ts then reads.
//   docs/INDEX.md     written by the install's prepare script (`pnpm doc index`), and again by the checkout hook.
//   core.hooksPath    the repository's config is shared by its worktrees and names .githooks, which every checkout holds; `add` sets it when it is missing.
//   .cache            linked to this folder's .cache (the pinned PDFs and scans `pnpm data sync` fills and `pnpm assets scans` reads; no test reads it). It is ignored by name, never copied, never committed.
//   assets            the packs are not linked: `pnpm assets catalog` builds assets/catalog.db from data/ in seconds, and only the browser and the desktop need it.

export const WORKTREE_USAGE = "usage: pnpm worktree add <branch> [<base-ref>]  |  pnpm worktree remove <branch> [--force]";

/** The folder for a branch: beside the repository, named for the repository and the branch (`feat/lost-in-mirkwood` gives `<repo>-feat-lost-in-mirkwood`). */
export function worktreePath(root: string, branch: string): string {
  return path.join(path.dirname(root), `${path.basename(root)}-${branch.replace(/[^A-Za-z0-9._]+/g, "-")}`);
}

/** The worktrees `git worktree list --porcelain` prints: folder and branch (null on a detached head). */
export function parseWorktrees(porcelain: string): { path: string; branch: string | null }[] {
  return porcelain
    .split("\n\n")
    .map((block) => block.split("\n"))
    .filter((lines) => lines[0]?.startsWith("worktree "))
    .map((lines) => ({ path: lines[0]!.slice("worktree ".length), branch: lines.find((line) => line.startsWith("branch refs/heads/"))?.slice("branch refs/heads/".length) ?? null }));
}

type Args = { command: "add" | "remove"; branch: string; base: string | undefined; force: boolean };

/** The arguments of a run; a misspelt flag or a missing branch throws with the usage. */
export function worktreeArguments(args: readonly string[]): Args | "help" {
  const parsed = parseArgs(args, WORKTREE_USAGE, { flags: ["force"] });
  if (parsed.help) return "help";
  const [command, branch, base, ...rest] = parsed.positional;
  if ((command !== "add" && command !== "remove") || !branch || rest.length > 0 || (command === "remove" && base !== undefined)) throw new Error(WORKTREE_USAGE);
  if (command === "add" && parsed.flags.has("force")) throw new Error(`--force is for remove.\n${WORKTREE_USAGE}`);
  return { command, branch, base, force: parsed.flags.has("force") };
}

function git(args: string[], cwd = ROOT): { ok: boolean; out: string; err: string } {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { ok: result.status === 0, out: result.stdout.trim(), err: result.stderr.trim() };
}

function mustGit(args: string[], cwd = ROOT): string {
  const result = git(args, cwd);
  if (!result.ok) throw new Error(`git ${args.join(" ")} failed: ${result.err}`);
  return result.out;
}

function install(folder: string, log: Log): void {
  const begin = performance.now();
  // The output is held: a failure prints all of it, a success nothing (--verbose shows it as it goes through the log).
  const result = spawnSync("pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], { cwd: folder, encoding: "utf8", env: { ...process.env, CI: "1" } });
  if (result.status !== 0) throw new Error(`pnpm install failed in ${folder}:\n${result.stdout}${result.stderr}`);
  log.debug(result.stdout);
  log.info(`  installed the dependencies in ${duration(performance.now() - begin)} (shared store)`);
}

function linkCache(folder: string, log: Log): void {
  const from = path.join(ROOT, ".cache");
  const to = path.join(folder, ".cache");
  if (!existsSync(from) || existsSync(to)) return;
  symlinkSync(from, to, "dir");
  log.info("  linked .cache to this folder's .cache");
}

function add({ branch, base }: Args, log: Log): void {
  const folder = worktreePath(ROOT, branch);
  if (existsSync(folder)) throw new Error(`${folder} exists already`);
  if (!git(["check-ref-format", "--branch", branch]).ok) throw new Error(`${branch} is not a branch name`);
  const exists = git(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).ok;
  if (exists && base !== undefined) throw new Error(`${branch} exists already: leave out <base-ref>, or name a new branch`);
  const from = base ?? (git(["rev-parse", "--verify", "--quiet", "origin/main"]).ok ? "origin/main" : "HEAD");
  const begin = performance.now();
  mustGit(exists ? ["worktree", "add", folder, branch] : ["worktree", "add", "--no-track", "-b", branch, folder, from]);
  log.info(`created ${folder} on ${branch}${exists ? "" : ` (from ${from})`}`);
  try {
    install(folder, log);
    if (git(["config", "core.hooksPath"], folder).out === "") mustGit(["config", "core.hooksPath", ".githooks"], folder);
    // The install's prepare script and the checkout hook write the index; this covers an install that skipped them.
    if (!existsSync(path.join(folder, "docs", "INDEX.md"))) {
      const indexed = spawnSync("pnpm", ["doc", "index"], { cwd: folder, encoding: "utf8" });
      if (indexed.status !== 0) throw new Error(`pnpm doc index failed in ${folder}:\n${indexed.stdout}${indexed.stderr}`);
    }
    linkCache(folder, log);
  } catch (error) {
    // A half-made folder is worse than none: remove it, keep the branch.
    git(["worktree", "remove", "--force", folder]);
    throw error;
  }
  log.notice(`ready in ${duration(performance.now() - begin)}: cd ${folder}; push with git push -u origin ${branch}; remove with pnpm worktree remove ${branch}`);
}

function remove({ branch, force }: Args, log: Log): void {
  const found = parseWorktrees(mustGit(["worktree", "list", "--porcelain"])).find((one) => one.branch === branch && path.resolve(one.path) !== path.resolve(ROOT));
  if (!found) throw new Error(`no worktree of this repository is on ${branch}`);
  // A link is removed first, so no tool follows it into the folder it points to.
  const cache = path.join(found.path, ".cache");
  if (existsSync(cache) && lstatSync(cache).isSymbolicLink()) unlinkSync(cache);
  const removed = git(["worktree", "remove", ...(force ? ["--force"] : []), found.path]);
  if (!removed.ok) throw new Error(`${removed.err}\n(the folder has changes: commit and push them, or use --force)`);
  log.info(`removed ${found.path}; the branch ${branch} stays`);
}

function main(log: Log): void {
  const args = worktreeArguments(process.argv.slice(2));
  if (args === "help") return log.info(WORKTREE_USAGE);
  if (args.command === "add") add(args, log);
  else remove(args, log);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("worktree", main, { done: false });
