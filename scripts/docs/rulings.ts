import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runScript, type Log } from "../log.ts";

import { headingsOf, ROOT } from "./index.ts";

// The register of user rulings: a reading that a doc stamps as the user's ("user ruling, 2026-11-05", "user decision, ...", "user instruction, ...") beside a
// card or rule reading in docs/brief.md or docs/scenarios/*.md. It is settled until the user changes it, so a brief for a fix agent names the ones its task
// touches. Usage: pnpm doc rulings [<words>] prints each stamped reading whose text, file or heading holds all the words.

export type Ruling = {
  file: string;
  /** The deepest heading above the stamp, "" before the first. */
  section: string;
  /** The first line of the reading in the file. */
  line: number;
  /** The sentence that holds the stamp (the whole bullet when the stamp sits in its bold label). */
  sentence: string;
  dates: string[];
  /** Printed line ids (`<code>:<side>:<n>`) the sentence names. */
  lineIds: string[];
  /** Card codes the sentence names, with those of its line ids. */
  codes: string[];
};

const STAMP = /user (?:ruling|decision|instruction)s?\b[^)\n]{0,60}?\d{4}-\d{2}-\d{2}[^)\n]{0,40}/gi;
const DATE = /\d{4}-\d{2}-\d{2}/g;
const LINE_ID = /(?<![\w:])(\d{2,6}):[A-Za-z]+:\d+(?![\w])/g;
const CODE = /(?<![\w:.-])\d{5,6}(?![\w])/g;

/** The sentence of `line` that holds the character at `at`: from the last full stop, colon-less break or bullet start before it to the next full stop after. */
function sentenceAt(line: string, at: number): string {
  if (/^\s*(?:[-*] |\d+\. )?\*\*[^*]*$/.test(line.slice(0, at))) return line.trim();
  const breaks = [...line.matchAll(/(?<=(?<!\bMr)(?<!\bSt)[.!?])\s+(?=[A-Z"*`(])/g)].map((m) => m.index ?? 0);
  const start = breaks.filter((b) => b < at).at(-1) ?? 0;
  const end = breaks.find((b) => b > at) ?? line.length;
  return line.slice(start, end).trim();
}

export function rulingsIn(file: string, text: string): Ruling[] {
  const lines = text.split("\n");
  const headings = headingsOf(text);
  const found: Ruling[] = [];
  lines.forEach((line, index) => {
    const seen = new Set<string>();
    for (const match of line.matchAll(STAMP)) {
      const sentence = sentenceAt(line, match.index ?? 0);
      if (seen.has(sentence)) continue;
      seen.add(sentence);
      const section = headings.filter((h) => h.start <= index + 1).at(-1)?.text ?? "";
      const lineIds = [...new Set([...sentence.matchAll(LINE_ID)].map((m) => m[0]))];
      const codes = [...new Set([...lineIds.map((id) => id.slice(0, id.indexOf(":"))), ...[...sentence.matchAll(CODE)].map((m) => m[0])])];
      const dates = [...new Set([...sentence.matchAll(STAMP)].flatMap((m) => [...m[0].matchAll(DATE)].map((d) => d[0])))].sort();
      found.push({ file, section, line: index + 1, sentence, dates, lineIds, codes });
    }
  });
  return found;
}

/** Every stamped reading of docs/brief.md and docs/scenarios/*.md, in file order. */
export function allRulings(): Ruling[] {
  const files = ["docs/brief.md", ...readdirSync(path.join(ROOT, "docs/scenarios")).filter((name) => name.endsWith(".md")).sort().map((name) => `docs/scenarios/${name}`)];
  return files.flatMap((file) => rulingsIn(file, readFileSync(path.join(ROOT, file), "utf8")));
}

export function filterRulings(rulings: readonly Ruling[], words: string): Ruling[] {
  const wanted = words.toLowerCase().split(/\s+/).filter((word) => word.length > 0);
  return rulings.filter((r) => {
    const hay = `${r.file} ${r.section} ${r.sentence} ${r.codes.join(" ")}`.toLowerCase();
    return wanted.every((word) => hay.includes(word));
  });
}

function render(r: Ruling): string {
  const names = [...r.lineIds, ...r.codes.filter((code) => !r.lineIds.some((id) => id.startsWith(`${code}:`)))];
  return [`${r.file}:${r.line} [${r.section}] ${r.dates.join(", ")}`, `  ${r.sentence}`, ...(names.length > 0 ? [`  names: ${names.join(" ")}`] : [])].join("\n");
}

function main(log: Log): void {
  const words = process.argv.slice(2).filter((arg) => !arg.startsWith("--")).join(" ");
  const found = filterRulings(allRulings(), words);
  process.stdout.write(found.length > 0 ? `${found.map(render).join("\n")}\n` : `no stamped reading holds "${words}"\n`);
  log.info(`${found.length} stamped readings`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void runScript("docs:rulings", main, { done: false });
