// Text folded for comparison: accents off, curly quotes straight, lower case. The rules glossary compares by `fold`; the card search
// compares by `searchFold`, which also drops markup and punctuation.

export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .toLowerCase()
    .trim();
}

/** `fold`, with <b>-style tags removed and every other mark that is not a letter or digit (brackets, - ' . and so on) read as a space. */
export function searchFold(text: string): string {
  return fold(text.replace(/<[^>]*>/g, " "))
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Whether a and b differ by at most one insertion, deletion, substitution or swap of two neighbours. */
export function withinOneEdit(a: string, b: string): boolean {
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

/** The words a search compares: lower case, accents and punctuation dropped ("Númenor" is "numenor"). */
export function searchWords(text: string): string[] {
  return searchFold(text)
    .split(" ")
    .filter((word) => word.length > 0);
}

/** A typed word this long is forgiven a one-letter slip (`withinOneEdit`): a shorter word has too many neighbours, "ring" and "king". */
export const SLIP_MIN = 5;

/** How a word of a text answers a typed word. */
export type WordTest = (word: string, typed: string) => boolean;

/** The plain test: the word starts with the typed word. */
export const startsWith: WordTest = (word, typed) => word.startsWith(typed);

// A typed word this long is found anywhere in a word ("wood" in Mirkwood).
const INSIDE_MIN = 3;

/**
 * The forgiving test: the word starts with the typed word, holds it, or is one slip from it; the slip is also forgiven in the word's
 * start, so a name half typed with a slip still stays ("mirkwod", "golum").
 */
export const looselyAnswers: WordTest = (word, typed) => {
  if (word.startsWith(typed)) return true;
  if (typed.length >= INSIDE_MIN && word.includes(typed)) return true;
  if (typed.length < SLIP_MIN) return false;
  return [typed.length - 1, typed.length, typed.length + 1].some((length) => withinOneEdit(typed, word.slice(0, length)));
};

/** Whether the text holds every word typed (`searchWords`), each answered by one of its words; its words also count with their apostrophes dropped, so "helms" finds Helm's Deep. */
export function holdsWords(text: string, typed: readonly string[], answers: WordTest = startsWith): boolean {
  const words = [...searchWords(text), ...searchWords(text.replace(/['\u2018\u2019]/g, ""))];
  return typed.every((term) => words.some((word) => answers(word, term)));
}
