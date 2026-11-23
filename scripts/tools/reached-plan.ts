import { DIRECT_GOLDENS, GOLDEN_TESTS, changedFamilyTests, registryTitle } from "./test-scenario.ts";
import { chooseTests, namePattern, type Chosen } from "./test-lines.ts";

// The choice behind `pnpm test reached` (test-reached.ts): from the files a change touched, the records that moved and what the scenarios deal, which tests to run. Pure functions over
// those inputs, so a test reads them without a git tree. The rules, in the order the plan prints them:
//   1. a test that imports a changed file (vitest's module graph), except a record file: every test imports the records, so a record is read through rules 2 and 3;
//   2. a test that names the id of a record that moved, or of a printed line it owns (`pnpm test lines`);
//   3. for each playable scenario that deals a card of such a record: its golden test, its line in the registry-wide golden test and its encounter smoke; for a player card, the card smoke;
//   4. a change to engine code (src/rules, src/catalog), or to the generated records or scenarios, reaches no card by its text: every golden test and every smoke shard run;
//   5. a change to a doc selects the doc checks, a change under data/ or scripts/data/ the data tests and `pnpm data check`; a change to the build or test configuration selects everything.

export type Kind = "records" | "engine" | "data" | "docs" | "config" | "other";

const CONFIG = /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig[^/]*\.json|vitest\.config\.mts|\.oxlintrc\.json|\.github\/|\.githooks\/)/;
const TEST_FILE = /\.test\.tsx?$/;
const RECORD_ROOT = "src/effects/authored/";

/** The kind of a changed file: the first that applies. A test file is `other`, whatever folder it is in. */
export function kindOf(file: string): Kind {
  if (/^(docs|\.claude)\//.test(file) || file.endsWith(".md")) return "docs";
  if (CONFIG.test(file)) return "config";
  if (TEST_FILE.test(file)) return "other";
  if (file.startsWith(RECORD_ROOT)) return "records";
  if (file.startsWith("data/") || file.startsWith("scripts/data/") || file.startsWith("src/effects/generated/")) return "data";
  if ((file.startsWith("src/rules/") || file.startsWith("src/catalog/")) && file !== "src/catalog/version.ts") return "engine";
  return "other";
}

/** The changed files to ask vitest for the tests that import them: not a record file (rule 1), not a doc, and still on disk. */
export function relatedSeeds(changed: readonly string[], exists: (file: string) => boolean): string[] {
  return changed.filter((file) => kindOf(file) !== "records" && kindOf(file) !== "docs" && /\.(ts|tsx|json|mts|sql)$/.test(file) && exists(file));
}

/** The card code of a record id (`01026:action:1`). */
export const cardOf = (recordId: string): string => recordId.split(":")[0] ?? recordId;

export type ReachInput = {
  changed: readonly string[];
  /** Every test file of the repository. */
  tree: readonly string[];
  /** The test files that import a changed file, from vitest. */
  related: readonly string[];
  /** The records that moved between the base and the working tree, and their printed line ids; null when no file that holds records changed. */
  moved: { records: readonly string[]; lines: readonly string[] } | null;
  sources: Readonly<Record<string, string>>;
  /** The playable scenarios, each with every card code it deals (and its campaign's starter decks when it opens the campaign). */
  deals: Readonly<Record<string, ReadonlySet<string>>>;
  /** The player cards that have a card smoke. */
  smokeable: ReadonlySet<string>;
  registrySource: string;
};

export type ReachedPlan = {
  kinds: Record<Kind, string[]>;
  /** Test files that run whole, each with the first reason that chose it. */
  whole: Map<string, string>;
  /** Test files that run with `-t <pattern>`: only the tests that name a moved record or line. */
  titled: Chosen[];
  pattern: string | null;
  /** Titles of the registry-wide golden test (`fixtures.test.ts`) for the reached scenarios. */
  fixtureTitles: string[];
  scenarios: { id: string; codes: string[] }[];
  encounter: string[];
  smoke: string[];
  dataCheck: boolean;
  /** The reason every golden test and smoke shard run, or null. */
  games: string | null;
  everything: boolean;
  /** Moved cards no playable scenario deals and no card smoke plays. */
  unplaced: string[];
};

const goldenTestOf = (id: string) => `src/campaign/scenarios/${id}/golden.test.ts`;

/** The test files that play games: every scenario's golden test, the registry-wide golden test, the files that read goldens directly, and every card-smoke shard. */
export function gameTests(tree: readonly string[]): string[] {
  return tree.filter((file) => /^src\/campaign\/scenarios\/[^/]+\/golden\.test\.ts$/.test(file) || GOLDEN_TESTS.includes(file) || Object.values(DIRECT_GOLDENS).some((list) => list.includes(file)) || file.startsWith("scripts/card-smoke/"));
}

export function planReached(input: ReachInput): ReachedPlan {
  const { changed, tree } = input;
  const have = new Set(tree);
  const kinds: Record<Kind, string[]> = { records: [], engine: [], data: [], docs: [], config: [], other: [] };
  for (const file of changed) kinds[kindOf(file)].push(file);
  const whole = new Map<string, string>();
  const add = (files: readonly string[], why: string) => {
    for (const file of files) if (have.has(file) && !whole.has(file)) whole.set(file, why);
  };
  const everything = kinds.config.length > 0;
  if (everything) add(tree, "a build or test configuration file changed");
  add(input.related, "imports a changed file");
  add(changedFamilyTests(changed, tree), "a pool, family or manifest file changed");
  if (kinds.docs.length > 0) add(tree.filter((file) => file === "scripts/checks/agent-docs.test.ts" || (file.startsWith("scripts/docs/") && TEST_FILE.test(file))), "a doc or agent file changed");
  if (kinds.data.length > 0) add(tree.filter((file) => file.startsWith("scripts/data/") && TEST_FILE.test(file)), "a file under data/ or scripts/data/ changed");

  // Rule 2 and 3: the records that moved.
  const ids = new Set([...(input.moved?.records ?? []), ...(input.moved?.lines ?? [])]);
  const chosen = ids.size > 0 ? chooseTests(ids, input.sources) : [];
  const codes = new Set((input.moved?.records ?? []).map(cardOf));
  const scenarios = Object.entries(input.deals)
    .map(([id, dealt]) => ({ id, codes: [...codes].filter((code) => dealt.has(code)).sort() }))
    .filter((one) => one.codes.length > 0);
  for (const one of scenarios) add([goldenTestOf(one.id), ...(DIRECT_GOLDENS[one.id] ?? [])], `deals ${one.codes.length === 1 ? one.codes[0] : `${one.codes.length} cards of moved records`}`);
  const smoke = [...codes].filter((code) => input.smokeable.has(code)).sort();
  const dealtSomewhere = new Set(scenarios.flatMap((one) => one.codes));
  const unplaced = [...codes].filter((code) => !dealtSomewhere.has(code) && !input.smokeable.has(code)).sort();

  // Rule 4: engine code, or generated records and scenarios, show in no card's text.
  const generated = changed.filter((file) => file.startsWith("src/effects/generated/") || file.startsWith("data/scenarios/") || file.startsWith("data/campaigns/"));
  const games = kinds.engine.length > 0 ? `engine code changed (${kinds.engine.length} files under src/rules or src/catalog), which no record's text shows` : generated.length > 0 ? `generated records or scenarios changed (${generated.length} files)` : null;
  if (games !== null) add(gameTests(tree), games);

  // A titled file that also runs whole is not run twice.
  const titled = chosen.filter((one) => one.titles > 0 && !whole.has(one.file));
  for (const one of chosen.filter((one) => one.titles === 0)) add([one.file], "names a moved record or line, with no test title that holds it");
  const fixtureTitles = whole.has(GOLDEN_TESTS[0]!) ? [] : scenarios.flatMap((one) => registryTitle(one.id, input.registrySource) ?? []);
  const pattern = titled.length > 0 ? namePattern([...ids]) : null;
  return {
    kinds,
    whole,
    titled,
    pattern,
    fixtureTitles,
    scenarios,
    // The smoke shards that run for games already play every scenario's encounter cards and every player card.
    encounter: games !== null ? [] : scenarios.map((one) => one.id),
    smoke: games !== null ? [] : smoke,
    dataCheck: kinds.data.length > 0,
    games,
    everything,
    unplaced,
  };
}

/** The test files the plan runs, whole or with `-t` (a fixture title counts the registry-wide golden test once). */
export function plannedFiles(plan: ReachedPlan): Set<string> {
  return new Set([...plan.whole.keys(), ...plan.titled.map((one) => one.file), ...(plan.fixtureTitles.length > 0 ? GOLDEN_TESTS : [])]);
}

const groupOf = (file: string): string => {
  if (/(^|\/)golden\.test\.ts$/.test(file)) return "scenario golden tests";
  const parts = file.split("/");
  return parts.length > 2 ? `${parts[0]}/${parts[1]}/` : `${parts[0]}/`;
};

/** The test files the plan leaves out, counted by folder (a scenario's golden tests as one group), largest first. */
export function notRun(tree: readonly string[], ran: ReadonlySet<string>): { count: number; groups: [string, number][] } {
  const counts = new Map<string, number>();
  let count = 0;
  for (const file of tree) {
    if (ran.has(file)) continue;
    count += 1;
    counts.set(groupOf(file), (counts.get(groupOf(file)) ?? 0) + 1);
  }
  return { count, groups: [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) };
}
