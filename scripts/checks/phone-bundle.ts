// `pnpm test phone-bundle`: the Android JS bundle of this tree against the one of the merge base with origin/main (docs/plans/desktop.md, What does not move). The desktop work
// leaves the phone untouched, so the two must be byte-identical apart from where the checkout lives. It exports Android twice with `--no-bytecode --clear` and the same
// environment, once in a temporary worktree at the merge base and once here, and fails, naming the first modules that differ, unless the bundles match.
//   --base <ref>  compare against that commit instead of the merge base (`--base HEAD` compares the last commit with the working tree)
//   --keep        keep the worktree and both exports, and print where they are
//   --if-desktop-work  do nothing unless the diff from the base touches desktop work (phone-files.ts, isDesktopWork), as the pull request job runs it
// The worktree shares this checkout's node_modules by a symlink and gets copies of the ignored inputs the export reads: the catalog (`pnpm assets catalog` first), the packed
// booklets and the packed scans with their map. The booklets are copied rather than left out, so both sides carry them or neither does. Skipped, with a message, where git or
// the merge base is missing (a shallow clone, no origin/main).
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import { bytes, duration, runScript, type Log } from "../log.ts";
import { isDesktopWork } from "./phone-files.ts";
import { ROOT } from "./tracked.ts";

// Ignored or generated files a checkout of the base lacks and the export reads (paths from the repository root).
const INPUTS = ["assets/catalog.db", "assets/booklets", "assets/scans"];
const SCAN_MAP = "src/screens/images/scan-map.ts";

function git(args: readonly string[], cwd = ROOT): { ok: boolean; out: string } {
  const run = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { ok: run.status === 0, out: run.stdout.trim() };
}

/** The commit to compare against, or why there is none. */
function baseCommit(asked: string | null): { sha: string } | { skip: string } {
  if (!git(["rev-parse", "--git-dir"]).ok) return { skip: "git is not available here" };
  if (asked !== null) {
    const found = git(["rev-parse", "--verify", `${asked}^{commit}`]);
    return found.ok ? { sha: found.out } : { skip: `${asked} is not a commit here` };
  }
  if (!git(["rev-parse", "--verify", "origin/main"]).ok) return { skip: "origin/main is not here (fetch it, with its history)" };
  const base = git(["merge-base", "HEAD", "origin/main"]);
  return base.ok && base.out !== "" ? { sha: base.out } : { skip: "no merge base with origin/main (a shallow clone: fetch the history)" };
}

function exportAndroid(log: Log, tree: string, out: string): void {
  const cli = createRequire(path.join(ROOT, "package.json")).resolve("expo/bin/cli");
  const started = performance.now();
  const run = spawnSync(process.execPath, [cli, "export", "-p", "android", "--no-bytecode", "--clear", "--output-dir", out], {
    cwd: tree,
    encoding: "utf8",
    maxBuffer: 1 << 28,
    env: { ...process.env, CI: "1", EXPO_NO_TELEMETRY: "1", EXPO_OFFLINE: "1" },
  });
  if (run.status !== 0) throw new Error(`expo export failed in ${tree}:\n${run.stdout}\n${run.stderr}`.slice(-4000));
  log.debug(`exported ${tree} in ${duration(performance.now() - started)}`);
}

function bundleOf(out: string): string {
  const dir = path.join(out, "_expo/static/js/android");
  const files = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(".js")) : [];
  if (files.length !== 1) throw new Error(`expected one Android bundle in ${dir}, found ${files.length}`);
  return readFileSync(path.join(dir, files[0] ?? ""), "utf8");
}

// The bundle with the checkout's place taken out: its absolute path, and the path an asset of the symlinked node_modules gets (Metro writes a folder outside the project root as
// underscores for each `..`, then the path), which in this checkout is just `node_modules`.
function normalise(text: string, tree: string): string {
  return text.split(tree).join("ROOT").replace(/\/assets\/_+[^"'`]*?node_modules/g, "/assets/node_modules");
}

const MODULE = /^__d\((.*\},)(\d+),(\[[\d,]*\])\);?$/;

type Module = { id: number; body: string };

// A module's code without its id and its dependency list: another module added or removed shifts every later id, and that alone is not a change to the phone's code.
function modulesOf(text: string): Module[] {
  const modules: Module[] = [];
  for (const line of text.split("\n")) {
    const found = MODULE.exec(line);
    if (found?.[1] !== undefined && found[2] !== undefined) modules.push({ id: Number(found[2]), body: found[1] });
  }
  return modules;
}

const window = (body: string, at: number): string => JSON.stringify(body.slice(Math.max(0, at - 90), at + 110));

/** What differs, in a few lines: the modules whose code is on one side only, paired in order, with the text around the first difference. */
function describeDifference(base: string, head: string): string[] {
  const before = modulesOf(base);
  const after = modulesOf(head);
  const lines = [`base ${bytes(base.length)}, ${before.length} modules; this tree ${bytes(head.length)}, ${after.length} modules`];
  const left = new Map<string, number>();
  for (const { body } of after) left.set(body, (left.get(body) ?? 0) + 1);
  const gone: Module[] = [];
  for (const module of before) {
    const count = left.get(module.body) ?? 0;
    if (count > 0) left.set(module.body, count - 1);
    else gone.push(module);
  }
  const right = new Map<string, number>();
  for (const { body } of before) right.set(body, (right.get(body) ?? 0) + 1);
  const added: Module[] = [];
  for (const module of after) {
    const count = right.get(module.body) ?? 0;
    if (count > 0) right.set(module.body, count - 1);
    else added.push(module);
  }
  lines.push(`${gone.length} modules of the base have no match here, ${added.length} here have none in the base`);
  for (let at = 0; at < Math.min(5, Math.max(gone.length, added.length)); at += 1) {
    const a = gone[at];
    const b = added[at];
    if (a === undefined || b === undefined) {
      const only = a ?? b;
      lines.push(`module ${only?.id}: only in ${a === undefined ? "this tree" : "the base"}: ${window(only?.body ?? "", 0)}`);
      continue;
    }
    let first = 0;
    while (first < a.body.length && a.body[first] === b.body[first]) first += 1;
    lines.push(`base module ${a.id} against module ${b.id} here, first difference at byte ${first}`, `  base: ${window(a.body, first)}`, `  head: ${window(b.body, first)}`);
  }
  if (gone.length === 0 && added.length === 0) lines.push("every module's code matches: the difference is in the ids and dependency lists, or outside the modules (the runtime prelude, the entry calls)");
  return lines;
}

async function main(log: Log): Promise<void> {
  const flag = (name: string): string | null => {
    const at = process.argv.indexOf(name);
    return at >= 0 ? (process.argv[at + 1] ?? "") : null;
  };
  const keep = process.argv.includes("--keep");
  const base = baseCommit(flag("--base"));
  if ("skip" in base) {
    log.warn(`skipped: ${base.skip}`);
    return;
  }
  if (process.argv.includes("--if-desktop-work") && !git(["diff", "--name-only", base.sha]).out.split("\n").some(isDesktopWork)) {
    log.info(`skipped: nothing in the diff from ${base.sha.slice(0, 9)} is desktop work`);
    return;
  }
  if (!existsSync(path.join(ROOT, "assets/catalog.db"))) throw new Error("assets/catalog.db is missing: run pnpm assets catalog first");

  const scratch = mkdtempSync(path.join(tmpdir(), "phone-bundle-"));
  const tree = path.join(scratch, "base");
  let added = false;
  try {
    log.debug(`worktree at ${base.sha.slice(0, 9)} in ${tree}`);
    const made = git(["worktree", "add", "--detach", tree, base.sha]);
    if (!made.ok) throw new Error(`git worktree add failed for ${base.sha}`);
    added = true;
    symlinkSync(path.join(ROOT, "node_modules"), path.join(tree, "node_modules"), "dir");
    for (const input of INPUTS) if (existsSync(path.join(ROOT, input))) cpSync(path.join(ROOT, input), path.join(tree, input), { recursive: true });
    // `pnpm assets scans` rewrites the tracked scan map in place; the base is given the one this tree has.
    if (existsSync(path.join(ROOT, "assets/scans")) && existsSync(path.join(tree, SCAN_MAP))) cpSync(path.join(ROOT, SCAN_MAP), path.join(tree, SCAN_MAP));

    const baseOut = path.join(scratch, "base-out");
    const headOut = path.join(scratch, "head-out");
    exportAndroid(log, tree, baseOut);
    exportAndroid(log, ROOT, headOut);
    const baseText = normalise(bundleOf(baseOut), tree);
    const headText = normalise(bundleOf(headOut), ROOT);
    if (baseText === headText) {
      log.info(`IDENTICAL: the Android bundle matches the one at ${base.sha.slice(0, 9)} (${bytes(headText.length)}, ${modulesOf(headText).length} modules)`);
      return;
    }
    for (const line of describeDifference(baseText, headText)) log.error(line);
    throw new Error(`the Android bundle differs from the one at ${base.sha.slice(0, 9)}: the desktop work must leave the phone's bundle byte-identical (docs/plans/desktop.md, What does not move)`);
  } finally {
    if (keep) log.info(`kept ${scratch} (base worktree, base-out, head-out)`);
    else {
      if (added) git(["worktree", "remove", "--force", tree]);
      git(["worktree", "prune"]);
      rmSync(scratch, { recursive: true, force: true });
    }
  }
}

void runScript("phone-bundle", main, { done: false });
