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
