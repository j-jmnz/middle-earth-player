// A card name drawn on the canvas while its picture is still downloading: wrapped by word into at most `maxLines` lines
// that fit `width`. A word longer than the width is cut with an ellipsis; a name with more lines left over ends in one.
// `measure` is the font's text width, so the same function serves Skia on the phone and a fixed-width font in tests.
// `firstWidth` is a narrower width for the first line, where a badge (the damage token) stands at the card's top right: a first word
// that does not fit it leaves the line empty and starts the second, so no letter lies under the badge (only with more than one line to spare).
export function wrapName(name: string, width: number, measure: (text: string) => number, maxLines = 3, firstWidth = width): string[] {
  const words = name.split(/\s+/).filter((word) => word.length > 0);
  const lines: string[] = [];
  const limit = (line: number) => (line === 0 ? firstWidth : width);
  let current = "";
  let index = 0;
  for (; index < words.length; index += 1) {
    const word = words[index] ?? "";
    const next = current ? `${current} ${word}` : word;
    if (measure(next) <= limit(lines.length)) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    else if (lines.length === 0 && maxLines > 1 && firstWidth < width && measure(word) <= width) lines.push("");
    current = word;
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  const cut = lines.map((line, at) => fit(line, limit(at), measure));
  const leftover = index < words.length || lines.length > maxLines;
  const kept = cut.slice(0, maxLines);
  if (leftover && kept.length > 0) kept[kept.length - 1] = fit(`${kept[kept.length - 1] ?? ""}…`, limit(kept.length - 1), measure, true);
  return kept;
}

/** The line cut to `width` with an ellipsis: the whole line when it fits (a band name is one line, cut by letter, not by word). */
export function fit(line: string, width: number, measure: (text: string) => number, ellipsis = false): string {
  if (measure(line) <= width) return line;
  let text = ellipsis ? line.replace(/…$/, "") : line;
  while (text.length > 1 && measure(`${text}…`) > width) text = text.slice(0, -1);
  return `${text.trimEnd()}…`;
}
