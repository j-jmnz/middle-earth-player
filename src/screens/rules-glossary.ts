// The Rules tab's glossary: the rule spans of data/rules/entries.json a player looks up mid-game, searchable by title and
// term. The text is the span as read from its PDF column, so its line breaks are the column's; `paragraphs` joins them back.
import entries from "../../data/rules/entries.json";

import { parseRuleEntries, type RuleEntry } from "../catalog/rule-entry";
import { bookletName, type BookletId } from "./booklets/books";

export type GlossaryEntry = RuleEntry & { source: string };

const DOC_NAMES: Readonly<Record<string, string>> = {
  rr: "Rules Reference",
  "learn-to-play": "Learn to Play",
  faq: "FAQ",
  "easy-mode": "Easy Mode",
  mec109: bookletName("fellowship-of-the-ring"),
  tdom: bookletName("the-dark-of-mirkwood"),
  dcce: bookletName("dream-chaser"),
};

// A decklist, a scenario's setup or one scenario's stage is read on its own screen (deck import, briefing), not looked up.
function inGlossary(entry: RuleEntry): boolean {
  if (!(entry.doc in DOC_NAMES)) return false;
  return !/^(mec109\.(starter-|setup-|stage-)|ltp\.setup-|tdom\.setup-|dcce\.(campaign-)?setup-)/.test(entry.id);
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
  // Each title's sort key is folded once, not once per comparison.
  return rows
    .filter(inGlossary)
    .map((entry) => ({ entry: { ...entry, source: `${DOC_NAMES[entry.doc]} · page ${entry.page}` }, key: sortKey(entry.title) }))
    .sort((a, b) => a.key.localeCompare(b.key) || a.entry.id.localeCompare(b.entry.id))
    .map((row) => row.entry);
}

// The rule spans are parsed (zod) on the first look-up, not when the module loads: the Rules tab and the table's Rules are the only readers.
type Glossary = { rows: readonly GlossaryEntry[]; byId: ReadonlyMap<string, GlossaryEntry> };
let parsed: readonly RuleEntry[] | null = null;
let book: Glossary | null = null;
let all: ReadonlyMap<string, RuleEntry> | null = null;

function parsedEntries(): readonly RuleEntry[] {
  parsed ??= parseRuleEntries(entries);
  return parsed;
}

function glossaryBook(): Glossary {
  if (!book) {
    const rows = glossaryOf(parsedEntries());
    book = { rows, byId: new Map(rows.map((row) => [row.id, row])) };
  }
  return book;
}

/** The glossary's entries in title order, parsed on the first call and kept. */
export function glossary(): readonly GlossaryEntry[] {
  return glossaryBook().rows;
}

// The rule books the app carries (src/screens/booklets/books.ts); a rule from one opens the reader on its page.
const BOOKS: Readonly<Partial<Record<string, BookletId>>> = {
  mec109: "fellowship-of-the-ring",
  "learn-to-play": "learn-to-play",
  tdom: "the-dark-of-mirkwood",
  dcce: "dream-chaser",
  rr: "rules-reference",
};

/** The stored book and page a rule is printed on, when the app carries that book; the FAQ and the Easy Mode sheet it does not. */
export function bookPage(entry: Pick<RuleEntry, "doc" | "page">): { id: BookletId; name: string; page: number } | null {
  const id = BOOKS[entry.doc];
  return id ? { id, name: bookletName(id), page: entry.page } : null;
}

/** Where a rule span is printed, as a player reads it: "Fellowship of the Ring rulebook, page 4" (the book the app carries, else the document's name). */
export function ruleSource(id: string): string | null {
  all ??= new Map(parsedEntries().map((entry) => [entry.id, entry]));
  const entry = all.get(id);
  if (!entry) return null;
  const book = bookPage(entry);
  return book ? `${book.name}, page ${book.page}` : `${DOC_NAMES[entry.doc] ?? entry.doc}, page ${entry.page}`;
}

export function glossaryEntry(id: string): GlossaryEntry | null {
  return glossaryBook().byId.get(id) ?? null;
}

// What a search and a "See also" compare an entry by, folded once per entry: its title's sort key, its terms, and (the first time a
// search reaches the text rule) its text.
type Folded = { title: string; terms: readonly string[]; text: string | null };
const foldedEntries = new WeakMap<GlossaryEntry, Folded>();

function foldedOf(entry: GlossaryEntry): Folded {
  let found = foldedEntries.get(entry);
  if (!found) {
    found = { title: sortKey(entry.title), terms: entry.terms.map(fold), text: null };
    foldedEntries.set(entry, found);
  }
  return found;
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
  const folded = foldedOf(entry);
  if (folded.title.startsWith(needle)) return 0;
  if (folded.title.includes(needle) || folded.terms.some((term) => term.includes(needle))) return 1;
  if (needle.length < 3) return null;
  folded.text ??= fold(entry.text);
  return folded.text.includes(needle) ? 2 : null;
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
      const matches = namedBy(rows).get(fold(name))?.filter((row) => row.id !== entry.id) ?? [];
      return { name, entry: matches.find((row) => row.doc === entry.doc) ?? matches[0] ?? null };
    });
}

// The entries by their folded title and by each folded term, in the rows' order, built once per list of rows.
const names = new WeakMap<readonly GlossaryEntry[], Map<string, GlossaryEntry[]>>();

function namedBy(rows: readonly GlossaryEntry[]): Map<string, GlossaryEntry[]> {
  let found = names.get(rows);
  if (!found) {
    found = new Map();
    for (const row of rows) {
      const folded = foldedOf(row);
      for (const key of new Set([folded.title, ...folded.terms])) found.set(key, [...(found.get(key) ?? []), row]);
    }
    names.set(rows, found);
  }
  return found;
}
