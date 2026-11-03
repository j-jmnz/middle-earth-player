// How the Campaign Log's structured facts read on the log screen and the path (docs/brief.md, Campaign): the rows as lines of segments, each
// card's name a segment with its code, so a tap on the name opens the card's preview (user request, 2026-11-01). Pure, so a test reads it.
import { carryParts } from "../../campaign/carry-words";

/** A run of a row's text; one with a `code` is a card's name, which opens that card. */
export type Segment = { text: string; code?: string };
/** One line of a row. */
export type Line = readonly Segment[];

/** A card's name, as a segment that opens it. */
export function cardSegment(code: string, nameOf: (code: string) => string): Segment {
  return { text: nameOf(code), code };
}

/** A line's plain text. */
export function lineText(line: Line): string {
  return line.map((segment) => segment.text).join("");
}

/** Card names joined by `between` (", " unless given), each a segment. */
export function namesLine(codes: readonly string[], nameOf: (code: string) => string, between = ", "): Line {
  return codes.flatMap((code, at) => (at === 0 ? [cardSegment(code, nameOf)] : [{ text: between }, cardSegment(code, nameOf)]));
}

/** A pool card as the path and the log read it: "The Fervor of Lore on Gimli", and "· used" once its once-per-campaign Action is recorded as used (41044:A:3). */
export function poolCardLine(card: { code: string; attachedTo?: string | null }, usedOnce: readonly string[], nameOf: (code: string) => string): Line {
  const host: Segment[] = card.attachedTo ? [{ text: " on " }, cardSegment(card.attachedTo, nameOf)] : [];
  const used: Segment[] = usedOnce.includes(card.code) ? [{ text: " · used" }] : [];
  return [cardSegment(card.code, nameOf), ...host, ...used];
}

/** The cards kept for the next campaign as segments, reading as carryWords: "Mendor and a Mendor's Support for each player". */
export function carryLine(cards: readonly { code: string; perPlayer?: boolean }[], nameOf: (code: string) => string): Line {
  const parts = carryParts(cards);
  // The joints andList puts between the parts: ", ", and " and " before the last.
  return parts.flatMap((part, at) => [
    ...(at > 0 ? [{ text: at === parts.length - 1 ? " and " : ", " }] : []),
    ...(part.before ? [{ text: part.before }] : []),
    cardSegment(part.code, nameOf),
    ...(part.after ? [{ text: part.after }] : []),
  ]);
}
