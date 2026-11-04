import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { loadCards } from "../data/load-cards.ts";
import { loadCampaignsInOrder, loadScenario } from "../data/load-scenarios.ts";
import { DATA_DIR, ROOT } from "../data/paths.ts";
import { duration, runScript, type Log } from "../log.ts";
import { smokeCodes } from "../card-smoke/world.ts";

// The tests to run while a scenario is being authored, a fraction of the full suite (docs/plans/scenario-pipeline.md, section F):
//
//   pnpm test:scenario <scenario-id> [--list]
//
// Parts, each its own vitest run (or the card smoke), so a failure names its part:
//   tests      the test files whose path names the scenario: its folder under src/campaign/scenarios/, src/play/scenarios/<id>-*.test.ts, ...
//   goldens    the registry-wide golden tests, filtered (-t) to the scenario's title in test/harness/golden-registry.ts: causes, replay,
//              and the Maestro fixtures; with the registry's own test, which lists a golden.json that has no entry
//   coverage   the effect coverage and migration checks and the copied-lines test
//   smoke      scripts/card-smoke/run.ts on the player cards the scenario deals (skipped when it deals none)
//   families   the family and pool tests, when files of those changed since HEAD (changedFamilyTests)
// `--list` prints the files and codes without running anything. The full `pnpm test` stays the gate before a commit and in CI
// (docs/architecture.md, Tests).

export type Selection = {
  tests: string[];
  goldens: { files: string[]; title: string | null };
  coverage: string[];
  families: string[];
};

export const COVERAGE_TESTS = ["scripts/checks/effect-coverage.test.ts", "scripts/checks/effect-migration.test.ts", "src/effects/copies.test.ts", "test/harness/golden-registry.test.ts"];
export const GOLDEN_TESTS = ["src/campaign/causes.test.ts", "src/campaign/replay.test.ts", "src/campaign/fixtures.test.ts"];

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The test files whose path names the scenario: a folder called <id>, or a file that starts with <id> and then `-` or `.`. */
export function scenarioTests(id: string, tree: readonly string[]): string[] {
  const named = new RegExp(`(^|/)${escapeRegExp(id)}(/|[-.][^/]*$)`);
  return tree.filter((file) => file.endsWith(".test.ts") && named.test(file));
}

/**
 * The pool and family tests, when they could have moved. A changed file under src/effects/authored/pool/, src/effects/authored/families/,
 * src/catalog/families/ or src/rules/families/ adds the effects tests and the family manifest test, and the tests of each family it names
 * (src/rules/families/<family>/ for a file in that folder, or <family>.ts in the other three); a changed file directly in one of those
 * folders that names no family (an index) adds every family's tests.
 */
export function changedFamilyTests(changed: readonly string[], tree: readonly string[]): string[] {
  const roots = ["src/effects/authored/pool/", "src/effects/authored/families/", "src/catalog/families/", "src/rules/families/"];
  const touched = changed.filter((file) => roots.some((root) => file.startsWith(root)));
  if (touched.length === 0) return [];
  const families = new Set<string>();
  let all = false;
  for (const file of touched) {
    if (file.startsWith("src/effects/authored/pool/")) continue;
    const root = roots.find((one) => file.startsWith(one)) ?? "";
    const rest = file.slice(root.length);
    const family = rest.includes("/") ? rest.split("/")[0] : rest.replace(/\.test\.ts$|\.ts$/, "");
    if (!family || family === "index") all = true;
    else families.add(family);
  }
  const effects = tree.filter((file) => file.startsWith("src/effects/") && file.endsWith(".test.ts"));
  const manifest = tree.filter((file) => file === "src/catalog/families/families.test.ts");
  const engine = tree.filter((file) => {
    if (!file.startsWith("src/rules/families/") || !file.endsWith(".test.ts")) return false;
    return all || families.has(file.slice("src/rules/families/".length).split("/")[0] ?? "");
  });
  return [...new Set([...effects, ...manifest, ...engine])];
}

/** The scenario's title in the golden registry (`entry("<id>", "<title>", ...`), or null when it has no entry yet. */
export function registryTitle(id: string, registrySource: string): string | null {
  return new RegExp(`entry\\("${escapeRegExp(id)}", "([^"]+)"`).exec(registrySource)?.[1] ?? null;
}

export function selectTests(id: string, changed: readonly string[], tree: readonly string[], title: string | null): Selection {
  const present = (files: readonly string[]) => files.filter((file) => tree.includes(file));
  return {
    tests: scenarioTests(id, tree),
    goldens: { files: title === null ? [] : present(GOLDEN_TESTS), title },
    coverage: present(COVERAGE_TESTS),
    families: changedFamilyTests(changed, tree),
  };
}

/** The player cards the scenario deals that have effect records: the campaign's starter decks when it opens the campaign, and player cards among its own. */
export function playerCodes(id: string, recorded: readonly string[]): string[] {
  const scenario = loadScenario(id);
  const campaign = loadCampaignsInOrder().find((one) => one.scenarios.includes(id));
  const decks = campaign?.scenarios[0] === id ? (campaign.starterDecks ?? []).flatMap((deck) => deck.rows.map((row) => row.code)) : [];
  const own = new Set(loadCards().filter((card) => ["hero", "ally", "attachment", "event", "player-side-quest", "contract"].includes(card.type)).map((card) => card.code));
  const dealt = [...scenario.cards.map((card) => card.code), ...scenario.campaignPlaced, ...decks].filter((code) => own.has(code));
  const withRecords = new Set(recorded);
  return [...new Set(dealt)].filter((code) => withRecords.has(code));
}

function git(args: string[]): string[] {
  const out = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (out.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${out.stderr}`);
  return out.stdout.split("\n").filter(Boolean);
}

type PartResult = { name: string; ok: boolean; ms: number; detail: string };

function run(command: string, args: string[]): { ok: boolean; ms: number } {
  const begin = performance.now();
  const result = spawnSync(command, args, { cwd: ROOT, stdio: "inherit" });
  return { ok: result.status === 0, ms: performance.now() - begin };
}

const vitest = (files: string[], filter?: string): string[] => ["exec", "vitest", "run", ...files, ...(filter === undefined ? [] : ["-t", escapeRegExp(filter)])];

async function main(log: Log): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const listOnly = process.argv.includes("--list");
  const id = args[0];
  if (id === undefined || args.length > 1) throw new Error("Usage: pnpm test:scenario <scenario-id> [--list]");
  if (!existsSync(path.join(DATA_DIR, "scenarios", `${id}.json`))) throw new Error(`${id} is not a scenario in data/scenarios`);

  const tree = [...git(["ls-files", "--cached", "--others", "--exclude-standard"])].filter((file) => /^(src|scripts|test)\/.*\.test\.ts$/.test(file) && existsSync(path.join(ROOT, file)));
  const changed = [...git(["diff", "--name-only", "HEAD"]), ...git(["ls-files", "--others", "--exclude-standard"])];
  const title = registryTitle(id, readFileSync(path.join(ROOT, "test/harness/golden-registry.ts"), "utf8"));
  const selection = selectTests(id, changed, tree, title);
  const smoke = playerCodes(id, smokeCodes());

  const parts: { name: string; files: string[]; filter?: string; note?: string }[] = [
    { name: "tests", files: selection.tests },
    { name: "goldens", files: selection.goldens.files, filter: selection.goldens.title ?? undefined, note: title === null ? "no entry in test/harness/golden-registry.ts" : undefined },
    { name: "coverage", files: selection.coverage },
    { name: "families", files: selection.families, note: selection.families.length === 0 ? "no pool or family file changed" : undefined },
  ];

  if (listOnly) {
    for (const part of parts) {
      log.info(`${part.name}${part.filter ? ` (-t ${part.filter})` : ""}${part.note ? ` [${part.note}]` : ""}: ${part.files.length} files`);
      for (const file of part.files) log.info(`  ${file}`);
    }
    log.info(`smoke: ${smoke.length > 0 ? smoke.join(" ") : "no player cards dealt"}`);
    return;
  }

  const results: PartResult[] = [];
  for (const part of parts) {
    if (part.files.length === 0) {
      results.push({ name: part.name, ok: true, ms: 0, detail: `skipped${part.note ? ` (${part.note})` : ""}` });
      continue;
    }
    const outcome = run("pnpm", vitest(part.files, part.filter));
    results.push({ name: part.name, ok: outcome.ok, ms: outcome.ms, detail: `${part.files.length} files${part.filter ? `, -t ${part.filter}` : ""}` });
  }
  if (smoke.length === 0) results.push({ name: "smoke", ok: true, ms: 0, detail: "skipped (no player cards dealt)" });
  else {
    const outcome = run("node", ["--experimental-strip-types", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/card-smoke/run.ts", ...smoke]);
    results.push({ name: "smoke", ok: outcome.ok, ms: outcome.ms, detail: `${smoke.length} cards` });
  }

  for (const result of results) (result.ok ? log.info : log.error)(`${result.name.padEnd(9)} ${result.ok ? "passed" : "FAILED"}  ${result.detail}${result.ms > 0 ? `  (${duration(result.ms)})` : ""}`);
  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) throw new Error(`failed: ${failed.map((result) => result.name).join(", ")}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) void runScript("test:scenario", main);
