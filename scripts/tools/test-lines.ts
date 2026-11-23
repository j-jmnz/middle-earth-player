import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { EFFECTS } from "../../src/effects/index.ts";
import { NAME, testFiles } from "../checks/tracked.ts";
import { testTitles } from "../checks/record-readings.ts";
import { parseArgs } from "../cli-args.ts";
import { splitCodes } from "../codes.ts";
import { ROOT } from "../data/paths.ts";
import { runScript, type Log } from "../log.ts";
import { withBaseCheckout } from "./base-checkout.ts";

// The test loop for records: the tests that name the printed lines of the records that changed, and nothing else.
//
//   pnpm test lines <base-ref>          the records whose JSON differs between <base-ref> and the working tree (added, removed or changed)
//   pnpm test lines <code,code,...>     every record of those cards
//   --list                              prints the choice and runs nothing
//
// `pnpm test changed` follows imports, so a changed record file runs every test that imports the records (nearly all). A test of a record names its line id (or its record id) in its title
// (docs/agents/card-audit.md, Tests from the printed line; scripts/checks/line-coverage.ts), so this reads the names as scripts/checks/tracked.ts does, takes the test files that name
// one of the ids, and runs them with vitest's `-t` on the ids; a chosen file with no title that holds an id runs whole (a `-t` would skip all of it, and report green). It does not run what names no id: the goldens, the fixtures, the render snapshots, the smokes and the registry-wide checks.
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

function dump(cwd: string, out: string): RecordDump {
  const run = spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/data/effects/records-dump.ts", out], { cwd, encoding: "utf8", env: { ...process.env, LOG_LEVEL: "warn" } });
  if (run.status !== 0) throw new Error(`The records of ${cwd} did not load:\n${run.stderr.trim().split("\n").slice(-12).join("\n")}`);
  return JSON.parse(readFileSync(out, "utf8")) as RecordDump;
}

/** The records of the working tree and of `ref` (a detached checkout in a temporary folder, on this folder's packages, removed after). */
function dumps(ref: string, log: Log): Promise<{ base: RecordDump; now: RecordDump }> {
  return withBaseCheckout(ref, { prefix: "test-lines-", copy: ["scripts/data/effects/records-dump.ts"] }, (base) => {
    const before = dump(base.checkout, path.join(base.work, "base.json"));
    log.debug(`records of ${ref}: ${Object.keys(before).length}`);
    return { base: before, now: dump(ROOT, path.join(base.work, "now.json")) };
  });
}

/** True when `ref` names a commit of this repository. */
function isRef(ref: string): boolean {
  return spawnSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd: ROOT }).status === 0;
}

/** The records that have a name in a test file (as NAME reads it) but no test title that holds the record id or one of its lines, in any file: a `-t` run cannot pick their tests. */
export function untitledRecords(records: readonly { id: string; lines: readonly string[] }[], sources: Readonly<Record<string, string>>): string[] {
  const titles = Object.values(sources).flatMap((source) => testTitles(source));
  return records.filter((one) => !new RegExp(namePattern([one.id, ...one.lines])).test(titles.join("\n"))).map((one) => one.id);
}

async function main(log: Log): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2), TEST_LINES_USAGE, { flags: ["list"] });
  if (parsed.help) return log.info(TEST_LINES_USAGE);
  if (parsed.positional.length === 0) throw new Error(TEST_LINES_USAGE);
  const codes = splitCodes(parsed.positional);
  const dealt = new Set(EFFECTS.map((effect) => effect.cardCode));
  const known = codes.filter((code) => dealt.has(code));
  let changed: { records: string[]; lines: string[] };
  let what: string;
  if (known.length > 0) {
    const unknown = codes.filter((code) => !dealt.has(code));
    if (unknown.length > 0) log.warn(`no records for ${unknown.join(", ")}: left out`);
    const own = EFFECTS.filter((effect) => known.includes(effect.cardCode));
    changed = { records: own.map((effect) => effect.id).sort(), lines: [...new Set(own.flatMap((effect) => effect.lines))].sort() };
    what = `${known.length} cards`;
  } else {
    const target = parsed.positional.join(" ");
    if (parsed.positional.length !== 1 || !isRef(target)) throw new Error(`${codes.join(", ")}: no card with records, and not a commit of this repository.\n${TEST_LINES_USAGE}`);
    const { base, now } = await dumps(target, log);
    changed = changedRecords(base, now);
    what = `records that differ from ${target}`;
  }
  if (changed.records.length === 0) return log.info(`${what.startsWith("records") ? "no " : "no record of "}${what}: nothing to run`);
  const ids = new Set([...changed.records, ...changed.lines]);
  const files = testFiles().filter((file) => /\.test\.tsx?$/.test(file));
  const sources = Object.fromEntries(files.map((file) => [file, readFileSync(path.join(ROOT, file), "utf8")]));
  const chosen = chooseTests(ids, sources);
  const whole = chosen.filter((one) => one.titles === 0);
  const titled = chosen.filter((one) => one.titles > 0);
  const titles = titled.reduce((sum, one) => sum + one.titles, 0);
  log.info(`${changed.records.length} records (${changed.lines.length} lines) of ${what} -> ${chosen.length} test files name them, at least ${titles} test titles`);
  for (const one of titled) log.info(`  ${one.file} (${one.titles})`);
  for (const one of whole) log.info(`  ${one.file} runs whole: it names an id, but no test title holds one, so \`-t\` would skip all of it`);
  const named = new Set(chosen.flatMap((one) => [...sources[one.file]!.matchAll(NAME)].map((found) => found[1]!)));
  const own = (id: string) => EFFECTS.find((effect) => effect.id === id);
  const unnamed = changed.records.filter((id) => !named.has(id) && !(own(id)?.lines ?? []).some((line) => named.has(line)));
  // A record no test names is what scripts/checks/line-coverage.test.ts fails; a removed record has none to name.
  for (const id of unnamed) if (own(id)) log.warn(`no test names ${id}: write one (docs/agents/card-audit.md, Tests from the printed line)`);
  const present = changed.records.flatMap((id) => (own(id) ? [{ id, lines: own(id)!.lines }] : []));
  for (const id of untitledRecords(present, sources)) if (!unnamed.includes(id)) log.warn(`no test title holds ${id} or its lines, so -t cannot pick its test: start a title with the line id`);
  if (chosen.length === 0) throw new Error("no test file names these records");
  if (parsed.flags.has("list")) return;
  // The titled files run with `-t` on the ids; the files with no matching title run whole.
  const runs = [
    ...(titled.length > 0 ? [[...titled.map((one) => one.file), "-t", namePattern([...ids])]] : []),
    ...(whole.length > 0 ? [whole.map((one) => one.file)] : []),
  ];
  for (const args of runs) {
    const run = spawnSync("pnpm", ["exec", "vitest", "run", ...args], { cwd: ROOT, stdio: "inherit" });
    if (run.status !== 0) throw new Error("the tests that name the changed records failed");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("test:lines", main);
