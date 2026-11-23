import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runScript, type Log } from "../log.ts";

// The docs index (docs/INDEX.md): every file an agent reads, its size, the heading tree of the long ones with line ranges,
// and which code cites each section, so an agent reads one section instead of a whole file (rules/docs-standards.md).
// The index is not committed (.gitignore): pnpm install and the post-checkout and post-merge hooks (.githooks) write it
// with --refresh, which writes the file and reports no fault, so a doc fault never stops an install or a checkout.
// Usage: pnpm doc index rewrites docs/INDEX.md; pnpm doc section <file> "<heading>" prints one section; pnpm doc find "<words>"
// lists the headings that hold the words, so an agent need not read the index first.

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const INDEX_PATH = "docs/INDEX.md";

// A file at least this long gets its heading tree in the index; a shorter one is read whole.
const SECTIONED_BYTES = 12_000;
// Code whose comments cite a doc section.
const CITING_ROOTS = ["src", "scripts", "test", "tailwind.config.js"];
const CODE_FILE = /\.(ts|tsx|js|mjs|cjs)$/;

type Group = { title: string; note: string; files: string[] };

export type Heading = { level: number; text: string; start: number; end: number; bytes: number };

export type Citation = { from: string; doc: string; section: string };

function listFiles(dir: string, keep: (name: string) => boolean): string[] {
  const full = path.join(ROOT, dir);
  if (!existsSync(full)) return [];
  if (statSync(full).isFile()) return keep(full) ? [dir] : [];
  const found: string[] = [];
  for (const entry of readdirSync(full, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const child = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listFiles(child, keep));
    else if (keep(entry.name)) found.push(child.split(path.sep).join("/"));
  }
  return found;
}

// A folder that holds nothing yet (docs/handover between handovers) lists no files.
function markdownIn(dir: string, skip: (name: string) => boolean = () => false): string[] {
  if (!existsSync(path.join(ROOT, dir))) return [];
  return readdirSync(path.join(ROOT, dir))
    .filter((name) => name.endsWith(".md") && !skip(name))
    .sort()
    .map((name) => `${dir}/${name}`);
}

const stem = (name: string): string => name.replace(/\.md$/, "");

// A folder's files and those of the folders in it (docs/scenarios/<box>/<scenario-id>.md); a box file comes before its folder.
export function markdownTree(dir: string): string[] {
  if (!existsSync(path.join(ROOT, dir))) return [];
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .sort((a, b) => stem(a.name).localeCompare(stem(b.name)) || Number(a.isDirectory()) - Number(b.isDirectory()))
    .flatMap((entry) => {
      const child = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return markdownTree(child);
      return entry.name.endsWith(".md") ? [child] : [];
    });
}

export function groups(): Group[] {
  return [
    { title: "Every session", note: "Read whole.", files: ["CLAUDE.md", ...markdownIn(".claude/rules")] },
    { title: "Agents", note: "Each agent reads its own file.", files: markdownIn(".claude/agents") },
    { title: "Product, code and design", note: "Read the sections your task touches.", files: markdownIn("docs", (name) => name === "INDEX.md") },
    { title: "Scenarios", note: "A box file (docs/scenarios/<box>.md) holds what its scenarios share: campaign rules, pool cards, shared readings. A scenario file (docs/scenarios/<box>/<scenario-id>.md) holds that scenario's mechanics, readings, decisions and table pieces. Read the scenario your task names.", files: markdownTree("docs/scenarios") },
    { title: "Agent procedures", note: "The scenario procedure, the effect-authoring cookbook and the card audit; read when a task names one.", files: markdownIn("docs/agents") },
    { title: "Phases", note: "STATUS.md, then the active phase file.", files: ["docs/phases/STATUS.md", ...markdownIn("docs/phases", (name) => name === "STATUS.md")] },
    { title: "Live plans", note: "Read when a task names the plan.", files: markdownIn("docs/plans") },
    { title: "Handovers", note: "Open work; read when a task names it.", files: markdownIn("docs/handover") },
    { title: "For players", note: "Written for players, not agents: read it only when the task changes it.", files: ["README.md"] },
  ];
}

export function headingsOf(text: string): Heading[] {
  const lines = text.split("\n");
  const found: Heading[] = [];
  let fenced = false;
  lines.forEach((line, index) => {
    if (line.startsWith("```")) fenced = !fenced;
    const match = fenced ? null : /^(#{1,4}) (.+)$/.exec(line);
    if (match) found.push({ level: match[1]!.length, text: match[2]!.trim(), start: index + 1, end: lines.length, bytes: 0 });
  });
  for (const [i, heading] of found.entries()) {
    const next = found.slice(i + 1).find((other) => other.level <= heading.level);
    heading.end = next ? next.start - 1 : lines.length;
    heading.bytes = Buffer.byteLength(lines.slice(heading.start - 1, heading.end).join("\n"));
  }
  return found;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[`*_]/g, "").replace(/\s+/g, " ").trim();
}

// The heading a cited section name means: an exact match, else the first heading that starts with it, else one that
// contains it. "State and Play loop" names two: the first part that resolves wins. Null when none does.
export function resolveSection(headings: readonly Heading[], section: string): Heading | null {
  const name = normalize(section);
  if (name.length === 0) return null;
  const texts = headings.map((heading) => normalize(heading.text));
  // Whole words only, so "Table" does not match "Tablets".
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefix = new RegExp(`^${escaped}(?![\\p{L}\\p{N}])`, "u");
  const inside = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u");
  const at = [texts.findIndex((text) => text === name), texts.findIndex((text) => prefix.test(text)), texts.findIndex((text) => inside.test(text))].find((i) => i >= 0);
  if (at !== undefined) return headings[at]!;
  const parts = section.split(/ and /);
  return parts.length > 1 ? parts.map((part) => resolveSection(headings, part)).find((heading) => heading !== null) ?? null : null;
}

// "docs/brief.md, Card images; ..." or "design-system.md (Tablets)": the doc and the first section name after it.
const CITATION = /(?:docs\/)?((?:[a-z0-9-]+\/)*[a-z0-9-]+\.md)`?(?:, |,\n\s*(?:\/\/|\*)\s*| \()([A-Z§][^;:,()\n]*)/g;

export function citationsIn(file: string, text: string, docs: ReadonlyMap<string, string>): Citation[] {
  const found: Citation[] = [];
  for (const match of text.matchAll(CITATION)) {
    const doc = docs.get(match[1]!) ?? docs.get(path.basename(match[1]!));
    const section = match[2]!.replace(/\*\*/g, "").trim();
    if (doc && !section.startsWith("§") && !/^(phase|user|line|part|step) /i.test(section)) found.push({ from: file, doc, section });
  }
  return found;
}

type Indexed = { file: string; bytes: number; title: string; headings: Heading[] };

function load(file: string): Indexed {
  const text = readFileSync(path.join(ROOT, file), "utf8");
  const headings = headingsOf(text);
  const title = headings.find((heading) => heading.level === 1)?.text ?? /^description: (.+)$/m.exec(text)?.[1] ?? "";
  // An agent file's title is its description's first sentence.
  return { file, bytes: Buffer.byteLength(text), title: title.split(/(?<=\.) /)[0]!.replace(/\.$/, ""), headings };
}

function tokens(bytes: number): string {
  const count = bytes / 4;
  return count >= 1000 ? `${(count / 1000).toFixed(1)}K` : `${Math.max(10, Math.round(count / 10) * 10)}`;
}

export type Graph = { indexed: Indexed[]; citations: Citation[]; unresolved: Citation[]; citers: Map<string, Set<string>> };

export function buildGraph(): Graph {
  const indexed = groups().flatMap((group) => group.files).map(load);
  const docs = new Map<string, string>();
  for (const doc of indexed) {
    docs.set(doc.file.replace(/^docs\//, ""), doc.file);
    if (!docs.has(path.basename(doc.file))) docs.set(path.basename(doc.file), doc.file);
  }
  // Code comments, and the docs agents read (not the done plans, whose citations are history).
  const code = CITING_ROOTS.flatMap((root) => listFiles(root, (name) => CODE_FILE.test(name)));
  const live = groups().filter((group) => group.title !== "Done plans").flatMap((group) => group.files);
  const citations = [...code, ...live].flatMap((file) => citationsIn(file, readFileSync(path.join(ROOT, file), "utf8"), docs));
  const byFile = new Map(indexed.map((doc) => [doc.file, doc]));
  const citers = new Map<string, Set<string>>();
  const unresolved: Citation[] = [];
  for (const citation of citations) {
    const heading = resolveSection(byFile.get(citation.doc)!.headings, citation.section);
    if (!heading) {
      unresolved.push(citation);
      continue;
    }
    const key = `${citation.doc}#${heading.start}`;
    citers.set(key, (citers.get(key) ?? new Set()).add(citation.from));
  }
  return { indexed, citations, unresolved, citers };
}

// Headings whose text another heading of the same doc repeats: a citation and `pnpm doc section` find a heading by its text,
// so a repeated one hides its copies, and an edit to one copy leaves the other stale.
export function repeatedHeadings(graph: Graph): string[] {
  return graph.indexed.flatMap((doc) => {
    const seen = new Map<string, number>();
    const repeated: string[] = [];
    for (const heading of doc.headings) {
      const key = normalize(heading.text);
      const first = seen.get(key);
      if (first === undefined) seen.set(key, heading.start);
      else repeated.push(`${doc.file}:${heading.start}: "${heading.text}" repeats the heading at line ${first}`);
    }
    return repeated;
  });
}

// The headings of every indexed doc whose text holds all the words, with the doc, the line range and the size.
export function findHeadings(words: string, graph: Graph = buildGraph()): string[] {
  const wanted = normalize(words).split(" ").filter((word) => word.length > 0);
  return graph.indexed.flatMap((doc) =>
    doc.headings
      .filter((heading) => wanted.every((word) => normalize(heading.text).includes(word)))
      .map((heading) => `${doc.file}:${heading.start}-${heading.end} ${"#".repeat(heading.level)} ${heading.text} (~${tokens(heading.bytes)} tok)`),
  );
}

// Where the citing code lives, by directory: src/play, src/screens/routes, scripts/data.
function area(file: string): string {
  const parts = file.split("/");
  return parts.length <= 2 ? parts[0]! : parts.slice(0, 2).join("/");
}

export function renderIndex(graph: Graph = buildGraph()): string {
  const byFile = new Map(graph.indexed.map((doc) => [doc.file, doc]));
  const out: string[] = [
    "# Docs index",
    "",
    "Generated by `pnpm doc index` from the files below and the doc citations in code comments; a test fails when it is stale. Do not edit it by hand.",
    "",
    "Read a section, not a file: `pnpm doc section <file> \"<heading>\"` prints one section with its subsections (the file may be a basename such as `brief`); `pnpm doc find \"<words>\"` lists the headings that hold the words, so you need not read this index first. The line range works with an offset and limit too. ~tok is bytes / 4. `← n` is how many code files and docs cite the section; the last part of this file lists the code citations by area.",
    "",
  ];
  for (const group of groups()) {
    out.push(`## ${group.title}`, "", group.note, "");
    for (const file of group.files) {
      const doc = byFile.get(file)!;
      const title = doc.title ? ` — ${doc.title}` : "";
      out.push(`- \`${file}\`${title} (~${tokens(doc.bytes)} tok)`);
      if (doc.bytes < SECTIONED_BYTES || group.title === "Done plans") continue;
      for (const heading of doc.headings) {
        if (heading.level === 1 || heading.level > 3) continue;
        const cited = graph.citers.get(`${file}#${heading.start}`)?.size ?? 0;
        const indent = "  ".repeat(heading.level - 1);
        out.push(`${indent}- ${heading.start}–${heading.end} ${heading.text} (~${tokens(heading.bytes)})${cited > 0 ? ` ← ${cited}` : ""}`);
      }
    }
    out.push("");
  }
  out.push("## Code to docs", "", "The sections each area's comments cite, most cited first. Read these before changing code there.", "");
  const areas = new Map<string, Map<string, number>>();
  for (const [key, files] of graph.citers) {
    const [doc, start] = key.split("#") as [string, string];
    const heading = byFile.get(doc)!.headings.find((item) => item.start === Number(start))!;
    const label = `${doc.replace(/^docs\//, "")}, ${heading.text}`;
    for (const file of files) {
      if (!CODE_FILE.test(file)) continue;
      const counts = areas.get(area(file)) ?? new Map<string, number>();
      counts.set(label, (counts.get(label) ?? 0) + 1);
      areas.set(area(file), counts);
    }
  }
  for (const name of [...areas.keys()].sort()) {
    const ranked = [...areas.get(name)!].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    out.push(`- \`${name}\`: ${ranked.map(([label, count]) => `${label} (${count})`).join("; ")}`);
  }
  out.push("");
  return out.join("\n");
}

// The lines of one section: the file by path or basename, the heading by exact text, prefix or substring.
export function sectionText(fileArg: string, headingArg: string): string {
  const all = groups().flatMap((group) => group.files);
  const wanted = fileArg.replace(/\.md$/, "");
  const file = all.find((item) => item === fileArg || item.replace(/\.md$/, "") === wanted || path.basename(item).replace(/\.md$/, "") === wanted);
  if (!file) throw new Error(`no indexed doc named ${fileArg}; see ${INDEX_PATH}`);
  const text = readFileSync(path.join(ROOT, file), "utf8");
  const headings = headingsOf(text);
  const heading = resolveSection(headings, headingArg);
  if (!heading) throw new Error(`no heading in ${file} matches "${headingArg}"; pnpm doc find "${headingArg}" searches every doc`);
  return `${file}:${heading.start}-${heading.end}\n${text.split("\n").slice(heading.start - 1, heading.end).join("\n")}\n`;
}

// Writes the index for an install or a git hook: a checkout with no docs (a packed build) or a doc fault leaves the file as it is.
function refresh(log: Log): void {
  try {
    writeFileSync(path.join(ROOT, INDEX_PATH), renderIndex(buildGraph()));
  } catch (error) {
    log.debug(`index not written: ${String(error)}`);
  }
}

function main(log: Log): void {
  const [command, fileArg, ...rest] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  if (command === "section") {
    if (!fileArg || rest.length === 0) throw new Error('usage: pnpm doc section <file> "<heading>"');
    process.stdout.write(sectionText(fileArg, rest.join(" ")));
    return;
  }
  if (command === "find") {
    const words = [fileArg, ...rest].filter((word) => word !== undefined).join(" ");
    if (words.length === 0) throw new Error('usage: pnpm doc find "<words>"');
    const found = findHeadings(words);
    process.stdout.write(found.length > 0 ? `${found.join("\n")}\n` : `no heading holds "${words}"; see ${INDEX_PATH}\n`);
    return;
  }
  if (process.argv.includes("--refresh")) return refresh(log);
  const graph = buildGraph();
  writeFileSync(path.join(ROOT, INDEX_PATH), renderIndex(graph));
  log.info(`${graph.indexed.length} files, ${graph.citations.length} citations, ${graph.unresolved.length} unresolved`);
  for (const citation of graph.unresolved) log.warn(`${citation.from}: no heading in ${citation.doc} matches "${citation.section}"`);
  const repeated = repeatedHeadings(graph);
  for (const line of repeated) log.error(line);
  if (repeated.length > 0) throw new Error(`${repeated.length} repeated headings: give each section one heading, and merge the copies`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("docs:index", main, { done: false });
