// How the cards a Resolution keeps for the next campaign read (01131:B:2): one phrase for the Resolution sentence, the Campaign Log's row and
// the campaign setup's offer. Pure, so a test reads it.
import { seatPenalty, threatWords } from "./two-towers-view.ts";

type Carried = { code: string; perPlayer?: boolean };

/** One part of the phrase: the card and the words around its name ("a " and " for each player", "2 copies of "). */
export type CarryPart = { code: string; before: string; after: string };

/** The cards as the parts of one phrase, duplicates collapsed: a copy of one card for each player, or 2 copies of one card. */
export function carryParts(cards: readonly Carried[]): CarryPart[] {
  const rows = new Map<string, { code: string; count: number; perPlayer: boolean }>();
  for (const card of cards) {
    const key = `${card.code}\u0000${card.perPlayer === true}`;
    const row = rows.get(key);
    if (row) row.count += 1;
    else rows.set(key, { code: card.code, count: 1, perPlayer: card.perPlayer === true });
  }
  return [...rows.values()].map((row) => (row.perPlayer ? { code: row.code, before: "a ", after: " for each player" } : row.count > 1 ? { code: row.code, before: `${row.count} copies of `, after: "" } : { code: row.code, before: "", after: "" }));
}

/** The cards as one phrase, duplicates collapsed: "Mendor and a Mendor's Support for each player". Two copies of one card read "2 copies of Name". */
export function carryWords(cards: readonly Carried[], nameOf: (code: string) => string): string {
  return andList(carryParts(cards).map((part) => `${part.before}${nameOf(part.code)}${part.after}`));
}

/** "A", "A and B", "A, B and C": an "and" only before the last. */
export function andList(parts: readonly string[]): string {
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : (parts[0] ?? "");
}

/** What a finished save hands on: the counts, and the threat penalties (the table's, and each seat's own where it took one, as the log's Threat Modifiers row reads them). */
type Continued = { heroes: number; fallen: number; captives: number; pool: number; penalty: number; penaltyBySeat?: readonly number[]; seatCount?: number; enemies?: number };

/** The permanent threat penalty of a finished save in words: "a +1 threat penalty", and with a penalty a seat took of its own the Threat Modifiers row's words ("threat penalties (Player 1: +3 · Player 2: +1)"); none for no penalty. */
function penaltyWords(offer: Continued): string[] {
  const bySeat = offer.penaltyBySeat ?? [];
  if (bySeat.every((amount) => amount === 0)) return offer.penalty > 0 ? [`a +${offer.penalty} threat penalty`] : [];
  const seats = offer.seatCount ?? 1;
  const log = { threatPenalty: offer.penalty, threatPenaltyBySeat: bySeat };
  return seats === 1 ? [`a +${seatPenalty(log, 0)} threat penalty`] : [`threat penalties (${threatWords(log, seats)})`];
}

/** What a continued save takes in from a finished save of the box before it, a zero left out: "3 heroes, 1 fallen hero, 1 captive, 2 cards in the pool and a +1 threat penalty". The enemies under The Black Gate come last. */
export function continueWords(offer: Continued): string {
  const count = (n: number, one: string, many: string): string[] => (n > 0 ? [`${n} ${n === 1 ? one : many}`] : []);
  const parts = [...count(offer.heroes, "hero", "heroes"), ...count(offer.fallen, "fallen hero", "fallen heroes"), ...count(offer.captives, "captive", "captives"), ...count(offer.pool, "card in the pool", "cards in the pool"), ...penaltyWords(offer), ...count(offer.enemies ?? 0, "enemy under The Black Gate", "enemies under The Black Gate")];
  return parts.length === 0 ? "an empty log" : andList(parts);
}

/** "is" for one card or a copy of one card for each player ("A Ranger Sense for each player is kept"), "are" for several cards or several copies of one. */
export function carryVerb(cards: readonly Carried[]): "is" | "are" {
  return cards.length > 1 ? "are" : "is";
}
