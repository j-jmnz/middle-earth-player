import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCards } from "../data/load-cards.ts";
import { loadAnyScenario, loadCampaignsInOrder } from "../data/load-scenarios.ts";
import { seedFinderRel } from "../data/effects/seed-finder-paths.ts";
import { ROOT } from "../data/paths.ts";
import { runScript, type Log } from "../log.ts";
import { cycleGameFile, cycleGoldenTestFile, cycleSeedFinderFile, standaloneTestFile } from "./scenario-new-cycle.ts";
import { asksFile, authoredFile, authoredPath, campaignTestFile, camel, gameFile, goldenTestFile, seedFinderFile, specTestFile, type Facts, type PreviousPart } from "./scenario-new-files.ts";

// Writes the skeleton of a scenario that data/scenarios already has, and the lines that register it, so the work left is the scenario's own
// (docs/agents/agent-brief.md, Scenario procedure):
//
//   pnpm scenario new <scenario-id> [--short <name>] [--dry-run]
//
// Files (never overwritten: if any exists the command refuses, listing them): the game (test/scenarios/<id>/), the golden test, the campaign test and the
// spec rows (src/campaign/scenarios/<id>/), the choice words as an asks file (src/play/words/asks/<id>.ts, listed in its barrel by pnpm data build), the seed finder
// (scripts/e2e/<id>.ts, or in the campaign's folder: scripts/data/effects/seed-finder-paths.ts), the authored effects file (src/effects/authored/<id>.ts, or in the campaign's folder: scripts/data/effects/authored-paths.ts) and the empty fixture file
// (src/campaign/fixtures/<id>.json). There is no scene file: the game, the golden test and the campaign test read the scenario from data/, and the card tests are spec rows
// (on tableFromLayout).
// A scenario of a cycle (Shadows of Mirkwood, data/campaigns kind "cycle") has no campaign card and no Campaign Mode: its game is the standalone game
// (test/harness/game-kit.ts, standaloneGame), its golden suite the standalone one, `standalone.test.ts` stands in for the campaign test, its fixtures are one
// open standalone game each (`kind: "standalone"` in the fixture registry) 
// Registry lines: the fixture registry, the JSON import and FILES entry in src/campaign/fixtures.ts, the writer in scripts/e2e/writers.ts,
// and the golden registry (test/harness/golden-registry.ts), whose two lines are written as comments because that registry's test fails
// on an entry with no golden.json. Nothing else runs: the next commands are printed.
// `--short` is the name the identifiers and fixture names start from (lower-case letters and digits, no hyphen; default: the id's last word, "ruins" for the-drowned-ruins, unless `SHORT_OF` names another).
// Every registry edit stays inside the object or array it changes (`insert`): a line follows the previous part's entry when that is in the block, else it goes before the block's closing line.

export type Repo = {
  read: (file: string) => string | null;
};

export type Edit = { file: string; before: string; after: string };
export type Plan = { files: { file: string; text: string }[]; edits: Edit[]; facts: Facts };

const FIXTURE_REGISTRY = "src/campaign/fixtures/registry.ts";
const FIXTURES = "src/campaign/fixtures.ts";
const WRITERS = "scripts/e2e/writers.ts";
const GOLDEN_REGISTRY = "test/harness/golden-registry.ts";

function words(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

// A property name for a card: its name in camelCase, with the code when two cards share a name or the name starts with a digit.
function keyFor(name: string, code: string, used: Set<string>): string {
  const parts = words(name);
  let key = parts.map((part, index) => (index === 0 ? part.charAt(0).toLowerCase() + part.slice(1) : part.charAt(0).toUpperCase() + part.slice(1))).join("");
  if (key === "" || /^[0-9]/.test(key)) key = `card${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  if (used.has(key)) key = `${key}${code}`;
  used.add(key);
  return key;
}

// A scenario whose last word another scenario already uses (The Dread Realm owns "realm", Flight from Moria "moria", The Caves of Nibin-Dûm and The Battle of Carn Dûm "dum") starts from another word.
const SHORT_OF: Readonly<Record<string, string>> = { "the-woodland-realm": "woodland", "the-mines-of-moria": "mines", "escape-from-khazad-dum": "khazad" };

function defaultShort(id: string): string {
  return SHORT_OF[id] ?? id.split("-").at(-1) ?? id;
}

/** The facts of the scenario: its data, the campaign that plays it and the part before it. */
function factsOf(id: string, short: string, repo: Repo): Facts {
  const scenario = loadAnyScenario(id);
  const campaign = loadCampaignsInOrder().find((one) => one.scenarios.includes(id));
  if (!campaign) throw new Error(`${id} is in no campaign or cycle of data/campaigns`);
  const cycle = campaign.kind === "cycle";
  const at = campaign.scenarios.indexOf(id);
  const names = new Map(loadCards().map((card) => [card.code, card.name]));
  const used = new Set<string>(["campaignCard"]);
  const card = scenario.campaignCard;
  const codes: [string, string, string][] = card === undefined ? [] : [["campaignCard", card, names.get(card) ?? card]];
  const seen = new Set<string>(card === undefined ? [] : [card]);
  scenario.stages.forEach((code, index) => {
    seen.add(code);
    used.add(`stage${index + 1}`);
    codes.push([`stage${index + 1}`, code, names.get(code) ?? code]);
  });
  for (const code of [...scenario.cards.map((card) => card.code), ...scenario.campaignPlaced]) {
    if (seen.has(code)) continue;
    seen.add(code);
    const name = names.get(code) ?? code;
    codes.push([keyFor(name, code, used), code, name]);
  }
  const previousId = at > 0 ? (campaign.scenarios[at - 1] ?? null) : null;
  return { id, name: scenario.name, short, campaignId: campaign.id, cycle, part: at + 1, previous: previousId ? previousPart(previousId, campaign.id, repo, cycle) : null, finderRel: seedFinderRel(id, campaign.id), campaignCard: card ?? null, stages: scenario.stages, codes };
}

// The names the previous part's modules export, from the places that list them (the golden registry line, the seed finder's functions).
// A previous part with no seed finder is an error: a finder built on a blank log would drop the earlier parts without a word.
// A cycle's part reads no earlier log, so its previous part's finder is not needed: only the entry the registry lines follow.
function previousPart(id: string, campaignId: string, repo: Repo, cycle: boolean): PreviousPart {
  const name = loadAnyScenario(id).name;
  const registry = repo.read(GOLDEN_REGISTRY) ?? "";
  const line = new RegExp(`^\\s*entry\\("${id}",\\s*"[^"]*",\\s*(\\w+)\\.(\\w+),\\s*\\1\\.(\\w+),\\s*\\1\\.(\\w+)\\),?$`, "m").exec(registry);
  const finderRel = seedFinderRel(id, campaignId);
  const finder = repo.read(`scripts/e2e/${finderRel}.ts`);
  if (cycle) return { id, name, finderRel, game: null, finder: { exists: finder != null, earlierLog: null } };
  if (finder == null) throw new Error(`the previous part ${id} has no seed finder at scripts/e2e/${finderRel}.ts: scaffold or move it first (scripts/data/effects/seed-finder-paths.ts)`);
  const earlierLog = finder ? (/export async function (\w+)\(\): Promise<CampaignLog>/.exec(finder)?.[1] ?? null) : null;
  return {
    id,
    name,
    finderRel,
    game: line ? { alias: line[1] as string, goldens: line[2] as string, world: line[3] as string, play: line[4] as string } : null,
    finder: { exists: true, earlierLog },
  };
}

// The object or array an edit changes, from its declaration line to its closing line.
type Block = { start: RegExp; end: RegExp };
const FIXTURE_ARRAY: Block = { start: /^export const FIXTURE_REGISTRY = \[/, end: /^\] as const/ };
const FILES_MAP: Block = { start: /^const FILES\b/, end: /^};$/ };
const WRITERS_MAP: Block = { start: /^export const WRITERS\b/, end: /^};$/ };
const GOLDEN_ARRAY: Block = { start: /^export const GOLDEN_REGISTRY\b/, end: /^\];$/ };

// The line indexes strictly between the block's declaration and its closing line, or null when the block is not in the file.
function rangeOf(lines: readonly string[], block: Block): [number, number] | null {
  const start = lines.findIndex((one) => block.start.test(one));
  if (start < 0) return null;
  const end = lines.findIndex((one, index) => index > start && block.end.test(one));
  return end < 0 ? null : [start + 1, end];
}

// Whether a line of the block matches `anchor`.
function blockHas(text: string, block: Block, anchor: RegExp): boolean {
  const lines = text.split("\n");
  const range = rangeOf(lines, block);
  return range != null && lines.slice(range[0], range[1]).some((one) => anchor.test(one));
}

// An edit inserts `line` into the text and nothing else. With `block` it stays inside that object: without an anchor the line goes before the
// block's closing line; with one the anchor must match exactly one line of the block (more is refused) and the line goes after or before it.
// Without `block` the anchor is searched in the whole file: `after` follows the last matching line, `before` precedes the first.
function insert(text: string, file: string, place: { block?: Block; anchor?: RegExp }, line: string, where: "after" | "before", problems: string[]): string {
  const lines = text.split("\n");
  const range = place.block ? rangeOf(lines, place.block) : ([0, lines.length] as [number, number]);
  if (!range) {
    problems.push(`${file}: no block matching ${place.block?.start} to put "${line.trim()}" in`);
    return text;
  }
  let at: number;
  if (!place.anchor) at = range[1];
  else {
    const anchor = place.anchor;
    const matches = lines.flatMap((one, index) => (index >= range[0] && index < range[1] && anchor.test(one) ? [index] : []));
    if (matches.length === 0) {
      problems.push(`${file}: no line matches ${anchor} to put "${line.trim()}" ${where}`);
      return text;
    }
    if (place.block && matches.length > 1) {
      problems.push(`${file}: ${matches.length} lines of the block match ${anchor}; refusing to guess where "${line.trim()}" goes`);
      return text;
    }
    at = where === "after" ? (matches.at(-1) as number) + 1 : (matches[0] as number);
  }
  return [...lines.slice(0, at), line, ...lines.slice(at)].join("\n");
}

export function planScenario(id: string, options: { short?: string }, repo: Repo, exists: (file: string) => boolean): { plan: Plan | null; problems: string[] } {
  const problems: string[] = [];
  let facts: Facts;
  try {
    loadAnyScenario(id);
  } catch {
    return { plan: null, problems: [`${id} is not in data/scenarios (the scenario files are built by pnpm data build)`] };
  }
  const short = options.short ?? defaultShort(id);
  // The short name starts identifiers (`${camel}Fixtures`, `${SHORT}_SEEDS`, `import * as ${short}`), so it must be one.
  if (!/^[a-z][a-z0-9]*$/.test(short)) return { plan: null, problems: [`--short ${short} is not a valid identifier (lower-case letters and digits, starting with a letter, no hyphen)`] };
  try {
    facts = factsOf(id, short, repo);
  } catch (error) {
    return { plan: null, problems: [error instanceof Error ? error.message : String(error)] };
  }

  const files = [
    { file: `test/scenarios/${id}/game.ts`, text: facts.cycle ? cycleGameFile(facts) : gameFile(facts) },
    { file: `src/campaign/scenarios/${id}/golden.test.ts`, text: facts.cycle ? cycleGoldenTestFile(facts) : goldenTestFile(facts) },
    facts.cycle ? { file: `src/campaign/scenarios/${id}/standalone.test.ts`, text: standaloneTestFile(facts) } : { file: `src/campaign/scenarios/${id}/campaign.test.ts`, text: campaignTestFile(facts) },
    { file: `src/campaign/scenarios/${id}/spec.test.ts`, text: specTestFile(facts) },
    { file: `src/play/words/asks/${id}.ts`, text: asksFile(facts) },
    { file: `scripts/e2e/${facts.finderRel}.ts`, text: facts.cycle ? cycleSeedFinderFile(facts) : seedFinderFile(facts) },
    { file: authoredPath(facts), text: authoredFile(facts) },
    { file: `src/campaign/fixtures/${id}.json`, text: "{}\n" },
  ];
  const present = files.filter((item) => exists(item.file)).map((item) => item.file);
  if (present.length > 0) return { plan: null, problems: [`${id} already has: ${present.join(", ")}`] };

  // The registries, each read as it is and edited in memory.
  const c = camel(short);
  const previous = facts.previous?.id;
  const edits: Edit[] = [];
  const edit = (file: string, make: (text: string) => string): void => {
    const text = repo.read(file);
    if (text == null) {
      problems.push(`${file} is missing`);
      return;
    }
    const after = make(text);
    if (after !== text) edits.push({ file, before: text, after });
  };

  edit(FIXTURE_REGISTRY, (text) => {
    if (text.includes(`scenarioId: "${id}"`) || text.includes(`"${short}-lost"`)) {
      problems.push(`${FIXTURE_REGISTRY} already names ${id} or ${short}-lost: pass --short with another name`);
      return text;
    }
    // The loss alone: a scenario gets no won fixture (docs/architecture.md, Tests).
    const line = facts.cycle ? `  { scenarioId: "${id}", kind: "standalone", names: ["${short}-lost"] },` : `  { scenarioId: "${id}", names: ["${short}-lost"] },`;
    const after = new RegExp(`scenarioId: "${previous}"`);
    return previous && blockHas(text, FIXTURE_ARRAY, after) ? insert(text, FIXTURE_REGISTRY, { block: FIXTURE_ARRAY, anchor: after }, line, "after", problems) : insert(text, FIXTURE_REGISTRY, { block: FIXTURE_ARRAY }, line, "before", problems);
  });
  edit(FIXTURES, (text) => {
    if (new RegExp(`\\b${c}Fixtures\\b`).test(text)) {
      problems.push(`${FIXTURES} already has ${c}Fixtures: pass --short with another name`);
      return text;
    }
    let next = insert(text, FIXTURES, { anchor: /^import \w+ from "\.\/fixtures\/[a-z0-9-]+\.json";$/ }, `import ${c}Fixtures from "./fixtures/${id}.json";`, "after", problems);
    const entry = `  "${id}": ${c}Fixtures,`;
    const after = new RegExp(`^  "${previous}": `);
    next = previous && blockHas(next, FILES_MAP, after) ? insert(next, FIXTURES, { block: FILES_MAP, anchor: after }, entry, "after", problems) : insert(next, FIXTURES, { block: FILES_MAP }, entry, "before", problems);
    return next;
  });
  edit(WRITERS, (text) => {
    if (new RegExp(`\\b${c}Fixtures\\b`).test(text)) {
      problems.push(`${WRITERS} already has ${c}Fixtures: pass --short with another name`);
      return text;
    }
    let next = insert(text, WRITERS, { anchor: /^import \{ \w+Fixtures \} from "\.\/[a-z0-9-\/]+\.ts";$/ }, `import { ${c}Fixtures } from "./${facts.finderRel}.ts";`, "after", problems);
    const entry = `  "${id}": () => ${c}Fixtures(),`;
    const after = new RegExp(`^  "${previous}": `);
    next = previous && blockHas(next, WRITERS_MAP, after) ? insert(next, WRITERS, { block: WRITERS_MAP, anchor: after }, entry, "after", problems) : insert(next, WRITERS, { block: WRITERS_MAP }, entry, "before", problems);
    return next;
  });
  edit(GOLDEN_REGISTRY, (text) => {
    if (new RegExp(`import \\* as ${short} `).test(text) || text.includes(`"${id}"`)) {
      problems.push(`${GOLDEN_REGISTRY} already names ${id} or an import ${short}: pass --short with another name`);
      return text;
    }
    const imported = `// import * as ${short} from "../scenarios/${id}/game.ts";`;
    const registered = `  // entry("${id}", "${facts.name}", ${short}.${short.toUpperCase().replace(/-/g, "_")}_GOLDENS, ${short}.${c}World, ${short}.playGolden),`;
    const next = insert(text, GOLDEN_REGISTRY, { anchor: /^import \* as \w+ from "\.\.\/scenarios\/[a-z0-9-]+\/game\.ts";$/ }, imported, "after", problems);
    return insert(next, GOLDEN_REGISTRY, { block: GOLDEN_ARRAY }, registered, "before", problems);
  });
  if (problems.length > 0) return { plan: null, problems };
  return { plan: { files, edits, facts }, problems };
}

function describePlan(plan: Plan, log: Log, dry: boolean): void {
  log.info(`${dry ? "would write" : "writing"} ${plan.files.length} files for ${plan.facts.id} (${plan.facts.campaignId} ${plan.facts.cycle ? "cycle (standalone) " : ""}part ${plan.facts.part}, fixtures ${plan.facts.short}-won and ${plan.facts.short}-lost):`);
  for (const item of plan.files) log.info(`  new   ${item.file}`);
  log.info(`${dry ? "would edit" : "editing"} ${plan.edits.length} registries:`);
  for (const item of plan.edits) {
    log.info(`  edit  ${item.file}`);
    for (const line of addedLines(item.before.split("\n"), item.after.split("\n"))) log.info(`          + ${line.trim()}`);
  }
}

// The lines `after` has that `before` does not, in order (the edits only insert).
function addedLines(before: readonly string[], after: readonly string[]): string[] {
  const rest = [...before];
  const added: string[] = [];
  for (const line of after) {
    if (rest[0] === line) rest.shift();
    else added.push(line);
  }
  return added;
}

function nextSteps(facts: Facts, log: Log): void {
  log.info("next (docs/agents/agent-brief.md, Scenario procedure):");
  log.info("  pnpm data build                   rewrites the barrels of authored effect files (src/effects/generated/authored.ts) and of asks files (src/play/words/asks/index.ts)");
  log.info(`  pnpm scenario pack ${facts.id}   runs effects draft and writes .agent/pack/${facts.id}.md: the vocabulary, the families' manifests the drafts need, the cookbook sections and the drafts`);
  log.info("  pnpm effects open                 after the records, then add the scenario to src/campaign/playable.ts when none of its lines is open");
  log.info(`  fill the skeletons: spec rows (src/campaign/scenarios/${facts.id}/spec.test.ts)${facts.cycle ? ", the standalone test" : ""}, asks (src/play/words/asks/${facts.id}.ts), test/scenarios/${facts.id}/game.ts, the golden test (a skipped suite), the seed finder; then list the goldens in test/harness/golden-registry.ts`);
}

function main(log: Log): void {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((arg) => arg.startsWith("--")));
  const shortAt = args.indexOf("--short");
  const short = shortAt >= 0 ? args[shortAt + 1] : undefined;
  const taken = (index: number): boolean => shortAt >= 0 && index === shortAt + 1;
  const id = args.find((arg, index) => !arg.startsWith("--") && !taken(index));
  if (!id) throw new Error("usage: pnpm scenario new <scenario-id> [--short <name>] [--dry-run]");
  const repo: Repo = {
    read: (file) => {
      try {
        return readFileSync(path.join(ROOT, file), "utf8");
      } catch {
        return null;
      }
    },
  };
  const { plan, problems } = planScenario(id, short === undefined ? {} : { short }, repo, (file) => existsSync(path.join(ROOT, file)));
  if (!plan) {
    for (const problem of problems) log.error(problem);
    process.exitCode = 1;
    return;
  }
  const dry = flags.has("--dry-run");
  describePlan(plan, log, dry);
  if (!dry) {
    for (const item of plan.files) {
      const target = path.join(ROOT, item.file);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, item.text);
    }
    for (const item of plan.edits) writeFileSync(path.join(ROOT, item.file), item.after);
  }
  nextSteps(plan.facts, log);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("scenario:new", main, { done: false });
