// The app's own "not applied" check (src/catalog/active-text.ts) over the effect records it ships and the printed-text
// ledger: which lines of a card no record reads, and what the player loses with them. One check for the table, the
// preview, the card screen, the pool, the deck screens and the briefing (docs/plans/inactive-text.md).
import { cardLines, inactiveCodes, LOSS_WORDS, textCheck, textLoss, unappliedLines, type CardLine, type TextCheck, type TextLoss } from "../catalog/active-text.ts";
import { shippedLedger } from "../catalog/printed-ledger.ts";
import { EFFECTS } from "../effects/index.ts";

let check: TextCheck | null = null;

/** The check over the shipped records and ledger. */
export function shippedCheck(): TextCheck {
  check ??= textCheck(EFFECTS, shippedLedger());
  return check;
}

export type NotApplied = { lines: readonly CardLine[]; loss: TextLoss; words: string };

/** What the app leaves unapplied on a card, and what that costs; null when it applies every line. */
export function notApplied(code: string, type: string | null | undefined, text: string | null | undefined, against: TextCheck = shippedCheck()): NotApplied | null {
  const lines = unappliedLines(code, text, against);
  if (lines.length === 0) return null;
  const loss = textLoss(type, code, against);
  return { lines, loss, words: LOSS_WORDS[loss] };
}

/** The sentence under the "Not applied" eyebrow: what the card still does, and what it does not. */
export function lossSentence(loss: TextLoss): string {
  switch (loss) {
    case "ability":
      return "The app plays this card with its printed numbers and keywords. These lines do nothing yet:";
    case "cannotPlay":
      return "The app cannot apply this event yet, so it cannot be played. Its text:";
    case "noEffect":
      return "The app attaches this card, but its text does nothing yet. Paying for it gains nothing beyond its keywords:";
  }
}

/** The codes among these with a line the app does not apply. */
export function notAppliedCodes(texts: Iterable<readonly [string, string | null]>): ReadonlySet<string> {
  return inactiveCodes(texts, shippedCheck());
}

export { cardLines };
