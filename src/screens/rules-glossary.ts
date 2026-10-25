// The Rules tab's glossary: the rule spans of data/rules/entries.json a player looks up mid-game, searchable by title and
// term. The text is the span as read from its PDF column, so its line breaks are the column's; `paragraphs` joins them back.
import entries from "../../data/rules/entries.json";

import { bookletName } from "./booklets/books";

export type RuleEntry = { id: string; doc: string; page: number; title: string; text: string; terms: string[] };

export type GlossaryEntry = RuleEntry & { source: string };

const DOC_NAMES: Readonly<Record<string, string>> = {
  rr: "Rules Reference",
  "learn-to-play": "Learn to Play",
  faq: "FAQ",
  "easy-mode": "Easy Mode",
  mec109: bookletName("fellowship-of-the-ring"),
};

// A decklist, a scenario's setup or one scenario's stage is read on its own screen (deck import, briefing), not looked up.
function inGlossary(entry: RuleEntry): boolean {
  if (!(entry.doc in DOC_NAMES)) return false;
  return !/^mec109\.(starter-|setup-|stage-)/.test(entry.id);
}

function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .toLowerCase()
    .trim();
}

// A title's words without what opens it: an FAQ entry number ("(1.11) Limitations on Attacks"), a framework step number
// ("1.2 Gain resources", "6.4a Next enemy attack initiates"), "Q&A:", or a quote mark ("(1.30) “First Player” elimination" sorts under F).
function sortKey(title: string): string {
  return fold(title.replace(/^\(\d+\.\d+\)\s*/, "").replace(/^\d+(\.\d+)+[a-z]?\s+/, "").replace(/^Q&A:\s*/, "")).replace(/^["']/, "");
}

export function glossaryOf(rows: readonly RuleEntry[]): GlossaryEntry[] {
  return rows
    .filter(inGlossary)
    .map((entry) => ({ ...entry, source: `${DOC_NAMES[entry.doc]} · page ${entry.page}` }))
    .sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title)) || a.id.localeCompare(b.id));
}

export const GLOSSARY: readonly GlossaryEntry[] = glossaryOf(entries as RuleEntry[]);

export function glossaryEntry(id: string): GlossaryEntry | null {
  return GLOSSARY.find((entry) => entry.id === id) ?? null;
}

/** The entries whose title or term holds the query, title starts first; from three letters, the text is searched too. */
export function searchGlossary(rows: readonly GlossaryEntry[], query: string): GlossaryEntry[] {
  const needle = fold(query);
  if (!needle) return [...rows];
  const ranked: { entry: GlossaryEntry; rank: number }[] = [];
  for (const entry of rows) {
    const rank = rankOf(entry, needle);
    if (rank != null) ranked.push({ entry, rank });
  }
  return ranked.sort((a, b) => a.rank - b.rank).map((row) => row.entry);
}

// 0: the title starts with the query; 1: the title or a term holds it; 2: the text holds it; null: no match.
function rankOf(entry: GlossaryEntry, needle: string): number | null {
  const title = sortKey(entry.title);
  if (title.startsWith(needle)) return 0;
  if (title.includes(needle) || entry.terms.some((term) => fold(term).includes(needle))) return 1;
  if (needle.length >= 3 && fold(entry.text).includes(needle)) return 2;
  return null;
}

// A line that opens its own paragraph: a bullet, a numbered step ("1. Shuffle Decks", "6.3 Resolve"), or See also.
const OPENS = /^(◊|•|\d+\.\s|\d+\.\d+\s|See also:)/;
// A line that can end a paragraph: it ends a sentence and stops short of the column's width.
const ENDS = /[.:!?][”)]?$/;
// How short of the span's longest line a sentence-ending line must stop to end its paragraph; a full line wraps on.
const SHORT_LINE = 0.85;

/** The span's text as paragraphs: the heading dropped, the column's wrapped lines joined. */
export function paragraphs(entry: Pick<RuleEntry, "title" | "text">): string[] {
  let lines = entry.text.split("\n").map((line) => line.trim());
  for (let count = 1; count <= 3; count += 1) {
    if (fold(lines.slice(0, count).join(" ")) === fold(entry.title)) {
      lines = lines.slice(count);
      break;
    }
  }
  const width = Math.max(...lines.map((line) => line.length));
  const out: string[] = [];
  let open: string[] = [];
  const close = () => {
    if (open.length > 0) out.push(open.join(" "));
    open = [];
  };
  for (const line of lines) {
    if (!line) {
      close();
      continue;
    }
    if (OPENS.test(line)) close();
    open.push(line);
    if (ENDS.test(line) && line.length < width * SHORT_LINE) close();
  }
  close();
  return out;
}

/** The entries a "See also:" paragraph names, in its order; a name with no entry stays a plain word. */
export function seeAlso(entry: GlossaryEntry, rows: readonly GlossaryEntry[]): { name: string; entry: GlossaryEntry | null }[] {
  const line = paragraphs(entry).find((paragraph) => paragraph.startsWith("See also:"));
  if (!line) return [];
  // A quoted name keeps the comma it closes on ("“Cannot have attachments,” Appendix II" names two).
  return (line.slice("See also:".length).match(/“[^”]*”|[^,“]+/g) ?? [])
    // A quoted name shows without its quote marks and the comma it closed on.
    .map((name) => name.trim().replace(/\.$/, "").replace(/^“(.*?),?”$/, "$1"))
    .filter((name) => name.length > 0)
    .map((name) => {
      const key = fold(name);
      const matches = rows.filter((row) => row.id !== entry.id && (sortKey(row.title) === key || row.terms.some((term) => fold(term) === key)));
      return { name, entry: matches.find((row) => row.doc === entry.doc) ?? matches[0] ?? null };
    });
}
