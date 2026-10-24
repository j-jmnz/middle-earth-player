// The books the reader opens. One stored PDF per book; a later campaign adds its own id (architecture: Persistence).
export const BOOKLETS = [
  { id: "fellowship-of-the-ring", name: "Fellowship of the Ring campaign book" },
  { id: "learn-to-play", name: "Learn to Play" },
] as const;

export type BookletId = (typeof BOOKLETS)[number]["id"];

export function isBookletId(value: string): value is BookletId {
  return BOOKLETS.some((book) => book.id === value);
}

export function bookletName(id: string): string {
  return BOOKLETS.find((book) => book.id === id)?.name ?? id;
}

export const BOOKLET_DIRECTORY = "booklets";

/** Path of a book's stored file, relative to the document directory. */
export function bookletPath(id: string): string {
  return `${BOOKLET_DIRECTORY}/${id}.pdf`;
}

/**
 * The page to open on. A scenario's recorded page index wins when it exists, and otherwise the saved last page. The page
 * is clamped into the book. The registry (data/campaigns, bookletPages) records a page for a scenario whose setup span is
 * in data/rules/index.json; a scenario without one passes none.
 */
export function startPage(scenarioPage: number | null | undefined, lastPage: number, pageCount: number): number {
  const wanted = scenarioPage != null && scenarioPage >= 1 ? scenarioPage : lastPage;
  return Math.min(Math.max(1, Math.floor(wanted)), Math.max(1, pageCount));
}
