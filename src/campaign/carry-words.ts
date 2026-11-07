// How the cards a Resolution keeps for the next campaign read (01131:B:2): one phrase for the Resolution sentence, the Campaign Log's row and
// the campaign setup's offer. Pure, so a test reads it.

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

/** What a continued save takes in from a finished save of the box before it: "3 heroes, 1 fallen hero and 2 cards in the pool". */
export function continueWords(offer: { heroes: number; fallen: number; pool: number }): string {
  const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
  return andList([count(offer.heroes, "hero", "heroes"), count(offer.fallen, "fallen hero", "fallen heroes"), count(offer.pool, "card in the pool", "cards in the pool")]);
}

/** "is" for one card or a copy of one card for each player ("A Ranger Sense for each player is kept"), "are" for several cards or several copies of one. */
export function carryVerb(cards: readonly Carried[]): "is" | "are" {
  return cards.length > 1 ? "are" : "is";
}
