// Rules: rr.sentinel, rr.ranged, rr.restricted, rr.surge, rr.doomed-x, mec109.hide-x, mec109.archery, mec109.toughness,
// mec109.indestructible, mec109.permanent, mec109.peril, rr.immune (data/rules/entries.json).
//
// Whether a card's unique text is active. Every card is meant to be automated (user decision, 2026-10-26); until a card's
// every printed line has an effect record, its text is marked inactive. The mark is a line of the card in the open-lines
// list (src/effects/open-lines.ts, written by `pnpm effects:open`), or, for a card the list does not cover, the
// absence of any record for the code. A line that is only implemented keywords is not unique text. The pool filter, the
// card screen and the table all use this one check.
import type { Effect } from "./effect-schema.ts";

/** Card codes that have effect records and no open line. An empty record list means every sentence is inactive. */
export function activeCardCodes(records: readonly Pick<Effect, "cardCode">[], openLines: readonly string[] = []): ReadonlySet<string> {
  const open = new Set(openLines.map((id) => id.split(":")[0] ?? ""));
  return new Set(records.map((record) => record.cardCode).filter((code) => code.length > 0 && !open.has(code)));
}

const KEYWORD = /^(sentinel|ranged|restricted|battle|siege|surge|peril|indestructible|permanent|immune to player card effects|(doomed|hide|archery|toughness|secrecy) \d+)$/i;

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

/** The codes whose unique text is inactive: a line in the open list, or printed text beyond implemented keywords and no record. */
export function inactiveCodes(
  texts: Iterable<readonly [string, string | null]>,
  records: readonly Pick<Effect, "cardCode">[],
  openLines: readonly string[] = [],
): ReadonlySet<string> {
  const recorded = activeCardCodes(records, openLines);
  const inactive = new Set<string>();
  for (const [code, text] of texts) if (!recorded.has(code) && hasUniqueText(text)) inactive.add(code);
  return inactive;
}

/** True when this card's unique text is inactive: printed text beyond implemented keywords, and the card is not active. */
export function textInactive(code: string, text: string | null | undefined, active: ReadonlySet<string>): boolean {
  return !active.has(code) && hasUniqueText(text);
}
