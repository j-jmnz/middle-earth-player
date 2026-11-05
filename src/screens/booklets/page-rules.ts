// The rule entries printed on one page of a book, for the reader's "Rules on this page" (docs/design-system.md, Booklet). A rule span
// carries the PDF page it is cut from (`page`, data/rules/entries.json), which is the page index the booklet view counts from 1 and
// reports in `onPageChange`, so the two match with no offset.
import { bookPage, type GlossaryEntry } from "../rules/glossary";
import type { BookletId } from "./books";

/** The glossary entries printed on `page` of the book `bookId`, in column order and then title order. Setups, stages and decklists are not in the glossary, so they are not listed. */
export function rulesOnPage(rows: readonly GlossaryEntry[], bookId: BookletId, page: number): GlossaryEntry[] {
  return rows
    .filter((entry) => entry.page === page && bookPage(entry)?.id === bookId)
    .sort((a, b) => a.column - b.column || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

/** What the button says: the page and how many rules it holds. */
export function pageRulesLabel(page: number, count: number): string {
  if (count === 0) return `Rules on this page, page ${page}: none`;
  return `Rules on this page, page ${page}: ${count} ${count === 1 ? "rule" : "rules"}`;
}
