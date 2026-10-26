// The room above the dock's buttons for the armed line (docs/design-system.md, Table, Command column; phase 22). A caution names
// its loss in full, so the room is as many lines as the longest thing the dock's buttons can say when armed, held the same
// before and after any of them is armed: arming moves nothing. Pure: a character-per-line estimate of the dock's text width.

// Label type is about 6.6 pt a character; the narrowest dock text (the 210 pt column) is 168 pt wide, so about 25 a line. 24 keeps a margin.
export const CHARS_PER_LINE = 24;
export const LINE_PX = 18;
export const MIN_LINES = 2;
export const MAX_LINES = 4;
// The bar that runs down under the text (2 pt) and its gap, reserved whether or not a button is armed.
export const BAR_PX = 4;

/** How many lines a greedy word wrap of `text` takes at `chars` characters a line. */
export function lineCount(text: string, chars: number = CHARS_PER_LINE): number {
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const need = used === 0 ? word.length : used + 1 + word.length;
    if (used > 0 && need > chars) {
      lines += 1;
      used = word.length;
    } else used = need;
  }
  return lines + Math.max(0, Math.ceil((used === 0 ? 0 : used) / chars) - 1);
}

/** The lines the armed line holds for these texts (each armed button's words, what the primary waits for): MIN_LINES to MAX_LINES. */
export function armedLines(texts: readonly (string | null)[], chars: number = CHARS_PER_LINE): number {
  const most = Math.max(0, ...texts.map((text) => (text ? lineCount(text, chars) : 0)));
  return Math.min(MAX_LINES, Math.max(MIN_LINES, most));
}

/** The height of the armed line's room, the bar's reserve included. */
export function armedRoom(lines: number): number {
  return lines * LINE_PX + BAR_PX;
}
