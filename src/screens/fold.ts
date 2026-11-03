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
