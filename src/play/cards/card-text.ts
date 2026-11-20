// A card's text as the catalog stores it (Hall of Beorn markup: <b>, <i>, [willpower]-style icon words, one ability per
// line) split into paragraphs of runs a screen can style. Pure, so tests read it in Node.
import { ICONS, type IconName } from "../../ui/icons/generated.ts";

export type TextRun = { kind: "text"; text: string; bold: boolean; italic: boolean } | { kind: "icon"; name: IconName; word: string };

// A paragraph is one printed line. `flavor` is a line that is italic throughout (flavor text, a parenthesised reminder).
export type TextParagraph = { runs: readonly TextRun[]; flavor: boolean };

const TOKEN = /<\/?[bi][^>]*?>|\[[a-z ]+\]/gi;

function iconFor(word: string): IconName | null {
  const name = word.toLowerCase();
  return name in ICONS ? (name as IconName) : null;
}

// The player icon printed after a number ("5 PerPlayer damage") is written PerPlayer in the source and the printed ledger, as Hall of Beorn writes it; a screen says it in words.
const PER_PLAYER = /\bPerPlayer\b/g;

function paragraph(source: string): TextParagraph | null {
  const line = source.replace(PER_PLAYER, "per player");
  const runs: TextRun[] = [];
  let bold = false;
  let italic = false;
  let last = 0;
  const push = (text: string) => {
    if (text.length === 0) return;
    const previous = runs[runs.length - 1];
    if (previous?.kind === "text" && previous.bold === bold && previous.italic === italic) previous.text += text;
    else runs.push({ kind: "text", text, bold, italic });
  };
  for (const match of line.matchAll(TOKEN)) {
    const token = match[0];
    push(line.slice(last, match.index));
    last = match.index + token.length;
    if (token.startsWith("[")) {
      const word = token.slice(1, -1);
      const icon = iconFor(word);
      if (icon) runs.push({ kind: "icon", name: icon, word });
      else push(token);
      continue;
    }
    // "<b.Response:</b>" is a source typo for "<b>Response:</b>": the tag runs on to the closing one.
    const typo = /^<b\.(.*)<\/b>$/i.exec(token);
    if (typo) {
      bold = true;
      push(typo[1] ?? "");
      bold = false;
      continue;
    }
    const closing = token.startsWith("</");
    const tag = token.charAt(closing ? 2 : 1).toLowerCase();
    if (tag === "b") bold = !closing;
    else italic = !closing;
  }
  push(line.slice(last));
  const trimmed = trimRuns(runs);
  if (trimmed.length === 0) return null;
  const words = trimmed.filter((run) => run.kind === "text" && run.text.trim().length > 0);
  return { runs: trimmed, flavor: words.length > 0 && words.every((run) => run.kind === "text" && run.italic) };
}

function trimRuns(runs: TextRun[]): TextRun[] {
  const out = runs.map((run) => ({ ...run }));
  const first = out[0];
  if (first?.kind === "text") first.text = first.text.trimStart();
  const end = out[out.length - 1];
  if (end?.kind === "text") end.text = end.text.trimEnd();
  return out.filter((run) => run.kind === "icon" || run.text.length > 0);
}

/** The card's text, one paragraph per printed line, with bold, italic and icon runs. Empty lines are dropped. */
export function cardTextParagraphs(text: string | null | undefined): TextParagraph[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map(paragraph)
    .filter((item): item is TextParagraph => item != null);
}

/** The traits as printed: "Dúnedain. Ranger." The catalog stores them as a JSON array, or as that sentence already. */
export function traitLine(traits: string | null | undefined): string | null {
  if (!traits) return null;
  let list: unknown = null;
  try {
    list = JSON.parse(traits);
  } catch {
    return traits.trim() || null;
  }
  if (!Array.isArray(list)) return null;
  const words = list.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim().replace(/\.$/, ""));
  return words.length > 0 ? words.map((word) => `${word}.`).join(" ") : null;
}
