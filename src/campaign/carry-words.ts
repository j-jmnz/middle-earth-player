// How the cards a Resolution keeps for the next campaign read (01131:B:2): one phrase for the Resolution sentence, the Campaign Log's row and
// the start panel's offer. Pure, so a test reads it.

type Carried = { code: string; perPlayer?: boolean };

/** The cards as one phrase, duplicates collapsed: "Mendor and a Mendor's Support for each player". Two copies of one card read "2 copies of Name". */
export function carryWords(cards: readonly Carried[], nameOf: (code: string) => string): string {
  const rows = new Map<string, { code: string; count: number; perPlayer: boolean }>();
  for (const card of cards) {
    const key = `${card.code}\u0000${card.perPlayer === true}`;
    const row = rows.get(key);
    if (row) row.count += 1;
    else rows.set(key, { code: card.code, count: 1, perPlayer: card.perPlayer === true });
  }
  const parts = [...rows.values()].map((row) => (row.perPlayer ? `a ${nameOf(row.code)} for each player` : row.count > 1 ? `${row.count} copies of ${nameOf(row.code)}` : nameOf(row.code)));
  return andList(parts);
}

/** "A", "A and B", "A, B and C": an "and" only before the last. */
export function andList(parts: readonly string[]): string {
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : (parts[0] ?? "");
}

/** "is" for one card or a copy of one card for each player ("A Ranger Sense for each player is kept"), "are" for several cards or several copies of one. */
export function carryVerb(cards: readonly Carried[]): "is" | "are" {
  return cards.length > 1 ? "are" : "is";
}
