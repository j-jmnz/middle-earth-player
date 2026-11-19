// Rules: rr.keywords, rr.action, rr.response, rr.forced, rr.shadow-effects (data/rules/entries.json).
//
// The chips a table card's preview offers: its keywords now (card-keywords.ts) and the timing words its text opens a line with ("When Revealed:",
// "Shadow:"), each with the rule span that explains it (keyword-rules.ts). Timing chips are always built, marked `timing`; the screen decides whether to draw them.
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import { cardKeywords } from "./card-keywords.ts";
import { cardTextParagraphs, type TextRun } from "./card-text.ts";
import { sideText } from "./ledger.ts";
import { KEYWORD_RULES, LOCAL_RULE, pickRule, TIMING_RULES, timingOf, type TimingKey } from "./keyword-rules.ts";

/** One chip in the card preview: the word as it reads on the chip, the rule span it opens, and how it is drawn. */
export type PreviewKeyword = { word: string; ruleId: string; lost?: boolean; timing?: boolean };

// What a line's label is: the words before its first colon, when they are few (a timing word is one to three).
function leadingLabel(runs: readonly TextRun[]): string {
  const plain = runs.map((run) => (run.kind === "text" ? run.text : "")).join("");
  const colon = plain.indexOf(":");
  return colon > 0 && colon <= 24 ? plain.slice(0, colon) : "";
}

/**
 * The timing words in a card's text, each once, in text order. A line opens with one ("When Revealed: ...", plain or bold, the colon inside the bold
 * or after it: `<b>Response</b>:`), and a bold label that ends in a colon names one anywhere in a line ("<b>Forced:</b> ... <b>Forced:</b> ...").
 */
export function timingKeys(text: string | null | undefined): TimingKey[] {
  const keys: TimingKey[] = [];
  const add = (label: string) => {
    const key = label === "" ? null : timingOf(label);
    if (key && !keys.includes(key)) keys.push(key);
  };
  for (const paragraph of cardTextParagraphs(text)) {
    add(leadingLabel(paragraph.runs));
    paragraph.runs.forEach((run, at) => {
      if (run.kind !== "text" || !run.bold) return;
      const next = paragraph.runs[at + 1];
      if (run.text.trim().endsWith(":") || (next?.kind === "text" && next.text.startsWith(":"))) add(run.text);
    });
  }
  return keys;
}

/**
 * The chips for a table card, keywords first, then its timing words, read from the text the card shows and from its printed lines in the ledger (the
 * catalog's text has no shadow effect; the ledger's side A does). `ruleDoc` is the open scenario's own rule book (glossary.ts, scenarioRuleDoc). */
export function previewKeywords(game: ScenarioState, ctx: ReduceContext, cardId: string, text: string | null | undefined, ruleDoc: string | null): PreviewKeyword[] {
  const out: PreviewKeyword[] = [];
  for (const keyword of cardKeywords(game, ctx, cardId)) {
    const own = KEYWORD_RULES[keyword.key];
    const ruleId = pickRule(own.rules, ruleDoc) ?? (own.text ? `${LOCAL_RULE}${keyword.key}` : null);
    if (ruleId) out.push({ word: keyword.word, ruleId, ...(keyword.lost ? { lost: true } : {}) });
  }
  const code = game.cards[cardId]?.code;
  const printedA = code ? sideText(code, "A") : null;
  for (const key of timingKeys([text, printedA].filter((part) => part != null).join("\n"))) {
    const ruleId = pickRule(TIMING_RULES[key].rules, ruleDoc);
    if (ruleId) out.push({ word: TIMING_RULES[key].word, ruleId, timing: true });
  }
  return out;
}

/** The chips the preview draws: every keyword, and the timing words only while Explain timing words (`timingTips`) is on. */
export function drawnKeywords(keywords: readonly PreviewKeyword[] | undefined, timingTips: boolean): readonly PreviewKeyword[] {
  return timingTips ? (keywords ?? []) : (keywords ?? []).filter((chip) => chip.timing !== true);
}
