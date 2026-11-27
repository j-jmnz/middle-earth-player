// A card name drawn on the canvas while its picture is still downloading: wrapped by word into at most `maxLines` lines
// that fit `width`. A word longer than the width is cut with an ellipsis; a name with more lines left over ends in one.
// `measure` is the font's text width, so the same function serves Skia on the phone and a fixed-width font in tests.
export function wrapName(name: string, width: number, measure: (text: string) => number, maxLines = 3): string[] {
  const words = name.split(/\s+/).filter((word) => word.length > 0);
  const lines: string[] = [];
  let current = "";
  let index = 0;
  for (; index < words.length; index += 1) {
    const word = words[index] ?? "";
    const next = current ? `${current} ${word}` : word;
    if (measure(next) <= width) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  const cut = lines.map((line) => fit(line, width, measure));
  const leftover = index < words.length || lines.length > maxLines;
  const kept = cut.slice(0, maxLines);
  if (leftover && kept.length > 0) kept[kept.length - 1] = fit(`${kept[kept.length - 1] ?? ""}…`, width, measure, true);
  return kept;
}

/** The line cut to `width` with an ellipsis: the whole line when it fits (a band name is one line, cut by letter, not by word). */
export function fit(line: string, width: number, measure: (text: string) => number, ellipsis = false): string {
  if (measure(line) <= width) return line;
  let text = ellipsis ? line.replace(/…$/, "") : line;
  while (text.length > 1 && measure(`${text}…`) > width) text = text.slice(0, -1);
  return `${text.trimEnd()}…`;
}

// The widest line of the best way to break the words into two lines (the whole name when it is one word): the width a two-line name needs so that no word is cut.
function widestOfTwo(words: readonly string[], measure: (text: string) => number): number {
  if (words.length < 2) return measure(words[0] ?? "");
  const splits = words.slice(1).map((_, at) => Math.max(measure(words.slice(0, at + 1).join(" ")), measure(words.slice(at + 1).join(" "))));
  return Math.min(...splits);
}

/** The smallest share of its size a name shrinks to before it is cut with an ellipsis. */
export const MIN_NAME_SCALE = 0.75;

/**
 * The share of its size a name is drawn at so its long part fits `width`, never under `min`: the whole name when it takes one line, else on two lines the widest line of its best split, on more its widest word (a word does not wrap). 1 when it fits. What still does not fit at the minimum is cut with an ellipsis (wrapName, fit),
 * called with the width divided by this scale.
 */
export function nameScale(name: string, width: number, measure: (text: string) => number, maxLines = 3, min = MIN_NAME_SCALE): number {
  const words = name.split(/\s+/).filter((word) => word.length > 0);
  const widest = maxLines === 1 ? measure(name) : maxLines === 2 ? widestOfTwo(words, measure) : Math.max(0, ...words.map((word) => measure(word)));
  return widest <= width || widest <= 0 ? 1 : Math.max(min, width / widest);
}

/**
 * How a placeholder name sits on a card whose effect pills stand under its title (`width` is its room, `line` a line's height in points): one line while the whole name fits it at the minimum type size, else two lines, which
 * push the pills down by `drop` (badgeLayout's `lower`). A one-word name stays on one line, cut with an ellipsis, since a second line would not help it.
 */
export function nameDrop(name: string, width: number, measure: (text: string) => number, line: number): { lines: 1 | 2; drop: number } {
  const words = name.split(/\s+/).filter((word) => word.length > 0);
  if (words.length < 2 || measure(name) * MIN_NAME_SCALE <= width) return { lines: 1, drop: 0 };
  // The second line's height and a little air (a seventh of a line) between it and the first pill.
  return { lines: 2, drop: line * nameScale(name, width, measure, 2) + line / 7 };
}
