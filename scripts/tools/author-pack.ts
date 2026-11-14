import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bytes, runScript, type Log } from "../log.ts";
import { dealtCodes, loadCampaigns, loadScenario } from "../data/load-scenarios.ts";
import { ROOT } from "../data/paths.ts";
import { sectionText } from "../docs/index.ts";

// The context a scenario author reads in place of the brief's full list (docs/agents/agent-brief.md, Scenario procedure):
//
//   pnpm scenario pack <scenario-id> [--no-draft]
//
// Runs `pnpm effects draft <id>` (`--no-draft` reads the drafts already in .agent/drafts), then writes .agent/pack/<id>.md, which is not committed. It holds, in this order:
//   - the vocabulary file the drafts link to (.agent/drafts/vocabulary.md);
//   - the schema entries (and the comment on each) of the verbs the drafts' nearest records and exact matches use, from the core schema files and the family manifests (src/catalog/families/<family>.ts)
//     that declare them: an entry, not the whole manifest, since one manifest is tens of KB;
//   - the sections of docs/agents/effect-authoring.md those records need: a fixed set every author reads, and the ones for picks, amounts, conditions and triggers when a record uses them;
//   - the engine files of the families those records use, as paths with line counts;
//   - the rules text the drafts cite, each span once, then the drafts, one section each, each citing its spans by rule id.

const COOKBOOK = "docs/agents/effect-authoring.md";
const FAMILIES_DIR = "src/catalog/families";
// Where the core verbs are declared, beside the families' manifests.
const CORE_FILES = ["src/catalog/effect-schema-verbs.ts", "src/catalog/effect-schema.ts"] as const;
const DRAFTS_DIR = ".agent/drafts";

/** The cookbook sections every author reads: where records live, copies, the record's shape, the readings a review catches, how a new mechanic is added and what stays open. */
export const ALWAYS_SECTIONS = ["Where records live", "Templates and copied lines", "The record", "Readings the review catches", "Mechanic families: engine and records together", "Not expressible yet: leave open, report"] as const;

// The sections a record's JSON asks for, in cookbook order: [section, the field or verb whose presence adds it].
const BY_NEED: readonly (readonly [string, RegExp])[] = [
  ["Which card an instruction acts on", /"verb":"(Pick|Choose|Each|ForEachPlayer|Repeat|Delay|AfterAttack)"|"(target|of|card|subject)":/],
  ["Pick filters", /"pick":\{|"verb":"(Pick|Each)"/],
  ["Amounts", /"(count|stat|x|players|threat|hand|dealt|times|plus)":/],
  ["Conditions", /"(condition|when)":/],
  ["Triggers and stat flags", /"trigger":|"verb":"ModifyStat"/],
  ["Patterns", /"verb":"/],
];

export type PackPlan = {
  /** Every verb the drafts' records use. */
  verbs: string[];
  /** The sources that declare one of those verbs, in name order: a family's name, or a core schema file's path. */
  families: string[];
  /** The cookbook headings, in the order they are written. */
  sections: string[];
};

/** The text of a draft that holds records: after its "Line by line" heading, where exact matches and nearest records are written as JSON. The rest of a draft (DragnCards' automation) is not a record. */
export function recordsOf(draft: string): string {
  const at = draft.indexOf("## Line by line");
  return at < 0 ? "" : draft.slice(at);
}

/**
 * What the drafts need: the verbs their records use, the families that declare those verbs (`familyOf`, from the manifests) and the cookbook sections.
 * The cookbook sections keep the cookbook's own order, the fixed ones among them.
 */
export function packPlan(drafts: readonly string[], familyOf: ReadonlyMap<string, string>, cookbookHeadings: readonly string[]): PackPlan {
  const records = drafts.map(recordsOf).join("\n");
  const verbs = [...new Set([...records.matchAll(/"verb":"(\w+)"/g)].map((found) => found[1] ?? ""))].sort();
  const families = [...new Set(verbs.flatMap((verb) => familyOf.get(verb) ?? []))].sort();
  const wanted = new Set<string>(ALWAYS_SECTIONS);
  for (const [section, need] of BY_NEED) if (need.test(records)) wanted.add(section);
  return { verbs, families, sections: cookbookHeadings.filter((heading) => wanted.has(heading)) };
}

// A verb's declaration: `verb: z.literal("Name")`, or the `verb("Name")` and `codeVerb("Name")` helpers of effect-schema-verbs.ts.
const DECLARES = /verb:\s*z\.literal\("(\w+)"\)|\b(?:code)?[vV]erb\("(\w+)"\)/;

const declaredIn = (line: string): string | undefined => {
  const name = DECLARES.exec(line);
  return name?.[1] ?? name?.[2];
};

/** The source that declares each verb: a manifest of src/catalog/families (by name) or a core schema file (by path). The first source in name order wins. */
export function verbFamilies(sources: ReadonlyMap<string, string>): Map<string, string> {
  const found = new Map<string, string>();
  for (const [source, text] of [...sources].sort(([a], [b]) => a.localeCompare(b))) {
    for (const line of text.split("\n")) {
      const verb = declaredIn(line);
      if (verb !== undefined && !found.has(verb)) found.set(verb, source);
    }
  }
  return found;
}

// A line's change in bracket depth, with strings and a trailing comment left out.
function depthChange(line: string): number {
  const bare = line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, "").replace(/\/\/.*$/, "");
  let change = 0;
  for (const char of bare) change += "([{".includes(char) ? 1 : ")]}".includes(char) ? -1 : 0;
  return change;
}

/**
 * The schema entries of `verbs` in a source file, each with the comment lines directly above it: the statement (an array element, or a `const` of its own) that holds the verb's declaration.
 * `header` is the file's leading comment. Statements are cut by bracket depth, so an entry of several lines comes whole.
 */
export function entriesFor(text: string, verbs: ReadonlySet<string>): { header: string; entries: string[] } {
  const lines = text.split("\n");
  const starts: number[] = [];
  let depth = 0;
  for (const line of lines) {
    starts.push(depth);
    depth += depthChange(line);
  }
  const comment = (line: string | undefined): boolean => line?.trimStart().startsWith("//") === true;
  const header = lines.slice(0, Math.max(0, lines.findIndex((line) => !comment(line)))).join("\n");
  const taken = new Set<number>();
  const entries: string[] = [];
  lines.forEach((line, at) => {
    const verb = declaredIn(line);
    if (verb === undefined || !verbs.has(verb)) return;
    let first = at;
    while (first > 0 && ((starts[first] ?? 0) > 1 || comment(lines[first]) || lines[first]?.trim() === "")) first -= 1;
    const base = starts[first] ?? 0;
    let last = first;
    let open = base + depthChange(lines[first] ?? "");
    while (open > base && last + 1 < lines.length) {
      last += 1;
      open += depthChange(lines[last] ?? "");
    }
    let top = first;
    while (top > 0 && comment(lines[top - 1])) top -= 1;
    if (taken.has(top)) return;
    taken.add(top);
    entries.push(lines.slice(top, last + 1).join("\n"));
  });
  return { header, entries };
}

/** The drafts of `names` (file names, `<code>.md`) that belong to the scenario, those of a card it deals, and the others, which another scenario's run (or `effects draft` for a pack) left in the folder. */
export function draftsOfScenario(names: readonly string[], dealt: ReadonlySet<string>): { kept: string[]; others: string[] } {
  const kept = names.filter((name) => dealt.has(name.slice(0, -3)));
  return { kept, others: names.filter((name) => !kept.includes(name)) };
}

/** The `##` headings of a doc, in order. */
export function headingsIn(doc: string): string[] {
  return doc.split("\n").flatMap((line) => (/^## /.test(line) ? [line.slice(3).trim()] : []));
}

const SPANS_HEADING = "## Rules text that mentions its terms";

/**
 * A draft's rules spans, taken out: the draft with its "Rules text that mentions its terms" section cut to one line of the rule ids it cites, and the spans themselves (`### <rule id> (<doc> p<page>)` and the text under it).
 * A draft with no such section comes back as it is.
 */
export function takeSpans(draft: string): { text: string; spans: { id: string; block: string }[] } {
  const start = draft.indexOf(`${SPANS_HEADING}\n`);
  if (start < 0) return { text: draft, spans: [] };
  const afterHeading = start + SPANS_HEADING.length + 1;
  const next = draft.indexOf("\n## ", afterHeading - 1);
  const end = next < 0 ? draft.length : next + 1;
  const body = draft.slice(afterHeading, end);
  const spans = body
    .split(/^(?=### )/m)
    .filter((block) => block.startsWith("### "))
    .map((block) => ({ id: /^### (\S+)/.exec(block)?.[1] ?? "", block: block.trimEnd() }));
  const cited = spans.length === 0 ? "None." : `Rule ids (text under "Rules text" above): ${spans.map((span) => span.id).join(", ")}.`;
  return { text: `${draft.slice(0, start)}${SPANS_HEADING.replace("mentions its terms", "cited")}\n${cited}\n\n${draft.slice(end)}`, spans };
}

export type EngineFamily = { family: string; files: readonly { path: string; lines: number }[] };

export type PackParts = {
  id: string;
  vocabulary: string;
  plan: PackPlan;
  sources: ReadonlyMap<string, string>;
  sections: readonly string[];
  engine: readonly EngineFamily[];
  drafts: readonly { name: string; text: string }[];
};

/** The pack's text: a short header, then the four parts. */
export function renderPack(parts: PackParts): string {
  const out = [
    `# Author pack for ${parts.id}`,
    ``,
    `Written by \`pnpm scenario pack ${parts.id}\`; not committed. It replaces the brief's full reading list (docs/agents/agent-brief.md, Scenario procedure): the vocabulary, the schema entries of the verbs the drafts' records use (from ${parts.plan.families.join(", ") || "no file"}), the cookbook sections those records need, and the ${parts.drafts.length} draft${parts.drafts.length === 1 ? "" : "s"}.`,
    `An entry is cut from its file: a helper it names (\`code\`, \`pile\`, \`when\`) is declared higher in that file. The fields a verb takes are the entry's.`,
    ``,
    `# Part 1: the vocabulary`,
    ``,
    parts.vocabulary.trimEnd(),
    ``,
    `# Part 2: verb entries`,
    ``,
  ];
  const used = new Set(parts.plan.verbs);
  if (parts.plan.families.length === 0) out.push(`None: no draft's nearest record uses a verb of a family or the core schema.`, ``);
  for (const source of parts.plan.families) {
    const file = source.includes("/") ? source : `${FAMILIES_DIR}/${source}.ts`;
    const { header, entries } = entriesFor(parts.sources.get(source) ?? "", used);
    out.push(`## ${file}`, ``, "```ts", ...(header === "" ? [] : [header, ""]), ...entries.flatMap((entry) => [entry, ""]), "```", ``);
  }
  out.push(`# Part 3: ${COOKBOOK}`, ``);
  for (const section of parts.sections) out.push(section.trimEnd(), ``);
  if (parts.engine.length > 0) {
    out.push(`Engine files of those families (read these, do not search for them):`, ``);
    for (const { family, files } of parts.engine) out.push(`- ${family}: ${files.map((file) => `${file.path} (${file.lines})`).join(", ")}`);
    out.push(``);
  }
  out.push(`# Part 4: the drafts`, ``);
  if (parts.drafts.length === 0) out.push(`None: no printed line of ${parts.id} is without a record.`, ``);
  // Each rules span once, in order of first appearance; a draft keeps the list of the ids it cites.
  const taken = parts.drafts.map((draft) => ({ name: draft.name, ...takeSpans(draft.text) }));
  const blocks = [...new Set(taken.flatMap((draft) => draft.spans.map((span) => span.block)))];
  if (blocks.length > 0) out.push(`## Rules text`, ``, `Cited by the drafts below, each span once.`, ``, ...blocks.flatMap((block) => [block, ``]));
  for (const draft of taken) out.push(`## ${draft.name}`, ``, draft.text.trimEnd(), ``);
  return `${out.join("\n")}\n`;
}

// The engine files of each family in `families` (core schema paths have none): src/rules/families/<family>/*.ts without tests, and the family's manifest, with line counts.
function engineFilesOf(families: readonly string[]): EngineFamily[] {
  const lines = (file: string): number => readFileSync(path.join(ROOT, file), "utf8").split("\n").length - 1;
  return families
    .filter((family) => !family.includes("/"))
    .map((family) => {
      const folder = `src/rules/families/${family}`;
      const engine = existsSync(path.join(ROOT, folder)) ? readdirSync(path.join(ROOT, folder)).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts")).sort() : [];
      const files = [`${FAMILIES_DIR}/${family}.ts`, ...engine.map((name) => `${folder}/${name}`)];
      return { family, files: files.map((file) => ({ path: file, lines: lines(file) })) };
    });
}

function main(log: Log): void {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const id = args[0];
  if (id === undefined || args.length > 1) throw new Error("Usage: pnpm scenario pack <scenario-id> [--no-draft]");
  if (!existsSync(path.join(ROOT, "data", "scenarios", `${id}.json`))) throw new Error(`${id} is not a scenario in data/scenarios`);
  if (!process.argv.includes("--no-draft")) {
    const drafted = spawnSync("node", ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/data/effects/draft.ts", id], { cwd: ROOT, encoding: "utf8" });
    if (drafted.status !== 0) throw new Error(`effects draft ${id} failed:\n${drafted.stdout}${drafted.stderr}`);
    log.debug(drafted.stderr.trim());
  }
  const draftsDir = path.join(ROOT, DRAFTS_DIR);
  const vocabularyPath = path.join(draftsDir, "vocabulary.md");
  if (!existsSync(vocabularyPath)) throw new Error(`${DRAFTS_DIR}/vocabulary.md is missing: run pnpm effects draft ${id} first`);
  // Only the drafts of the scenario's own cards: with --no-draft the folder may hold another scenario's.
  const present = readdirSync(draftsDir).filter((name) => name.endsWith(".md") && name !== "vocabulary.md").sort();
  const { kept, others } = draftsOfScenario(present, dealtCodes(loadCampaigns(), [loadScenario(id)], { nightmare: true }));
  if (others.length > 0) log.warn(`${DRAFTS_DIR} holds ${others.length} draft${others.length === 1 ? "" : "s"} of cards ${id} does not deal (${others.join(", ")}): left out of the pack. Run without --no-draft to rewrite the folder for ${id}.`);
  const drafts = kept.map((name) => ({ name, text: readFileSync(path.join(draftsDir, name), "utf8") }));
  const sources = new Map<string, string>([
    ...readdirSync(path.join(ROOT, FAMILIES_DIR))
      .filter((name) => name.endsWith(".ts") && name !== "index.ts" && !name.endsWith(".test.ts"))
      .map((name) => [name.slice(0, -3), readFileSync(path.join(ROOT, FAMILIES_DIR, name), "utf8")] as const),
    ...CORE_FILES.map((file) => [file, readFileSync(path.join(ROOT, file), "utf8")] as const),
  ]);
  const cookbook = readFileSync(path.join(ROOT, COOKBOOK), "utf8");
  const plan = packPlan(drafts.map((draft) => draft.text), verbFamilies(sources), headingsIn(cookbook));
  const sections = plan.sections.map((heading) => sectionText(COOKBOOK, heading));
  const text = renderPack({ id, vocabulary: readFileSync(vocabularyPath, "utf8"), plan, sources, sections, engine: engineFilesOf(plan.families), drafts });
  const target = path.join(ROOT, ".agent", "pack", `${id}.md`);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, text);
  log.debug(`verbs: ${plan.verbs.join(", ") || "none"}; families: ${plan.families.join(", ") || "none"}; sections: ${plan.sections.join(" | ")}`);
  const size = Buffer.byteLength(text);
  log.info(`.agent/pack/${id}.md: ${bytes(size)} (about ${Math.round(size / 4)} tokens), ${drafts.length} drafts, ${plan.families.length} schema files, ${plan.sections.length} cookbook sections`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("author:pack", main, { done: false });
