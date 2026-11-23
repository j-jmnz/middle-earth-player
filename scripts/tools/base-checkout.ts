import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { ROOT } from "../data/paths.ts";

/** Runs git in `cwd` (this repository by default) and returns its trimmed output; a failure throws with git's message. */
export function git(args: readonly string[], cwd = ROOT): string {
  const run = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (run.status !== 0) throw new Error(`git ${args.join(" ")}: ${run.stderr.trim() || `exit ${run.status}`}`);
  return run.stdout.trim();
}

export type BaseCheckout = { ref: string; sha: string; checkout: string; work: string };

/**
 * Runs `run` on a detached checkout of `ref` in a temporary folder (under `parent`, the system's temporary folder by default), then removes it. The checkout runs on this folder's
 * installed packages (a link to its node_modules) and holds this tree's copy of each file in `copy`, so a script that only exists here can run on the base's sources. `work` is a
 * scratch folder beside the checkout for the caller's output files. Used by `pnpm test lines` and `pnpm effects reach`.
 */
export async function withBaseCheckout<T>(ref: string, options: { prefix: string; parent?: string; copy: readonly string[] }, run: (base: BaseCheckout) => Promise<T> | T): Promise<T> {
  const sha = git(["rev-parse", "--verify", `${ref}^{commit}`]);
  const parent = options.parent ?? os.tmpdir();
  mkdirSync(parent, { recursive: true });
  const work = mkdtempSync(path.join(parent, options.prefix));
  const checkout = path.join(work, "base");
  try {
    git(["worktree", "add", "--detach", checkout, sha]);
    symlinkSync(path.join(ROOT, "node_modules"), path.join(checkout, "node_modules"), "dir");
    for (const file of options.copy) {
      if (!existsSync(path.join(ROOT, file))) throw new Error(`${file} is missing`);
      mkdirSync(path.dirname(path.join(checkout, file)), { recursive: true });
      copyFileSync(path.join(ROOT, file), path.join(checkout, file));
    }
    return await run({ ref, sha, checkout, work });
  } finally {
    spawnSync("git", ["worktree", "remove", "--force", checkout], { cwd: ROOT });
    spawnSync("git", ["worktree", "prune"], { cwd: ROOT });
    rmSync(work, { recursive: true, force: true });
  }
}
