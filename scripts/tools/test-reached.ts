import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PLAYABLE_SCENARIOS } from "../../src/campaign/playable.ts";
import { EFFECTS } from "../../src/effects/index.ts";
import { tracked } from "../checks/tracked.ts";
import { smokeCodes } from "../card-smoke/world.ts";
import { parseArgs } from "../cli-args.ts";
import { ROOT } from "../data/paths.ts";
import { duration, runScript, type Log } from "../log.ts";
import { git } from "./base-checkout.ts";
import { notRun, planReached, plannedFiles, relatedSeeds, type ReachedPlan } from "./reached-plan.ts";
import { changedRecords, dumps } from "./test-lines.ts";
import { changedFiles, mergeBase, scenarioCodes } from "./test-scenario.ts";

// The test loop for a change: the tests it can break, and an honest account of the rest (docs/development.md, Commands).
//
//   pnpm test reached [<base-ref>]      the files changed since <base-ref> (the merge base with origin/main by default), in commits, the index, the tree and new files
//   --committed                         only the commits up to HEAD, not the index, the tree or new files
//   --list                              prints the plan and runs nothing
//
// It prints its plan first (how many test files, which scenarios, why), runs it, then prints how many of the repository's test files it ran, which kinds it did not run, and exits non-zero
// when a selected run fails. The rules of the choice are in reached-plan.ts. The full `pnpm test` stays the gate before a merge and in CI.

export const TEST_REACHED_USAGE = "usage: pnpm test reached [<base-ref>] [--committed] [--list]";

const NODE = ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--disable-warning=ExperimentalWarning"];
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The test files that import any of `files`, by vitest's module graph (what `vitest related` runs), repo-relative. */
async function relatedTests(files: readonly string[]): Promise<string[]> {
  if (files.length === 0) return [];
  const { createVitest } = await import("vitest/node");
  const vitest = await createVitest("test", { watch: false, run: true, related: files.map((file) => path.join(ROOT, file)), passWithNoTests: true, reporters: [] });
  try {
    return (await vitest.getRelevantTestSpecifications()).map((spec) => path.relative(ROOT, spec.moduleId).split(path.sep).join("/"));
  } finally {
    await vitest.close();
  }
}

/** The plan's lines: what changed, what each rule chose and why, the total. */
export function planLines(plan: ReachedPlan, base: string, changed: readonly string[], treeSize: number, imports: number, moved: { records: number; lines: number } | null): string[] {
  const kinds = Object.entries(plan.kinds).filter(([, files]) => files.length > 0).map(([kind, files]) => `${kind} ${files.length}`);
  const lines = [`${changed.length} files changed since ${base.slice(0, 10)}: ${kinds.join(", ") || "none"}`];
  if (plan.everything) lines.push("build or test configuration changed: every test file runs");
  lines.push(`1. tests that import a changed file: ${imports} files`);
  if (moved) lines.push(`2. records that moved: ${moved.records} (${moved.lines} printed lines) -> ${plan.titled.length} files run with -t on their ids, ${[...plan.whole.values()].filter((why) => why.startsWith("names a moved")).length} whole`);
  else lines.push("2. records that moved: no record file changed");
  if (plan.scenarios.length > 0) lines.push(`3. scenarios that deal them: ${plan.scenarios.length} (${plan.scenarios.map((one) => one.id).join(", ")}) -> their golden tests${plan.fixtureTitles.length > 0 ? `, ${plan.fixtureTitles.length} titles of the registry golden test` : ""} and ${plan.encounter.length} encounter smokes`);
  else lines.push("3. scenarios that deal them: none");
  if (plan.smoke.length > 0) lines.push(`   player cards with a card smoke: ${plan.smoke.join(" ")}`);
  if (plan.unplaced.length > 0) lines.push(`   moved cards no playable scenario deals and no card smoke plays: ${plan.unplaced.join(" ")}`);
  lines.push(plan.games === null ? "4. engine code: not changed" : `4. ${plan.games}: every golden test and smoke shard runs`);
  if (plan.dataCheck) lines.push("5. data changed: pnpm data check and the data tests run");
  const files = plannedFiles(plan).size;
  lines.push(`plan: ${files} of ${treeSize} test files${plan.encounter.length > 0 ? `, encounter smoke of ${plan.encounter.length} scenarios` : ""}${plan.smoke.length > 0 ? `, card smoke of ${plan.smoke.length} cards` : ""}${plan.dataCheck ? ", pnpm data check" : ""}`);
  return lines;
}

type Run = { name: string; ok: boolean; ms: number };

function run(name: string, command: string, args: string[], env?: Record<string, string>): Run {
  const begin = performance.now();
  const result = spawnSync(command, args, { cwd: ROOT, stdio: "inherit", env: { ...process.env, ...env } });
  return { name, ok: result.status === 0, ms: performance.now() - begin };
}

async function main(log: Log): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2), TEST_REACHED_USAGE, { flags: ["committed", "list"] });
  if (parsed.help) return log.info(TEST_REACHED_USAGE);
  if (parsed.positional.length > 1) throw new Error(TEST_REACHED_USAGE);
  const begin = performance.now();
  const base = parsed.positional[0] === undefined ? mergeBase() : git(["rev-parse", "--verify", `${parsed.positional[0]}^{commit}`]);
  const changed = changedFiles(base, parsed.flags.has("committed"));
  const tree = tracked().filter((file) => /\.test\.tsx?$/.test(file));
  const sources = Object.fromEntries(tree.map((file) => [file, readFileSync(path.join(ROOT, file), "utf8")]));
  const seeds = relatedSeeds(changed, (file) => existsSync(path.join(ROOT, file)));
  const related = await log.stepAsync(`tests that import ${seeds.length} changed files`, () => relatedTests(seeds));
  // The records are compared only when a file that holds or builds them changed.
  const touchesRecords = changed.some((file) => file.startsWith("src/effects/") || file.startsWith("scripts/data/") || file.startsWith("data/"));
  const moved = touchesRecords ? changedRecords(...(await log.stepAsync(`records against ${base.slice(0, 10)}`, () => dumps(base, log).then(({ base: before, now }) => [before, now] as const)))) : null;
  const deals = Object.fromEntries(PLAYABLE_SCENARIOS.map((id) => [id, scenarioCodes(id)]));
  const registrySource = readFileSync(path.join(ROOT, "test/harness/golden-registry.ts"), "utf8");
  const plan = planReached({ changed, tree, related, moved, sources, deals, smokeable: new Set(smokeCodes(EFFECTS)), registrySource });
  for (const line of planLines(plan, base, changed, tree.length, related.length, moved && { records: moved.records.length, lines: moved.lines.length })) log.info(line);
  const ran = plannedFiles(plan);
  const skipped = notRun(tree, ran);
  if (changed.length === 0) return log.info("nothing changed: nothing to run");
  if (parsed.flags.has("list")) {
    for (const [file, why] of plan.whole) log.info(`  ${file}  (${why})`);
    for (const one of plan.titled) log.info(`  ${one.file}  (-t, ${one.titles} titles)`);
    return;
  }

  const runs: Run[] = [];
  const vitest = (files: string[], filter?: string) => ["exec", "vitest", "run", ...files, ...(filter === undefined ? [] : ["-t", filter])];
  const whole = [...plan.whole.keys()];
  if (whole.length > 0) runs.push(run("tests", "pnpm", vitest(whole)));
  if (plan.titled.length > 0) runs.push(run("record tests", "pnpm", vitest(plan.titled.map((one) => one.file), plan.pattern ?? undefined)));
  if (plan.fixtureTitles.length > 0) runs.push(run("registry goldens", "pnpm", vitest(["src/campaign/fixtures.test.ts"], `(?:${plan.fixtureTitles.map(escapeRegExp).join("|")})`)));
  if (plan.encounter.length > 0) runs.push(run("encounter smoke", "node", [...NODE, "scripts/card-smoke/encounter.ts", ...plan.encounter]));
  if (plan.smoke.length > 0) runs.push(run("card smoke", "node", [...NODE, "scripts/card-smoke/run.ts", ...plan.smoke]));
  if (plan.dataCheck) runs.push(run("data check", "node", [...NODE, "scripts/data/check.ts"]));

  const failed = runs.filter((one) => !one.ok);
  for (const one of runs) (one.ok ? log.info : log.error)(`${one.name.padEnd(16)} ${one.ok ? "passed" : "FAILED"}  (${duration(one.ms)})`);
  log.info(`ran ${ran.size} of ${tree.length} test files in ${duration(performance.now() - begin)}${failed.length === 0 ? "" : `; FAILED: ${failed.map((one) => one.name).join(", ")}`}`);
  log.info(`not run: ${skipped.count} test files (${skipped.groups.slice(0, 6).map(([group, count]) => `${group} ${count}`).join(", ")}${skipped.groups.length > 6 ? ", ..." : ""})`);
  log.info(`not run by this command at all: pnpm lint, pnpm typecheck, ${plan.dataCheck ? "" : "pnpm data check, "}pnpm test phone-bundle, the screens in a browser, a game the changed code reaches that no golden, fixture or smoke plays. A green run is not the gate: pnpm test is.`);
  if (failed.length > 0) throw new Error(`failed: ${failed.map((one) => one.name).join(", ")}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("test:reached", main);
