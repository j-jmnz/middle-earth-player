import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EFFECTS } from "../../src/effects/index.ts";
import { NAME, testFiles } from "../checks/tracked.ts";
import { testTitles } from "../checks/record-readings.ts";
import { parseArgs } from "../cli-args.ts";
import { splitCodes } from "../codes.ts";
import { ROOT } from "../data/paths.ts";
import { runScript, type Log } from "../log.ts";

// The exact test loop for records: the tests that name the printed lines of the records that changed, and nothing else.
//
//   pnpm test lines <base-ref>          the records whose JSON differs between <base-ref> and the working tree (added, removed or changed)
//   pnpm test lines <code,code,...>     every record of those cards
//   --list                              prints the choice and runs nothing
//
// `pnpm test changed` follows imports, so a changed record file runs every test that imports the records (nearly all). A test of a record names its line id (or its record id) in its title
// (docs/agents/card-audit.md, Tests from the printed line; scripts/checks/line-coverage.ts), so this reads the names as scripts/checks/tracked.ts does, takes the test files that name
// one of the ids, and runs them with vitest's `-t` on the ids. It does not run what names no id: the goldens, the fixtures, the render snapshots, the smokes and the registry-wide checks.
// Run `pnpm test scenario <id>` and the exit of the task (.claude/agents/orchestrator.md, Implementer tasks) for those.

export const TEST_LINES_USAGE = "usage: pnpm test lines <base-ref | code,code,...> [--list]";

export type RecordDump = Readonly<Record<string, { lines: readonly string[]; json: string }>>;

/** The records that are in only one dump or whose JSON differs: their ids, and the line ids they name (those of the base too, for a record that moved off a line). Sorted. */
export function changedRecords(base: RecordDump, now: RecordDump): { records: string[]; lines: string[] } {
  const records = [...new Set([...Object.keys(base), ...Object.keys(now)])].filter((id) => base[id]?.json !== now[id]?.json).sort();
  const lines = [...new Set(records.flatMap((id) => [...(base[id]?.lines ?? []), ...(now[id]?.lines ?? [])]))].sort();
  return { records, lines };
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The `-t` pattern: a name that holds one of the ids as a whole token (`01026:A:1` does not match `01026:A:10`). */
export function namePattern(ids: readonly string[]): string {
  return `(?<![\\w:])(?:${ids.map(escapeRegExp).join("|")})(?![\\w])`;
}

export type Chosen = { file: string; titles: number };

/** The test files whose source names one of the ids (as NAME reads a name), each with how many of its titles hold one: a count that is a floor, since a `describe` that holds an id runs the tests under it. */
export function chooseTests(ids: ReadonlySet<string>, sources: Readonly<Record<string, string>>): Chosen[] {
  const pattern = new RegExp(namePattern([...ids]));
  return Object.entries(sources)
    .filter(([, source]) => [...source.matchAll(NAME)].some((found) => ids.has(found[1]!)))
    .map(([file, source]) => ({ file, titles: testTitles(source).filter((title) => pattern.test(title)).length }))
    .sort((a, b) => a.file.localeCompare(b.file));
}

function git(args: readonly string[]): string {
  const run = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (run.status !== 0) throw new Error(`git ${args.join(" ")}: ${run.stderr.trim() || `exit ${run.status}`}`);
  return run.stdout.trim();
}

function dump(cwd: string, out: string): RecordDump {
  const run = spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/data/effects/records-dump.ts", out], { cwd, encoding: "utf8", env: { ...process.env, LOG_LEVEL: "warn" } });
  if (run.status !== 0) throw new Error(`The records of ${cwd} did not load:\n${run.stderr.trim().split("\n").slice(-12).join("\n")}`);
  return JSON.parse(readFileSync(out, "utf8")) as RecordDump;
}

/** The records of the working tree and of `ref` (a detached checkout in a temporary folder, on this folder's packages, removed after). */
function dumps(ref: string, log: Log): { base: RecordDump; now: RecordDump } {
  const resolved = git(["rev-parse", "--verify", `${ref}^{commit}`]);
  const work = mkdtempSync(path.join(os.tmpdir(), "test-lines-"));
  const checkout = path.join(work, "base");
  try {
    git(["worktree", "add", "--detach", checkout, resolved]);
    symlinkSync(path.join(ROOT, "node_modules"), path.join(checkout, "node_modules"), "dir");
    const script = "scripts/data/effects/records-dump.ts";
    mkdirSync(path.dirname(path.join(checkout, script)), { recursive: true });
    copyFileSync(path.join(ROOT, script), path.join(checkout, script));
    const base = dump(checkout, path.join(work, "base.json"));
    log.debug(`records of ${ref}: ${Object.keys(base).length}`);
    return { base, now: dump(ROOT, path.join(work, "now.json")) };
  } finally {
    spawnSync("git", ["worktree", "remove", "--force", checkout], { cwd: ROOT });
    spawnSync("git", ["worktree", "prune"], { cwd: ROOT });
    rmSync(work, { recursive: true, force: true });
  }
}

function main(log: Log): void {
  const parsed = parseArgs(process.argv.slice(2), TEST_LINES_USAGE, { flags: ["list"] });
  if (parsed.help) return log.info(TEST_LINES_USAGE);
  const target = parsed.positional.join(" ");
  if (parsed.positional.length === 0) throw new Error(TEST_LINES_USAGE);
  const codes = splitCodes(parsed.positional);
  const dealt = new Set(EFFECTS.map((effect) => effect.cardCode));
  let changed: { records: string[]; lines: string[] };
  let what: string;
  if (codes.length > 0 && codes.every((code) => dealt.has(code))) {
    const own = EFFECTS.filter((effect) => codes.includes(effect.cardCode));
    changed = { records: own.map((effect) => effect.id).sort(), lines: [...new Set(own.flatMap((effect) => effect.lines))].sort() };
    what = `${codes.length} cards`;
  } else {
    const { base, now } = dumps(target, log);
    changed = changedRecords(base, now);
    what = `records that differ from ${target}`;
  }
  if (changed.records.length === 0) return log.info(`${what.startsWith("records") ? "no " : "no record of "}${what}: nothing to run`);
  const ids = new Set([...changed.records, ...changed.lines]);
  const files = testFiles().filter((file) => /\.test\.tsx?$/.test(file));
  const chosen = chooseTests(ids, Object.fromEntries(files.map((file) => [file, readFileSync(path.join(ROOT, file), "utf8")])));
  const titles = chosen.reduce((sum, one) => sum + one.titles, 0);
  log.info(`${changed.records.length} records (${changed.lines.length} lines) of ${what} -> ${chosen.length} test files name them, at least ${titles} test titles`);
  for (const one of chosen) log.info(`  ${one.file} (${one.titles})`);
  const named = new Set(chosen.flatMap((one) => [...readFileSync(path.join(ROOT, one.file), "utf8").matchAll(NAME)].map((found) => found[1]!)));
  const unnamed = changed.records.filter((id) => !named.has(id) && !(EFFECTS.find((effect) => effect.id === id)?.lines ?? []).some((line) => named.has(line)));
  // A record no test names is what scripts/checks/line-coverage.test.ts fails; a removed record has none to name.
  for (const id of unnamed) if (EFFECTS.some((effect) => effect.id === id)) log.warn(`no test names ${id}: write one (docs/agents/card-audit.md, Tests from the printed line)`);
  if (chosen.length === 0) throw new Error("no test file names these records");
  if (parsed.flags.has("list")) return;
  const run = spawnSync("pnpm", ["exec", "vitest", "run", ...chosen.map((one) => one.file), "-t", namePattern([...ids])], { cwd: ROOT, stdio: "inherit" });
  if (run.status !== 0) throw new Error("the tests that name the changed records failed");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("test:lines", main);
