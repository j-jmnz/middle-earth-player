import type { RuleEntry } from "../rules/spans.ts";
import { setsOf } from "./setup-names.ts";

// The printed text of a quest or campaign card cut into the pieces the scenario builder reads: its Setup paragraph, and the booklet's list of encounter sets.
export function textLines(text: string | null | undefined): string[] {
  return (text ?? "").split("\n").map((line) => line.trim()).filter((line) => line !== "");
}

// A line of a card's text that opens an ability of its own ("Forced:", "Travel Action:", "Resolution:"): it ends a Setup paragraph.
const LABELLED = /^[A-Z][A-Za-z' -]{2,28}:\s/;

// The Setup ability of a quest or campaign card as one string (its "Setup:" line and, when `continued`, the unlabelled lines that continue it,
// as the campaign cards of Dream-chaser and The Two Towers print them), and the card's other lines.
export function setupOf(text: string | null | undefined, continued: boolean): { setup: string | null; others: string[] } {
  const lines = textLines(text);
  const at = lines.findIndex((line) => /^Setup:/.test(line));
  if (at < 0) return { setup: null, others: lines };
  let end = at + 1;
  // Only a Dream-chaser or Two Towers campaign card continues its Setup on unlabelled lines; elsewhere the line after Setup is another ability.
  while (continued && end < lines.length && !LABELLED.test(lines[end] ?? "")) end += 1;
  return { setup: lines.slice(at, end).join(" "), others: [...lines.slice(0, at), ...lines.slice(end)] };
}

// The encounter sets a booklet's Setup paragraph names, in its order.
export function bookletSetsOf(entry: RuleEntry | undefined): string[] {
  if (!entry) return [];
  const flat = entry.text.replace(/\s+/g, " ");
  const match = /built with all the cards from (?:the following encounter sets: )?(.+?)(?: encounter set)?\.(?: These sets| This set| \s*$|$)/.exec(flat);
  if (!match?.[1]) return [];
  // "(these last two sets can be found in ... the core set)" says where sets are found, not what they are called.
  return setsOf(match[1].replace(/\s*\([^)]*\)/g, ""));
}
