import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadCards } from "../data/load-cards.ts";
import { loadCampaignsInOrder, loadAnyScenario } from "../data/load-scenarios.ts";
import { DATA_DIR, ROOT } from "../data/paths.ts";
import { duration, runScript, type Log } from "../log.ts";
import { smokeCodes } from "../card-smoke/world.ts";
import { WORDS_SCENARIOS } from "../../test/harness/words-scenarios.ts";

// The tests to run while a scenario is being authored, a fraction of the full suite (docs/development.md, Commands; docs/agents/agent-brief.md, Scenario procedure):
//
//   pnpm test scenario <scenario-id> [--list]
//   pnpm test scenario <scenario-id> --quick      the loop while authoring: skips the goldens (the registry-wide golden tests and the scenario's own golden.test.ts) and the reader
//                                                 check; the full run, once before the hand-back, runs them (docs/agents/agent-brief.md, Scenario procedure)
//   pnpm test scenario <scenario-id> --words      only src/play/words/scenario-words.test.ts for the scenario, and src/play/words/asks.test.ts when it has an asks file
//                                                 (src/play/words/asks/<id>.ts), with WORDS_DUMP=<id>: it prints every sentence the scenario's choices say (the
//                                                 check for a bare "Choose a player." or a fallback sentence, and for a scenario with an asks file every asks entry rendered)
//
// Parts, each its own vitest run (or the card smoke), so a failure names its part:
//   tests      the test files that belong to the scenario: those whose path names it (its folder under src/campaign/scenarios/, src/play/scenarios/<id>-*.test.ts, ...)
//              and those that import from test/scenarios/<id>/ or src/campaign/scenarios/<id>/ (a Temple table test named for the island, say)
//   goldens    the registry-wide golden tests, filtered (-t) to the scenario's title in test/harness/golden-registry.ts: the save fixtures (the
//              causes and the replay of a scenario's goldens are in its own golden.test.ts, in tests). A scenario with no entry skips them, except
//              a-shadow-of-the-past, whose goldens replay.test.ts and causes.test.ts read directly: those two run
//              whole (in the tests part, as they import its scene)
//   coverage   the effect coverage, migration and record-route checks, the copied-lines test, the golden registry's own test, the file-size and test-cost checks and the rule-id
//              test (COVERAGE_TESTS), and every
//              choice-words test (src/play/words): a record on a card another scenario's words test reads (a campaign card, a recurring ally) can break it
//   reader     src/play/reader-play.test.ts for the scenario (READER_PLAY_SCENARIO=<id>): a seeded game played through what a screen reader can reach, which fails
//              on an intent the engine offers that no labelled element sends. The first scenario, and any scenario with a line in the golden registry, has games
//   smoke      scripts/card-smoke/run.ts on the player cards the scenario deals (skipped when it deals none)
//   encounter  scripts/card-smoke/encounter.ts on the scenario: each encounter-side card it deals revealed, its Shadow resolved, a location traveled to,
//              a quest card's Setup run, and a few dozen seeded games with random legal intents that must end and replay. It runs for every scenario,
//              whichever track built it and whether or not it deals player cards
//   families   the family and pool tests, and the manifest tests, when files of those changed since the merge base with origin/main (HEAD when there is
//              none), committed, staged, unstaged or untracked (changedFamilyTests)
//   budget     the tests part's time, held to the scenario's budget on a full run (Test budget, below)
// `--list` prints the files and codes without running anything. A file runs once, in the first part that names it.

// Test budget: the scenario's own tests (the tests part) take at most TEST_BUDGET_SECONDS of test time in all, summed over their files as
// Vitest counts each (scripts/tools/test-cost-reporter.ts), on a full run (`--quick` skips the goldens, so it does not check). It holds the
// suite lean as scenarios are added (.claude/rules/code-standards.md, Test cost). The scenarios over it today are listed at what they took,
// measured on a 4-core cloud session, with BUDGET_SLACK for a busier machine; they may not grow past that, and a new scenario gets the default.
export const TEST_BUDGET_SECONDS = 40;
export const BUDGET_SLACK = 1.25;
export const OVER_BUDGET: Readonly<Record<string, number>> = {
  // Its tests part holds every test that imports its scene, the first scenario's, across the engine.
  "a-shadow-of-the-past": 103,
  "mount-gundabad": 77,
  "the-city-of-corsairs": 70,
  "roam-across-rhovanion": 60,
  "the-ghost-of-framsburg": 56,
  "the-withered-heath": 52,
  "fire-in-the-night": 48,
  "a-knife-in-the-dark": 47,
  "helms-deep": 43,
  "the-fate-of-wilderland": 41,
};

/** The budget problem of a run of the scenario's tests, from each file's ms, or null when it is within its budget. */
export function budgetProblem(id: string, times: Readonly<Record<string, number>>): string | null {
  const seconds = Object.values(times).reduce((sum, ms) => sum + ms, 0) / 1000;
  const listed = OVER_BUDGET[id];
  const limit = listed === undefined ? TEST_BUDGET_SECONDS : Math.round(listed * BUDGET_SLACK);
  if (seconds <= limit) return null;
  const slowest = Object.entries(times)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([file, ms]) => `${file} ${Math.round(ms / 1000)} s`)
    .join(", ");
  return `the scenario's tests took ${Math.round(seconds)} s, over its budget of ${limit} s (slowest: ${slowest}); see .claude/rules/code-standards.md, Test cost`;
}

export type Selection = {
  tests: string[];
  goldens: { files: string[]; title: string | null };
  coverage: string[];
  families: string[];
};

export const COVERAGE_TESTS = ["scripts/checks/effect-coverage.test.ts", "scripts/checks/effect-migration.test.ts", "scripts/checks/record-routes.test.ts", "src/effects/copies.test.ts", "test/harness/golden-registry.test.ts", "scripts/checks/file-size.test.ts", "scripts/checks/test-cost.test.ts", "scripts/checks/box-dealt.test.ts", "scripts/data/rules.test.ts", "scripts/checks/layout.test.ts", "scripts/checks/spec-coverage.test.ts", "scripts/docs/index.test.ts"];
export const READER_TEST = "src/play/reader-play.test.ts";
const WORDS_ROOT = "src/play/words/";
const WORDS_TEST = `${WORDS_ROOT}scenario-words.test.ts`;
const ASKS_TEST = `${WORDS_ROOT}asks.test.ts`;
export const GOLDEN_TESTS = ["src/campaign/fixtures.test.ts"];

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The test files that belong to the scenario: a folder called <id>, or a file that starts with <id> and then `-` or `.`, and any test that imports from
 * test/scenarios/<id>/ or src/campaign/scenarios/<id>/ (read through `read`, which returns a file's source).
 */
export function scenarioTests(id: string, tree: readonly string[], read: (file: string) => string): string[] {
  const named = new RegExp(`(^|/)${escapeRegExp(id)}(/|[-.][^/]*$)`);
  const spec = `["'][^"']*(?:test|campaign)/scenarios/${escapeRegExp(id)}/`;
  const imports = new RegExp(`^(?:import|export)\\s[^;]*?from\\s*${spec}|\\bawait\\s+import\\(\\s*${spec}`, "m");
  return tree.filter((file) => file.endsWith(".test.ts") && (named.test(file) || imports.test(read(file))));
}

const FAMILY_ROOTS = ["src/effects/authored/pool/", "src/effects/authored/families/", "src/catalog/families/", "src/rules/families/"];
// Files outside those folders that make or check the families: the hook dispatch and manifest types, the verb flags and the schema verb lists.
const FAMILY_FILES = [
  "src/rules/interpret/family-hooks.ts",
  "src/rules/interpret/family-manifest.ts",
  "src/catalog/family-manifest.ts",
  "src/catalog/verb-flags.ts",
  "src/catalog/verb-sets.ts",
  "src/catalog/effect-schema-verbs.ts",
];
// The two dispatch files affect every family; the rest name no family.
const EVERY_FAMILY_FILES = ["src/rules/interpret/family-hooks.ts", "src/rules/interpret/family-manifest.ts", "src/catalog/family-manifest.ts"];
const MANIFEST_TESTS = ["src/catalog/families/families.test.ts", "src/rules/interpret/family-manifest.test.ts", "src/rules/interpret/family-hooks.test.ts", "src/catalog/verb-sets.test.ts"];

/**
 * The pool and family tests, when they could have moved. A changed file under src/effects/authored/pool/, src/effects/authored/families/,
 * src/catalog/families/ or src/rules/families/, or one of FAMILY_FILES, adds the effects tests and the manifest tests (MANIFEST_TESTS), and the tests of
 * each family it names (src/rules/families/<family>/ for a file in that folder, or <family>.ts in the other three); a changed file directly in one of
 * those folders that names no family (an index), or a dispatch file, adds every family's tests.
 */
export function changedFamilyTests(changed: readonly string[], tree: readonly string[]): string[] {
  const touched = changed.filter((file) => FAMILY_FILES.includes(file) || FAMILY_ROOTS.some((root) => file.startsWith(root)));
  if (touched.length === 0) return [];
  const families = new Set<string>();
  let all = touched.some((file) => EVERY_FAMILY_FILES.includes(file));
  for (const file of touched) {
    const root = FAMILY_ROOTS.find((one) => file.startsWith(one));
    if (root === undefined || root === "src/effects/authored/pool/") continue;
    const rest = file.slice(root.length);
    const family = rest.includes("/") ? rest.split("/")[0] : rest.replace(/\.test\.ts$|\.ts$/, "");
    if (!family || family === "index") all = true;
    else families.add(family);
  }
  const effects = tree.filter((file) => file.startsWith("src/effects/") && file.endsWith(".test.ts"));
  const manifests = tree.filter((file) => MANIFEST_TESTS.includes(file));
  const engine = tree.filter((file) => {
    if (!file.startsWith("src/rules/families/") || !file.endsWith(".test.ts")) return false;
    return all || families.has(file.slice("src/rules/families/".length).split("/")[0] ?? "");
  });
  return [...new Set([...effects, ...manifests, ...engine])];
}

/** The scenario's title in the golden registry (`entry("<id>", "<title>", ...`), or null when it has no entry yet. */
export function registryTitle(id: string, registrySource: string): string | null {
  return new RegExp(`entry\\("${escapeRegExp(id)}", "([^"]+)"`).exec(registrySource)?.[1] ?? null;
}

// Scenarios whose goldens the registry-wide tests read without a registry entry: the whole files run, as no title filters them.
export const DIRECT_GOLDENS: Readonly<Record<string, readonly string[]>> = {
  "a-shadow-of-the-past": ["src/campaign/causes.test.ts", "src/campaign/replay.test.ts"],
};

const QUICK_NOTE = "skipped by --quick";

/** The parts `--quick` leaves out: the goldens (the registry-wide tests, the scenario's own golden test out of `tests`, and the tests that read its goldens directly) and the reader check. A pure function of the parts. */
export function quickParts<T extends { name: string; files: string[]; note?: string | undefined }>(parts: readonly T[], id: string, quick: boolean): T[] {
  if (!quick) return [...parts];
  return parts.map((part) => {
    if (part.name === "goldens" || part.name === "reader") return { ...part, files: [], note: QUICK_NOTE };
    if (part.name !== "tests") return part;
    // The scenario's own golden test, and the registry-wide tests that read its goldens directly (DIRECT_GOLDENS: replay and causes, run whole for a-shadow-of-the-past).
    const goldens = new Set([`src/campaign/scenarios/${id}/golden.test.ts`, ...(DIRECT_GOLDENS[id] ?? [])]);
    const files = part.files.filter((file) => !goldens.has(file));
    return files.length === part.files.length ? part : { ...part, files, note: `${QUICK_NOTE}: the scenario's golden tests` };
  });
}

export function selectTests(id: string, changed: readonly string[], tree: readonly string[], title: string | null, read: (file: string) => string): Selection {
  const present = (files: readonly string[]) => files.filter((file) => tree.includes(file));
  const tests = scenarioTests(id, tree, read);
  // Without a title the direct goldens run whole, unless the tests part already holds them (they import the scenario's scene).
  const goldens = title === null ? present(DIRECT_GOLDENS[id] ?? []).filter((file) => !tests.includes(file)) : present(GOLDEN_TESTS);
  const words = tree.filter((file) => file.startsWith(WORDS_ROOT) && file.endsWith(".test.ts") && !tests.includes(file));
  const coverage = [...present(COVERAGE_TESTS), ...words];
  // A file runs once: in the first part that names it.
  const taken = new Set([...tests, ...goldens, ...coverage]);
  return { tests, goldens: { files: goldens, title }, coverage, families: changedFamilyTests(changed, tree).filter((file) => !taken.has(file)) };
}

/** True when the scenario has games for the reader parity test: scenario 1 (a starter deck) or a scenario with a line in the golden registry (a commented-out line is none). */
export function hasReaderGames(id: string, registrySource: string): boolean {
  return id === "a-shadow-of-the-past" || new RegExp(`^\\s*entry\\("${escapeRegExp(id)}",`, "m").test(registrySource);
}

/** The player cards the scenario deals that have effect records: the campaign's starter decks when it opens the campaign, and player cards among its own. */
export function playerCodes(id: string, recorded: readonly string[]): string[] {
  const scenario = loadAnyScenario(id);
  const campaign = loadCampaignsInOrder().find((one) => one.scenarios.includes(id));
  const decks = campaign?.scenarios[0] === id ? (campaign.starterDecks ?? []).flatMap((deck) => deck.rows.map((row) => row.code)) : [];
  const own = new Set(loadCards().filter((card) => ["hero", "ally", "attachment", "event", "player-side-quest", "contract"].includes(card.type)).map((card) => card.code));
  const dealt = [...scenario.cards.map((card) => card.code), ...scenario.campaignPlaced, ...decks].filter((code) => own.has(code));
  const withRecords = new Set(recorded);
  return [...new Set(dealt)].filter((code) => withRecords.has(code));
}

const SMOKE_NODE = ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON"];

/** The card smokes of the scenario: the player cards' (skipped when it deals none), and the encounter smoke, which every scenario has. */
export function smokeRuns(id: string, playerCards: readonly string[]): { name: "smoke" | "encounter"; args: string[]; detail: string }[] {
  return [
    { name: "smoke", args: playerCards.length === 0 ? [] : [...SMOKE_NODE, "scripts/card-smoke/run.ts", ...playerCards], detail: playerCards.length === 0 ? "skipped (no player cards dealt)" : `${playerCards.length} cards` },
    { name: "encounter", args: [...SMOKE_NODE, "scripts/card-smoke/encounter.ts", id], detail: "encounter cards and seeded games" },
  ];
}

function git(args: string[]): string[] {
  const out = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (out.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${out.stderr}`);
  return out.stdout.split("\n").filter(Boolean);
}

/** The files changed since the merge base with origin/main (HEAD when there is no such ref), in the commits, the index and the working tree, and the untracked ones. */
function changedFiles(): string[] {
  const merged = spawnSync("git", ["merge-base", "HEAD", "origin/main"], { cwd: ROOT, encoding: "utf8" });
  const base = merged.status === 0 && merged.stdout.trim() !== "" ? merged.stdout.trim() : "HEAD";
  return [...new Set([...git(["diff", "--name-only", base]), ...git(["ls-files", "--others", "--exclude-standard"])])];
}

type PartResult = { name: string; ok: boolean; ms: number; detail: string };

function run(command: string, args: string[], env?: Record<string, string>): { ok: boolean; ms: number } {
  const begin = performance.now();
  const result = spawnSync(command, args, { cwd: ROOT, stdio: "inherit", env: { ...process.env, ...env } });
  return { ok: result.status === 0, ms: performance.now() - begin };
}

const vitest = (files: string[], filter?: string, reporters: string[] = []): string[] => ["exec", "vitest", "run", ...files, ...(filter === undefined ? [] : ["-t", escapeRegExp(filter)]), ...reporters];
const COST_REPORTERS = ["--reporter=default", "--reporter=./scripts/tools/test-cost-reporter.ts"];

async function main(log: Log): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const listOnly = process.argv.includes("--list");
  const wordsOnly = process.argv.includes("--words");
  const quick = process.argv.includes("--quick");
  const id = args[0];
  if (id === undefined || args.length > 1) throw new Error("Usage: pnpm test scenario <scenario-id> [--list | --quick | --words]");
  if (!existsSync(path.join(DATA_DIR, "scenarios", `${id}.json`))) throw new Error(`${id} is not a scenario in data/scenarios`);

  if (wordsOnly) {
    if (!existsSync(path.join(ROOT, WORDS_TEST))) throw new Error(`${WORDS_TEST} does not exist`);
    // The test reads the playable and the scaffolded scenarios only; for any other id vitest would run nothing and report success.
    if (!WORDS_SCENARIOS.includes(id)) throw new Error(`${id} is neither playable (src/campaign/playable.ts) nor scaffolded (src/campaign/scenarios/${id}/golden.test.ts), so the words test does not read it`);
    // The describe.each titles are "the words of <id>" and, for a scenario with an asks file, "the asks of <id>"; WORDS_DUMP makes them print the sentences.
    const asked = existsSync(path.join(ROOT, WORDS_ROOT, "asks", `${id}.ts`));
    const outcome = run("pnpm", ["exec", "vitest", "run", WORDS_TEST, ...(asked ? [ASKS_TEST] : []), "-t", `the (words|asks) of ${escapeRegExp(id)}`, "--silent=false"], { WORDS_DUMP: id });
    if (!outcome.ok) throw new Error("the words test failed");
    return;
  }

  const tree = [...git(["ls-files", "--cached", "--others", "--exclude-standard"])].filter((file) => /^(src|scripts|test)\/.*\.test\.ts$/.test(file) && existsSync(path.join(ROOT, file)));
  const changed = changedFiles();
  const registrySource = readFileSync(path.join(ROOT, "test/harness/golden-registry.ts"), "utf8");
  const title = registryTitle(id, registrySource);
  const selection = selectTests(id, changed, tree, title, (file) => readFileSync(path.join(ROOT, file), "utf8"));
  const smoke = playerCodes(id, smokeCodes());

  const readerGames = hasReaderGames(id, registrySource) && existsSync(path.join(ROOT, READER_TEST));
  const planned: { name: string; files: string[]; filter?: string; note?: string; env?: Record<string, string> }[] = [
    { name: "tests", files: selection.tests },
    { name: "goldens", files: selection.goldens.files, filter: selection.goldens.title ?? undefined, note: title === null ? (id in DIRECT_GOLDENS ? "no registry entry: replay.test.ts and causes.test.ts read its goldens directly and run whole in tests" : "no entry in test/harness/golden-registry.ts") : undefined },
    { name: "coverage", files: selection.coverage },
    { name: "families", files: selection.families, note: selection.families.length === 0 ? "no pool, family or manifest file changed" : undefined },
    { name: "reader", files: readerGames ? [READER_TEST] : [], note: readerGames ? undefined : "no games: the scenario has no line in test/harness/golden-registry.ts", env: { READER_PLAY_SCENARIO: id } },
  ];

  const parts = quickParts(planned, id, quick);

  if (listOnly) {
    for (const part of parts) {
      log.info(`${part.name}${part.filter ? ` (-t ${part.filter})` : ""}${part.note ? ` [${part.note}]` : ""}: ${part.files.length} files`);
      for (const file of part.files) log.info(`  ${file}`);
    }
    log.info(`smoke: ${smoke.length > 0 ? smoke.join(" ") : "no player cards dealt"}`);
    log.info(`encounter: scripts/card-smoke/encounter.ts ${id}`);
    return;
  }

  const results: PartResult[] = [];
  for (const part of parts) {
    if (part.files.length === 0) {
      results.push({ name: part.name, ok: true, ms: 0, detail: `skipped${part.note ? ` (${part.note})` : ""}` });
      continue;
    }
    // The scenario's own tests are timed on a full run, for the budget.
    const timed = part.name === "tests" && !quick;
    const costDir = timed ? mkdtempSync(path.join(os.tmpdir(), "test-cost-")) : null;
    const costFile = costDir ? path.join(costDir, "times.json") : null;
    const outcome = run("pnpm", vitest(part.files, part.filter, timed ? COST_REPORTERS : []), { ...part.env, ...(costFile ? { TEST_COST_OUT: costFile } : {}) });
    results.push({ name: part.name, ok: outcome.ok, ms: outcome.ms, detail: `${part.files.length} files${part.filter ? `, -t ${part.filter}` : ""}` });
    if (costFile && costDir) {
      const times = existsSync(costFile) ? (JSON.parse(readFileSync(costFile, "utf8")) as Record<string, number>) : null;
      rmSync(costDir, { recursive: true, force: true });
      const problem = times ? budgetProblem(id, times) : "the test times were not written";
      const seconds = times ? Math.round(Object.values(times).reduce((sum, ms) => sum + ms, 0) / 1000) : 0;
      results.push({ name: "budget", ok: problem === null, ms: 0, detail: problem ?? `${seconds} s of test time, within the budget` });
    }
  }
  for (const smoked of smokeRuns(id, smoke)) {
    if (smoked.args.length === 0) {
      results.push({ name: smoked.name, ok: true, ms: 0, detail: smoked.detail });
      continue;
    }
    const outcome = run("node", smoked.args);
    results.push({ name: smoked.name, ok: outcome.ok, ms: outcome.ms, detail: smoked.detail });
  }

  for (const result of results) (result.ok ? log.info : log.error)(`${result.name.padEnd(9)} ${result.ok ? "passed" : "FAILED"}  ${result.detail}${result.ms > 0 ? `  (${duration(result.ms)})` : ""}`);
  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) throw new Error(`failed: ${failed.map((result) => result.name).join(", ")}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) void runScript("test:scenario", main);
