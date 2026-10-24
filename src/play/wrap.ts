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

function fit(line: string, width: number, measure: (text: string) => number, ellipsis = false): string {
  if (measure(line) <= width) return line;
  let text = ellipsis ? line.replace(/…$/, "") : line;
  while (text.length > 1 && measure(`${text}…`) > width) text = text.slice(0, -1);
  return `${text}…`;
}
