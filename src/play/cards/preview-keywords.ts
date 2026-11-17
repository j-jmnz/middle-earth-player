// Rules: rr.keywords, rr.action, rr.response, rr.forced, rr.shadow-effects (data/rules/entries.json).
//
// The chips a table card's preview offers: its keywords now (card-keywords.ts) and the timing words its text opens a line with ("When Revealed:",
// "Shadow:"), each with the rule span that explains it (keyword-rules.ts). Timing chips are always built, marked `timing`; the screen decides whether to draw them.
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";

import { cardKeywords } from "./card-keywords.ts";
import { cardTextParagraphs } from "./card-text.ts";
import { KEYWORD_RULES, pickRule, TIMING_RULES, timingOf, type TimingKey } from "./keyword-rules.ts";

/** One chip in the card preview: the word as it reads on the chip, the rule span it opens, and how it is drawn. */
export type PreviewKeyword = { word: string; ruleId: string; lost?: boolean; timing?: boolean };

/** The timing words in a card's text, each once, in text order: a bold run that ends in a colon names one. */
export function timingKeys(text: string | null | undefined): TimingKey[] {
  const keys: TimingKey[] = [];
  for (const paragraph of cardTextParagraphs(text)) {
    for (const run of paragraph.runs) {
      if (run.kind !== "text" || !run.bold || !run.text.trim().endsWith(":")) continue;
      const key = timingOf(run.text);
      if (key && !keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

/** The chips for a table card, keywords first, then its timing words. `ruleDoc` is the open scenario's own rule book (glossary.ts, scenarioRuleDoc). */
export function previewKeywords(game: ScenarioState, ctx: ReduceContext, cardId: string, text: string | null | undefined, ruleDoc: string | null): PreviewKeyword[] {
  const out: PreviewKeyword[] = [];
  for (const keyword of cardKeywords(game, ctx, cardId)) {
    const ruleId = pickRule(KEYWORD_RULES[keyword.key].rules, ruleDoc);
    if (ruleId) out.push({ word: keyword.word, ruleId, ...(keyword.lost ? { lost: true } : {}) });
  }
  for (const key of timingKeys(text)) {
    const ruleId = pickRule(TIMING_RULES[key].rules, ruleDoc);
    if (ruleId) out.push({ word: TIMING_RULES[key].word, ruleId, timing: true });
  }
  return out;
}

/** The chips the preview draws: every keyword, and the timing words only while Explain timing words (`timingTips`) is on. */
export function drawnKeywords(keywords: readonly PreviewKeyword[] | undefined, timingTips: boolean): readonly PreviewKeyword[] {
  return timingTips ? (keywords ?? []) : (keywords ?? []).filter((chip) => chip.timing !== true);
}
