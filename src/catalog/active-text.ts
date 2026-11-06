// Rules: rr.keywords, rr.triggered-ability (data/rules/entries.json).
//
// Which printed lines of a card the app applies. Every card is meant to be automated (user decision, 2026-10-26); until each
// printed line has a record, the lines without one are "not applied" to the player and "inactive" in code. A line is
// applied when an effect record names it in `lines`, when it is only keywords the engine reads (keyword-line.ts), or when
// the printed-text ledger marks it inert. A card the shipped ledger does not hold is read from its source text the way the
// data build reads the pool (pool-lines.ts), so the check names exactly the lines of src/effects/open-lines.ts and of the
// coverage test (scripts/checks/effect-coverage.test.ts). The pool filter, the card screen, the table, the preview and the deck
// screens all read this one check (docs/brief.md, Three layers).
import type { Effect } from "./effect-schema.ts";
import { isKeywordLine } from "./keyword-line.ts";
import { poolSides } from "./pool-lines.ts";

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

/**
 * A card's printed lines in order, each with whether the app applies it: from the ledger when it holds the card, otherwise
 * from its text (and its back's), front then back.
 */
export function cardLines(code: string, text: string | null | undefined, check: TextCheck, back: string | null = null): CardLine[] {
  const sides = check.ledger.get(code) ?? sourceSides(code, text, back);
  return sides.flatMap((side) =>
    side.lines.map((line, at): CardLine => {
      const id = `${code}:${side.side}:${at + 1}`;
      const applied = check.owned.has(id) || isKeywordLine(line) || side.inert.some((mark) => mark.line === at + 1);
      return { id, text: line, applied };
    }),
  );
}

function sourceSides(code: string, text: string | null | undefined, back: string | null): PrintedSide[] {
  const { A, B } = poolSides({ text: text ?? null, back: { text: back } });
  return [
    { code, side: "A", lines: A, inert: [] },
    { code, side: "B", lines: B, inert: [] },
  ].filter((side) => side.lines.length > 0);
}

/** The lines of a card the app does not apply. */
export function unappliedLines(code: string, text: string | null | undefined, check: TextCheck, back: string | null = null): CardLine[] {
  return cardLines(code, text, check, back).filter((line) => !line.applied);
}

/** True when the app leaves a line of this card unapplied. */
export function textInactive(code: string, text: string | null | undefined, check: TextCheck, back: string | null = null): boolean {
  return unappliedLines(code, text, check, back).length > 0;
}

/** The codes with a line the app does not apply. */
export function inactiveCodes(texts: Iterable<readonly [string, string | null, (string | null)?]>, check: TextCheck): ReadonlySet<string> {
  const inactive = new Set<string>();
  for (const [code, text, back] of texts) if (textInactive(code, text, check, back ?? null)) inactive.add(code);
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

