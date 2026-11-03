// The app's own "not applied" check (src/catalog/active-text.ts) over the effect records it ships and the printed-text
// ledger: which lines of a card no record reads, and what the player loses with them. One check for the table, the
// preview, the card screen, the pool, the deck screens and the briefing (docs/plans/done/inactive-text.md).
import { inactiveCodes, textCheck, textLoss, unappliedLines, type CardLine, type TextCheck, type TextLoss } from "../catalog/active-text.ts";
import type { Effect } from "../catalog/boundary.ts";
import { shippedLedger } from "../catalog/printed-ledger.ts";
import { EFFECTS } from "../effects/index.ts";

/** The loss in a few words, for a row's detail and the briefing: "Ability not applied", "Cannot be played". */
const LOSS_WORDS: Readonly<Record<TextLoss, string>> = {
  ability: "Ability not applied",
  cannotPlay: "Cannot be played",
  noEffect: "Text not applied",
};

const checks = new WeakMap<readonly Effect[], TextCheck>();

/** The check over these records (the reducer context's) and the shipped ledger, worked out once per record list. */
export function checkFor(effects: readonly Effect[]): TextCheck {
  let found = checks.get(effects);
  if (!found) {
    found = textCheck(effects, shippedLedger());
    checks.set(effects, found);
  }
  return found;
}

/** The check over the shipped records and ledger. */
export function shippedCheck(): TextCheck {
  return checkFor(EFFECTS);
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


/**
 * What playing a card the app does not fully apply costs, said before it is confirmed: an attachment with no record attaches
 * and does nothing (the confirm arms on its first tap); an ally plays with its printed numbers. Null when every line is
 * applied. Events with no record are never offered (src/rules/player/planning.ts), so they have no caution.
 */
export function playCaution(code: string, type: string, text: string | null, cost: number, against: TextCheck = shippedCheck()): { words: string; armed: string | null } | null {
  const lines = unappliedLines(code, text, against);
  if (type === "attachment" && !against.recorded.has(code) && lines.length > 0) {
    return cost > 0
      ? { words: `Its text is not applied: you pay ${cost} for no effect`, armed: `Tap again: pay ${cost} for no effect` }
      : { words: "Its text is not applied: it has no effect", armed: "Tap again: play it for no effect" };
  }
  // An ally with no text, or only keywords the engine reads (Ranged), loses nothing.
  if (type === "ally" && lines.length > 0) return { words: "Its ability is not applied: it plays with its printed numbers", armed: null };
  return null;
}

/** The few words a list row adds for a card the app does not fully apply: "Ability not applied", "Cannot be played". */
export function notAppliedWords(code: string, type: string | null | undefined, against: TextCheck = shippedCheck()): string {
  return LOSS_WORDS[textLoss(type, code, against)];
}
