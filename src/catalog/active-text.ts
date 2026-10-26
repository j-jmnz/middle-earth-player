// Rules: rr.keywords, rr.triggered-ability (data/rules/entries.json).
//
// Which printed lines of a card the app applies. A line is applied when an effect record names it in `lines`, when it is
// only keywords the engine reads (keyword-line.ts), or when the printed-text ledger marks it inert; the coverage test
// (scripts/effect-coverage.test.ts) reads ownership the same way. A card the ledger does not hold keeps its catalog text:
// each line beyond keywords is applied only when the card has a record (brief, Effects, layer 3). Everything else is "not
// applied" to the player and "inactive" in code. The pool filter, the card screen, the table, the preview and the deck
// screens all read this one check (docs/plans/inactive-text.md).
import type { Effect } from "./effect-schema.ts";
import { isKeywordLine } from "./keyword-line.ts";

/** One side of a card in the printed-text ledger (data/printed): its ability lines and the ones that need no record. */
export type PrintedSide = { code: string; side: string; lines: readonly string[]; inert: readonly { line: number }[] };

/** The ledger by card code. */
export type Ledger = ReadonlyMap<string, readonly PrintedSide[]>;

/** What the check needs: the line ids records own, the codes that have a record, and the ledger. */
export type TextCheck = { owned: ReadonlySet<string>; recorded: ReadonlySet<string>; ledger: Ledger };

/** One printed line of a card: its ledger id (null for a card outside the ledger), its text, and whether the app applies it. */
export type CardLine = { id: string | null; text: string; applied: boolean };

/** Card codes that have effect records. An empty list means no card has one. */
export function activeCardCodes(records: readonly Pick<Effect, "cardCode">[]): ReadonlySet<string> {
  return new Set(records.map((record) => record.cardCode).filter((code) => code.length > 0));
}

/** The ledger entries grouped by code. */
export function ledgerByCode(entries: Iterable<PrintedSide>): Ledger {
  const out = new Map<string, PrintedSide[]>();
  for (const entry of entries) out.set(entry.code, [...(out.get(entry.code) ?? []), entry]);
  return out;
}

/** The check for a set of records against a ledger. */
export function textCheck(records: readonly Pick<Effect, "cardCode" | "lines">[], ledger: Ledger): TextCheck {
  return { owned: new Set(records.flatMap((record) => record.lines)), recorded: activeCardCodes(records), ledger };
}

function plain(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/\[([a-z]+)\]/gi, (_, word: string) => word.charAt(0).toUpperCase() + word.slice(1))
    .trim();
}

/** True when a card's text holds something besides the keywords the engine implements. */
export function hasUniqueText(text: string | null | undefined): boolean {
  if (!text) return false;
  return text.split(/\r?\n/).some((raw) => {
    const line = plain(raw);
    return line.length > 0 && !isKeywordLine(line);
  });
}

/**
 * A card's printed lines in order, each with whether the app applies it. From the ledger when it holds the card (front, then
 * back); otherwise from the catalog text, where a line beyond keywords is applied only when the card has a record.
 */
export function cardLines(code: string, text: string | null | undefined, check: TextCheck): CardLine[] {
  const sides = check.ledger.get(code);
  if (sides && sides.length > 0) {
    return sides.flatMap((side) =>
      side.lines.map((line, at): CardLine => {
        const id = `${code}:${side.side}:${at + 1}`;
        const applied = check.owned.has(id) || isKeywordLine(line) || side.inert.some((mark) => mark.line === at + 1);
        return { id, text: line, applied };
      }),
    );
  }
  if (!text) return [];
  const recorded = check.recorded.has(code);
  return text
    .split(/\r?\n/)
    .map((raw) => plain(raw))
    .filter((line) => line.length > 0)
    .map((line) => ({ id: null, text: line, applied: recorded || isKeywordLine(line) }));
}

/** The lines of a card the app does not apply. */
export function unappliedLines(code: string, text: string | null | undefined, check: TextCheck): CardLine[] {
  return cardLines(code, text, check).filter((line) => !line.applied);
}

/** True when the app leaves a line of this card unapplied. */
export function textInactive(code: string, text: string | null | undefined, check: TextCheck): boolean {
  return unappliedLines(code, text, check).length > 0;
}

/** The codes with a line the app does not apply. */
export function inactiveCodes(texts: Iterable<readonly [string, string | null]>, check: TextCheck): ReadonlySet<string> {
  const inactive = new Set<string>();
  for (const [code, text] of texts) if (textInactive(code, text, check)) inactive.add(code);
  return inactive;
}

/** What a player loses with the unapplied lines of a card, by its type: the line the deck screens and the briefing show. */
export type TextLoss = "ability" | "cannotPlay" | "noEffect";

/**
 * How much an unapplied line costs. A character keeps its printed numbers and loses an ability; an event whose Action has no
 * record cannot be played (rr.triggered-ability: an ability that cannot change the game state is not initiated); an
 * attachment still attaches but does nothing beyond its keywords.
 */
export function textLoss(type: string | null | undefined, code: string, check: TextCheck): TextLoss {
  if (type === "event") return check.recorded.has(code) ? "ability" : "cannotPlay";
  if (type === "attachment") return check.recorded.has(code) ? "ability" : "noEffect";
  return "ability";
}

/** The loss in a few words, for a row's detail and the briefing: "Ability not applied", "Cannot be played". */
export const LOSS_WORDS: Readonly<Record<TextLoss, string>> = {
  ability: "Ability not applied",
  cannotPlay: "Cannot be played",
  noEffect: "Text not applied",
};
