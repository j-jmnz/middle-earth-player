// The room above the dock's buttons for the armed line (docs/design-system.md, Table, Command column; phase 22). A caution names
// its loss in full, so the room is as many lines as the longest thing the dock's buttons can say when armed, held the same
// before and after any of them is armed: arming moves nothing. Pure: a character-per-line estimate of the dock's text width.

// Label type is about 6.6 pt a character; the narrowest dock text (the 210 pt column) is 168 pt wide, so about 25 a line. 24 keeps a
// margin. The dock passes the characters its measured width holds (labelChars in dock-budget.ts); this is the default.
export const CHARS_PER_LINE = 24;
export const LINE_PX = 18;
// No line is held when nothing in the moment can be said there (no button arms, nothing waits): the room is the bar's alone.
export const MIN_LINES = 0;
export const MAX_LINES = 4;
// The bar that runs down under the text (2 pt) and its gap, reserved whether or not a button is armed.
export const BAR_PX = 4;
// On a short phone's dock (under 400 pt tall) the bar's reserve is 2 pt: the bar itself is 2.
export const BAR_DENSE_PX = 2;
// The words a sheet's armed line leads with; a dense dock drops them from a consequence clause when that saves a line (`armedWords`):
// the line is gold and a bar runs down under the button, so it is plainly the second tap, and a screen reader hears the full line.
export const LEAD = "Tap again: ";

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

/** The lines the armed line holds for these texts (each armed button's words, what the primary waits for): the longest, up to MAX_LINES. */
export function armedLines(texts: readonly (string | null)[], chars: number = CHARS_PER_LINE): number {
  const most = Math.max(0, ...texts.map((text) => (text ? lineCount(text, chars) : 0)));
  return Math.min(MAX_LINES, Math.max(MIN_LINES, most));
}

/** The height of the armed line's room, the bar's reserve included. */
export function armedRoom(lines: number, dense = false): number {
  return lines * LINE_PX + (dense ? BAR_DENSE_PX : BAR_PX);
}

// A consequence clause: it says what the second tap costs (a card that falls or is destroyed, the game lost), not just which button.
const CONSEQUENCE = /\b(falls|destroyed|is lost)\b/i;

/**
 * The armed line as the dense dock draws it: a full consequence clause that names a card or a loss ("Eagles of the Misty Mountains
 * falls and the game is lost") drops its "Tap again: " lead-in when that takes a line off, and is still in full. A bare label
 * ("Tap again: Leave undefended") and any other line keep it. A screen reader always hears the whole line.
 */
export function armedWords(text: string, dense: boolean, chars: number = CHARS_PER_LINE): string {
  if (!dense || !text.startsWith(LEAD)) return text;
  const short = text.slice(LEAD.length);
  return CONSEQUENCE.test(short) && lineCount(short, chars) < lineCount(text, chars) ? short : text;
}
