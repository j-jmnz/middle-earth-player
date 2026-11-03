// The card search: a query is words (a "quoted phrase" stays one), and every word must hit a field of the card. The ranking is
// exact name, name prefix, a word of the name, trait / type / sphere, the card text, then a one-letter slip in a name word.
import { traitTokens } from "../catalog/deck-save";

import { searchFold } from "./fold";

/** What a pool row offers the search; a row without the type, sphere or text names (a test row) matches on what it has. */
export type SearchRow = {
  name: string;
  traits: string | null;
  typeName?: string | null;
  sphereName?: string | null;
  text?: string | null;
  errata?: string | null;
};

export type SearchIndex = {
  name: string;
  nameWords: readonly string[];
  /** Traits, type and sphere, folded and joined by spaces. */
  tags: string;
  text: string;
};

const indexes = new WeakMap<object, SearchIndex>();

/** The row's folded fields, worked out once per row (pool rows are the same objects for a catalog's life). */
export function searchIndexOf(row: SearchRow): SearchIndex {
  let found = indexes.get(row);
  if (!found) {
    const name = searchFold(row.name);
    found = {
      name,
      nameWords: name.split(" "),
      tags: searchFold([...traitTokens(row.traits), row.typeName ?? "", row.sphereName ?? ""].join(" ")),
      text: searchFold(row.errata ?? row.text ?? ""),
    };
    indexes.set(row, found);
  }
  return found;
}

/** The query's words, folded: whitespace separates them, a quoted phrase is one. Empty when nothing searchable is typed. */
export function searchTerms(query: string): string[] {
  const terms: string[] = [];
  for (const match of query.matchAll(/"([^"]*)"|(\S+)/g)) {
    const term = searchFold(match[1] ?? match[2] ?? "");
    if (term.length > 0) terms.push(term);
  }
  return terms;
}

const FUZZY_MIN = 5;

// Whether a and b differ by at most one insertion, deletion, substitution or swap of two neighbours.
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  if (start === a.length && start === b.length) return true;
  const restA = a.slice(start + 1);
  const restB = b.slice(start + 1);
  if (a.length === b.length) {
    if (restA === restB) return true;
    return a[start] === b[start + 1] && a[start + 1] === b[start] && a.slice(start + 2) === b.slice(start + 2);
  }
  return a.length > b.length ? restA === b.slice(start) : a.slice(start) === restB;
}

// Where a field has the term at the start of any of its words (a phrase starts at a word too).
function atWordStart(field: string, term: string): boolean {
  return field.startsWith(term) || field.includes(` ${term}`);
}

const EXACT = 0;
const NAME_PREFIX = 1;
const NAME_WORD = 2;
const TAG = 3;
const TEXT = 4;
const FUZZY = 5;

function termScore(index: SearchIndex, term: string): number | null {
  if (index.name.startsWith(term)) return NAME_PREFIX;
  if (atWordStart(index.name, term)) return NAME_WORD;
  if (atWordStart(index.tags, term)) return TAG;
  if (index.text.includes(term)) return TEXT;
  if (term.length >= FUZZY_MIN && !term.includes(" ") && index.nameWords.some((word) => withinOneEdit(term, word))) return FUZZY;
  return null;
}

/** The card's rank for the query (0 is best), or null when a word of it hits nothing. The terms may be passed worked out (searchTerms). */
export function matchCard(index: SearchIndex, query: string | readonly string[]): number | null {
  const terms = typeof query === "string" ? searchTerms(query) : query;
  if (terms.length === 0) return null;
  if (terms.join(" ") === index.name) return EXACT;
  let worst = EXACT;
  for (const term of terms) {
    const score = termScore(index, term);
    if (score == null) return null;
    if (score > worst) worst = score;
  }
  return worst;
}
