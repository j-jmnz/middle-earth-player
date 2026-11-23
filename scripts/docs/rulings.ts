import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runScript, type Log } from "../log.ts";

import { headingsOf, ROOT } from "./index.ts";

// The register of user rulings: every place docs/brief.md and docs/scenarios/*.md stamp a reading or a choice as the user's ("user ruling, 2026-11-05", "user decision",
// "user instruction", "user request", "user-accepted", "user-confirmed", "Rulings (user, 2026-11-06):", "the user asked for this reading", "the user named"), with or
// without a date. It is settled until the user changes it, so a brief for a fix agent names the ones its task touches. A stamp that heads a list ("Rulings (user, ...):"
// followed by sub-bullets, or by "(1) ... (7) ...") covers the whole list; a sentence already inside a listed bullet or list is not listed again. Each entry is a
// card or rule reading (it names a card code, a printed line id or a rule id, or sits in docs/scenarios/ or in a rules section of the brief) or a product decision
// (a "user request" that names none of those, or any stamp elsewhere: platforms, screens, settings, sources). Left out on purpose: "user report" (a bug report, not
// a decision), "Not user-confirmed" and "Readings not yet confirmed by the user" (the opposite of a stamp), and "the user chose" in the Decisions intro of the Core round.
// Usage: pnpm doc rulings [<words>] [--all] prints each reading whose text, file, heading or kind holds all the words; --all adds the product decisions.

export type Ruling = {
  file: string;
  /** The deepest heading above the stamp, "" before the first. */
  section: string;
  /** The first line of the reading in the file. */
  line: number;
  /** The last line it covers (a stamp that heads a list covers the sub-bullets). */
  lastLine: number;
  /** The sentence that holds the stamp (the whole bullet when the stamp sits in its bold label; the heading and its items for a stamp that heads a list). */
  sentence: string;
  dates: string[];
  /** Printed line ids (`<code>:<side>:<n>`) the sentence names. */
  lineIds: string[];
  /** Card codes the sentence names, with those of its line ids. */
  codes: string[];
  /** Rule ids (`rr.travel`, `faq.errata.131013`) the sentence names. */
  ruleIds: string[];
  kind: "reading" | "decision";
  /** For a stamp that heads a list: the bullet the list belongs to (a word of it finds the list). */
  bullet?: string;
};

export const STAMP = /(?<!\bnot )\buser(?:[- ](?:rulings?|decisions?|instructions?|requests?|accepted|confirmed)\b|,(?=\s*\d{4}-)|\s+(?:asked|named)\b)[^)\n]{0,60}/gi;
const DATE = /\d{4}-\d{2}-\d{2}/g;
export const LINE_ID = /(?<![\w:])(\d{2,6}):[A-Za-z]+:\d+(?![\w])/g;
export const CODE = /(?<![\w:./-])\d{5,6}(?![\w/])/g;
export const RULE_ID = /(?<![\w./-])(?:rr|faq|ltp|dcce|mec\d+|dwd|decklist|emce|sotm|tdom|hon|easy-mode|trg|bts|wor)\.[a-z0-9][\w.-]*[a-z0-9]/g;
// The brief's sections that state rules and card readings; a stamp in another section is a product decision unless it names a card or a rule.
const RULE_SECTIONS = /^(?:Campaign|Mirkwood campaign|Standalone play|Scenario state|The engine plays|Engine steps|Core round|Player card readings|Keywords implemented|Player side quests|Window stack|Three layers|Coverage test)/;

const BREAK = /(?<=(?<!\bMr)(?<!\bSt)[.!?])\s+(?=[A-Z"*`(])/g;
const indentOf = (line: string): number => line.length - line.trimStart().length;

/** The sentence of `line` that holds the character at `at`, as [start, end]: from the last sentence break before it to the next one after. */
function sentenceSpan(line: string, at: number): [number, number] {
  const breaks = [...line.matchAll(BREAK)].map((m) => m.index ?? 0);
  return [breaks.filter((b) => b < at).at(-1) ?? 0, breaks.find((b) => b > at) ?? line.length];
}

/** The text a stamp at `[at, end)` of lines[index] stands for, and the last line it covers. */
function extent(lines: readonly string[], index: number, at: number, end: number): { sentence: string; last: number; bullet?: string } {
  const line = lines[index]!;
  let [from, to] = sentenceSpan(line, at);
  if (/^\s*(?:[-*] |\d+\. )?\*\*[^*]*$/.test(line.slice(0, at))) [from, to] = [0, line.length];
  else if (/^\)?\*{0,2}:\s*\(1\)/.test(line.slice(end))) {
    // "Rulings (user, ...): (1) ... (7) ...": the numbered items, to the sentence break after the last one.
    let last = end;
    for (let n = 1, rest = end; ; n += 1) {
      const next = line.indexOf(`(${n})`, rest);
      if (next < 0) break;
      last = next;
      rest = next + 3;
    }
    to = [...line.matchAll(BREAK)].map((m) => m.index ?? 0).find((b) => b > last) ?? line.length;
  }
  let sentence = line.slice(from, to).trim();
  let last = index;
  let bullet: string | undefined;
  // A stamp that ends a bullet's line with a colon heads the sub-bullets under it.
  if (to >= line.trimEnd().length && /:\**$/.test(line.trimEnd())) {
    const indent = indentOf(line);
    for (let next = index + 1; next < lines.length && lines[next]!.trim() !== "" && indentOf(lines[next]!) > indent; next += 1) {
      sentence += `\n${lines[next]!.trim()}`;
      last = next;
    }
    if (last > index) bullet = line.trim();
  }
  return { sentence, last, ...(bullet ? { bullet } : {}) };
}

/** The card codes a sentence names: each code, with every code of a range ("143015 to 143018") in between. */
function codesIn(sentence: string): string[] {
  const ranged = [...sentence.matchAll(/(?<![\w:.-])(\d{5,6}) (?:to|through|-) (\d{5,6})(?![\w])/g)].flatMap((m) => {
    const [low, high] = [Number(m[1]), Number(m[2])];
    return high >= low && high - low <= 40 ? Array.from({ length: high - low + 1 }, (_, i) => String(low + i)) : [];
  });
  return [...[...sentence.matchAll(CODE)].map((m) => m[0]), ...ranged].sort();
}

const unique = (found: Iterable<string>): string[] => [...new Set(found)];

export function rulingsIn(file: string, text: string): Ruling[] {
  const lines = text.split("\n");
  const headings = headingsOf(text);
  const found: Ruling[] = [];
  lines.forEach((line, index) => {
    const seen = new Set<string>();
    for (const match of line.matchAll(STAMP)) {
      const { sentence, last, bullet } = extent(lines, index, match.index ?? 0, (match.index ?? 0) + match[0].length);
      if (seen.has(sentence)) continue;
      seen.add(sentence);
      const section = headings.filter((h) => h.start <= index + 1).at(-1)?.text ?? "";
      const lineIds = unique([...sentence.matchAll(LINE_ID)].map((m) => m[0]));
      const codes = unique([...lineIds.map((id) => id.slice(0, id.indexOf(":"))), ...codesIn(sentence)]);
      const ruleIds = unique([...sentence.matchAll(RULE_ID)].map((m) => m[0]));
      const stamps = [...sentence.matchAll(STAMP)].map((m) => m[0]);
      const dates = unique(stamps.flatMap((stamp) => [...stamp.matchAll(DATE)].map((d) => d[0]))).sort();
      const names = lineIds.length + codes.length + ruleIds.length > 0;
      const request = stamps.every((stamp) => /^user[- ]requests?/i.test(stamp));
      const reading = request ? names : names || file.startsWith("docs/scenarios/") || RULE_SECTIONS.test(section);
      found.push({ file, section, line: index + 1, lastLine: last + 1, ...(bullet ? { bullet } : {}), sentence, dates, lineIds, codes, ruleIds, kind: reading ? "reading" : "decision" });
    }
  });
  // A sentence inside another listed sentence (a bullet listed by its bold label, the items of a listed list) is listed once, in the larger.
  return found.filter((r) => !found.some((other) => other !== r && other.sentence.length > r.sentence.length && other.sentence.includes(r.sentence)));
}

/** Every stamped reading of docs/brief.md and docs/scenarios/*.md, in file order. */
export function allRulings(): Ruling[] {
  const files = ["docs/brief.md", ...readdirSync(path.join(ROOT, "docs/scenarios")).filter((name) => name.endsWith(".md")).sort().map((name) => `docs/scenarios/${name}`)];
  return files.flatMap((file) => rulingsIn(file, readFileSync(path.join(ROOT, file), "utf8")));
}

export function filterRulings(rulings: readonly Ruling[], words: string): Ruling[] {
  const wanted = words.toLowerCase().split(/\s+/).filter((word) => word.length > 0);
  return rulings.filter((r) => {
    const hay = `${r.file} ${r.section} ${r.kind} ${r.bullet ?? ""} ${r.sentence} ${r.codes.join(" ")} ${r.ruleIds.join(" ")}`.toLowerCase();
    return wanted.every((word) => hay.includes(word));
  });
}

function render(r: Ruling): string {
  const names = [...r.lineIds, ...r.codes.filter((code) => !r.lineIds.some((id) => id.startsWith(`${code}:`))), ...r.ruleIds];
  const where = r.lastLine > r.line ? `${r.line}-${r.lastLine}` : `${r.line}`;
  return [`${r.file}:${where} [${r.section}] ${r.kind}${r.dates.length > 0 ? ` ${r.dates.join(", ")}` : ""}`, ...(r.bullet ? [`  in: ${r.bullet.slice(0, 90)}...`] : []), ...r.sentence.split("\n").map((row) => `  ${row}`), ...(names.length > 0 ? [`  names: ${names.join(" ")}`] : [])].join("\n");
}

function main(log: Log): void {
  const args = process.argv.slice(2);
  const words = args.filter((arg) => !arg.startsWith("--")).join(" ");
  const all = args.includes("--all");
  const found = filterRulings(allRulings(), words).filter((r) => all || r.kind === "reading");
  process.stdout.write(found.length > 0 ? `${found.map(render).join("\n")}\n` : `no stamped reading holds "${words}" (--all adds the product decisions)\n`);
  log.info(`${found.length} stamped ${all ? "entries" : "readings"}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("docs:rulings", main, { done: false });
