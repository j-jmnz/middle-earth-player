import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { headingsOf, ROOT } from "../docs/index.ts";
import { tracked } from "./tracked.ts";

// The checks that keep what an agent reads small, single and current (.claude/rules/docs-standards.md, Agent context):
// the budget of the files every session loads, the size of one doc section, STATUS as pointers only, the brief without
// scenario sections, no paragraph written twice, agent files that point to a rule instead of repeating it, and no path to
// a doc that does not exist. scripts/checks/agent-docs.test.ts holds them with the exceptions listed at their size today.

// Claude Code loads CLAUDE.md and every file in .claude/rules/ into every session and every subagent.
export const RULES_BUDGET_BYTES = 26_000;
export const CLAUDE_MD_BUDGET_BYTES = 14_500;
// One agent file, which its agent reads on every run.
export const AGENT_FILE_BYTES = 10_000;
// The text of one heading, up to the next heading of any level: about 6K tokens, what an agent reads for one section.
export const SECTION_BYTES = 24_000;
export const STATUS_BYTES = 8_000;
// A paragraph this long written in two places is a copy: say it once and point to it.
export const COPY_MIN_CHARS = 200;

function read(file: string): string {
  return readFileSync(path.join(ROOT, file), "utf8");
}

function bytes(file: string): number {
  return statSync(path.join(ROOT, file)).size;
}

function markdownIn(dir: string): string[] {
  const full = path.join(ROOT, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return markdownIn(child);
    return entry.name.endsWith(".md") ? [child] : [];
  });
}

export const rulesFiles = (): string[] => markdownIn(".claude/rules").sort();
export const agentFiles = (): string[] => markdownIn(".claude/agents").sort();
// Everything an agent reads as instructions or docs; the generated index is left out.
export const agentDocs = (): string[] =>
  ["CLAUDE.md", ...rulesFiles(), ...agentFiles(), ...markdownIn("docs").filter((file) => file !== "docs/INDEX.md").sort()];

export function rulesBytes(): number {
  return rulesFiles().reduce((sum, file) => sum + bytes(file), 0);
}

export function claudeMdBytes(): number {
  return bytes("CLAUDE.md");
}

/** Agent files over AGENT_FILE_BYTES, as "file bytes". */
export function largeAgentFiles(): Record<string, number> {
  return Object.fromEntries(agentFiles().filter((file) => bytes(file) > AGENT_FILE_BYTES).map((file) => [file, bytes(file)]));
}

/** Sections whose own text (heading to the next heading) passes SECTION_BYTES, keyed "file#heading". */
export function largeSections(): Record<string, number> {
  const found: Record<string, number> = {};
  for (const file of agentDocs()) {
    const lines = read(file).split("\n");
    const headings = headingsOf(lines.join("\n"));
    headings.forEach((heading, i) => {
      const end = i + 1 < headings.length ? headings[i + 1]!.start - 1 : lines.length;
      const size = Buffer.byteLength(lines.slice(heading.start - 1, end).join("\n"));
      if (size > SECTION_BYTES) found[`${file}#${heading.text}`] = size;
    });
  }
  return found;
}

/** What is wrong with docs/phases/STATUS.md: over its size, or an Open items line that is not a pointer to an issue. */
export function statusProblems(): string[] {
  const file = "docs/phases/STATUS.md";
  const problems: string[] = [];
  if (bytes(file) > STATUS_BYTES) problems.push(`${file} is ${bytes(file)} bytes, over ${STATUS_BYTES}: open work goes to its area's issue`);
  const text = read(file);
  const open = /^## Open items\n([\s\S]*?)(?=^## )/m.exec(text)?.[1] ?? "";
  for (const line of open.split("\n")) {
    if (/^#{3,} /.test(line)) problems.push(`${file}: Open items has a subsection ("${line}"); list the work in its area's issue`);
    if (/^\s*[-*] /.test(line) && !/#\d+/.test(line)) problems.push(`${file}: an Open items line names no issue: "${line.slice(0, 80)}"`);
  }
  return problems;
}

/** Headings of docs/brief.md that are a scenario's name: a scenario's rulings belong in its box's file in docs/scenarios/. */
export function scenarioHeadingsInBrief(): string[] {
  const names = new Set(
    readdirSync(path.join(ROOT, "data/scenarios"))
      .filter((name) => name.endsWith(".json"))
      .map((name) => (JSON.parse(read(`data/scenarios/${name}`)) as { name?: string }).name?.toLowerCase())
      .filter((name): name is string => typeof name === "string"),
  );
  return headingsOf(read("docs/brief.md"))
    .filter((heading) => names.has(heading.text.toLowerCase()))
    .map((heading) => `docs/brief.md:${heading.start} ${heading.text}`);
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Paragraphs of COPY_MIN_CHARS or more written in more than one place, with the places. Code blocks and tables are left out. */
export function copiedParagraphs(): string[] {
  const places = new Map<string, string[]>();
  for (const file of agentDocs()) {
    const text = read(file).replace(/```[\s\S]*?```/g, "");
    for (const block of text.split(/\n\s*\n/)) {
      const paragraph = normalize(block);
      if (paragraph.length < COPY_MIN_CHARS || paragraph.startsWith("|") || paragraph.startsWith("#")) continue;
      places.set(paragraph, [...(places.get(paragraph) ?? []), file]);
    }
  }
  return [...places].filter(([, files]) => files.length > 1).map(([paragraph, files]) => `${files.join(", ")}: "${paragraph.slice(0, 90)}…"`);
}

// Lines an agent file must not hold: each repeats a rule its owner already states, or sends the agent to read again
// what Claude Code has already loaded. The owners are the files allowed to say it.
export const FORBIDDEN: readonly { name: string; pattern: RegExp; owners: readonly string[]; scope: "agent" | "all" }[] = [
  { name: "a Claude co-author line", pattern: /co-authored-by/i, owners: [".claude/rules/agent-standards.md", ".claude/rules/commit-standards.md"], scope: "all" },
  { name: "the phone and tablet rule", pattern: /phone and tablet checks are not tracked/i, owners: ["CLAUDE.md", ".claude/rules/code-standards.md"], scope: "all" },
  { name: "a second read of CLAUDE.md", pattern: /\bread\b(?: first)?:? `?CLAUDE\.md/i, owners: [], scope: "agent" },
  { name: "a second read of a rules file", pattern: /\bread\b(?: first)?:?[^.\n]{0,40}`\.claude\/rules\//i, owners: [], scope: "agent" },
  { name: "a restated agent-standards line", pattern: /follow `\.claude\/rules\/agent-standards\.md`/i, owners: [], scope: "agent" },
];

/** Each forbidden line found outside its owners, as "file: name". Agent scope is .claude/agents/ and docs/agents/. */
export function forbiddenLines(): string[] {
  const found: string[] = [];
  for (const file of agentDocs()) {
    const isAgent = file.startsWith(".claude/agents/") || file.startsWith("docs/agents/");
    const text = read(file);
    for (const rule of FORBIDDEN) {
      if (rule.scope === "agent" && !isAgent) continue;
      if (rule.owners.includes(file)) continue;
      if (rule.pattern.test(text)) found.push(`${file}: ${rule.name}`);
    }
  }
  return found;
}

const DOC_PATH = /(?<![\w/.-])((?:docs|\.claude|\.github)\/[\w./-]+?\.md)\b/g;
const TEXT_FILE = /\.(ts|tsx|js|mjs|cjs|md|ya?ml|json)$/;
// These checks name the paths and the files they allow, so they do not read themselves.
const SELF = /^scripts\/checks\/agent-docs(\.test)?\.ts$/;

/** Paths to a doc that does not exist, as "path ← file", in every tracked text file (not data/raw or the index). */
export function missingDocPaths(): string[] {
  const found = new Set<string>();
  for (const file of tracked(["."])) {
    if (!TEXT_FILE.test(file) || SELF.test(file) || file.startsWith("data/raw/") || file === "docs/INDEX.md") continue;
    for (const match of read(file).matchAll(DOC_PATH)) {
      const doc = match[1]!;
      if (!existsSync(path.join(ROOT, doc))) found.add(`${doc} ← ${file}`);
    }
  }
  return [...found].sort();
}

/** Code that names STATUS for an open item: an open item is a line in its area's issue, so the code names the issue. */
export function codeCitingStatus(): string[] {
  return tracked()
    .filter((file) => /^(src|scripts|test)\//.test(file) && /\.(ts|tsx)$/.test(file) && !SELF.test(file))
    .filter((file) => read(file).includes("docs/phases/STATUS.md"));
}
