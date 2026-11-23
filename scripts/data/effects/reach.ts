import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { flagValue } from "../../args.ts";
import { runScript, type Log } from "../../log.ts";
import { ROOT } from "../paths.ts";
import { formatChanges, reaching, type Dump } from "./reach-diff.ts";

// Usage: pnpm effects reach <base-ref> [--out <file>] [--tmp <dir>]
// The cards a change reaches: every record of every playable scenario's cards and of every deck-legal player card is rendered as `pnpm effects render` prints it, once with the code of
// <base-ref> (a checkout of it in a temporary folder under --tmp, the system's temporary folder by default) and once with the working tree, and the cards that differ are printed
// by card with the printed line of each record that moved and the lines of the render that changed. A fix agent reads the lines of every card its change reaches before it reports.
//
// It compares what a record says, in English and as JSON. It cannot see a change in engine code that no record's text shows: a reader or pick filter many records share, an idle or
// potential check (src/rules/player), a family hook, a verb's run. For those, list the cards by searching the records for the verb or field the code reads.

const USAGE = "Usage: effects reach <base-ref> [--out <file>] [--tmp <dir>]";

function git(args: readonly string[], cwd = ROOT): string {
  const run = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (run.status !== 0) throw new Error(`git ${args.join(" ")}: ${run.stderr.trim() || `exit ${run.status}`}`);
  return run.stdout.trim();
}

function dump(cwd: string, out: string, log: Log): Dump {
  const run = spawnSync(process.execPath, ["scripts/data/effects/reach-dump.ts", out], { cwd, encoding: "utf8", env: { ...process.env, LOG_LEVEL: "warn" } });
  if (run.status !== 0) throw new Error(`The render in ${cwd} failed:\n${run.stderr.trim().split("\n").slice(-12).join("\n")}`);
  log.debug(`rendered in ${cwd}`);
  return JSON.parse(readFileSync(out, "utf8")) as Dump;
}

async function main(log: Log): Promise<void> {
  const args = process.argv.slice(2);
  const ref = args.find((arg, at) => !arg.startsWith("--") && !["--out", "--tmp"].includes(args[at - 1] ?? ""));
  if (!ref) throw new Error(USAGE);
  const out = flagValue(args, "--out");
  const resolved = git(["rev-parse", "--verify", `${ref}^{commit}`]);
  const parent = flagValue(args, "--tmp") ?? os.tmpdir();
  mkdirSync(parent, { recursive: true });
  const work = mkdtempSync(path.join(parent, "reach-"));
  const base = path.join(work, "base");
  try {
    git(["worktree", "add", "--detach", base, resolved]);
    // The base checkout runs on this checkout's installed packages and the render script of this tree.
    symlinkSync(path.join(ROOT, "node_modules"), path.join(base, "node_modules"), "dir");
    for (const file of ["scripts/data/effects/reach-dump.ts", "scripts/data/effects/reach-diff.ts"]) {
      mkdirSync(path.dirname(path.join(base, file)), { recursive: true });
      if (!existsSync(path.join(ROOT, file))) throw new Error(`${file} is missing`);
      copyFileSync(path.join(ROOT, file), path.join(base, file));
    }
    const before = await log.stepAsync(`rendering ${ref} (${resolved.slice(0, 8)})`, async () => dump(base, path.join(work, "base.json"), log));
    const after = await log.stepAsync("rendering the working tree", async () => dump(ROOT, path.join(work, "now.json"), log));
    const report = formatChanges(reaching(before, after), ref);
    if (out) {
      writeFileSync(out, report);
      log.info(`wrote ${out}`);
    } else process.stdout.write(report);
  } finally {
    spawnSync("git", ["worktree", "remove", "--force", base], { cwd: ROOT });
    spawnSync("git", ["worktree", "prune"], { cwd: ROOT });
    rmSync(work, { recursive: true, force: true });
  }
}

void runScript("effects:reach", main);
