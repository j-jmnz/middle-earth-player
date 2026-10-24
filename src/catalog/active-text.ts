// Rules: rr.sentinel, rr.ranged, rr.restricted, rr.surge, rr.doomed-x, mec109.hide-x, mec109.archery, mec109.toughness,
// mec109.indestructible, mec109.permanent, mec109.peril, rr.immune (data/rules/entries.json).
//
// Whether a card's unique text is active. A player card from outside the automated set keeps its printed numbers and the
// keywords the engine implements once; its unique text has no effect record, so it is inactive (brief, Effects, layer 3).
// The mark is the absence of a record for the code; a line that is only implemented keywords is not unique text. The pool
// filter, the card screen and the table all use this one check.
import type { Effect } from "./effect-schema.ts";

/** Card codes that have effect records. An empty list means every sentence is inactive. */
export function activeCardCodes(records: readonly Pick<Effect, "cardCode">[]): ReadonlySet<string> {
  return new Set(records.map((record) => record.cardCode).filter((code) => code.length > 0));
}

const KEYWORD = /^(sentinel|ranged|restricted|surge|peril|indestructible|permanent|immune to player card effects|(doomed|hide|archery|toughness) \d+)$/i;

function plain(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/\[[a-z]+\]/gi, "")
    .trim();
}

/** True when a card's text holds something besides the keywords the engine implements (and the card's traits line). */
export function hasUniqueText(text: string | null | undefined): boolean {
  if (!text) return false;
  for (const raw of text.split(/\r?\n/)) {
    const line = plain(raw);
    if (line.length === 0) continue;
    const sentences = line
      .split(".")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (sentences.length === 0 || !sentences.every((sentence) => KEYWORD.test(sentence))) return true;
  }
  return false;
}

/** The codes whose unique text is inactive: printed text beyond implemented keywords, and no effect record. */
export function inactiveCodes(texts: Iterable<readonly [string, string | null]>, records: readonly Pick<Effect, "cardCode">[]): ReadonlySet<string> {
  const recorded = activeCardCodes(records);
  const inactive = new Set<string>();
  for (const [code, text] of texts) if (!recorded.has(code) && hasUniqueText(text)) inactive.add(code);
  return inactive;
}

/** True when this card's unique text is inactive: printed text beyond implemented keywords, and no record for the code. */
export function textInactive(code: string, text: string | null | undefined, active: ReadonlySet<string>): boolean {
  return !active.has(code) && hasUniqueText(text);
}
