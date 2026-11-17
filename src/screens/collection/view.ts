// What the Collection screens say (docs/design-system.md, Collection): the list under its sticky cycle headings, each switch's line,
// and the tally over the list. Pure, so the words are tested without a screen.
import { collectionHeadings, setOwnership, type CollectionSet, type SetOwnership } from "../../catalog/collection";

/** The words on a card outside the collection: the pool's line and strip, the deck editor's strip. */
export const NOT_OWNED = "Not owned";

export type CollectionRow = { kind: "heading"; title: string } | { kind: "set"; set: CollectionSet };

/** The rows of the Collection list and the indices of its headings, which stay at the top while their sets scroll under them. */
export function collectionRows(sets: readonly CollectionSet[]): { rows: CollectionRow[]; sticky: number[] } {
  const rows: CollectionRow[] = [];
  const sticky: number[] = [];
  for (const group of collectionHeadings(sets)) {
    sticky.push(rows.length);
    rows.push({ kind: "heading", title: group.heading });
    for (const set of group.sets) rows.push({ kind: "set", set });
  }
  return { rows, sticky };
}

/** How many deck-legal cards each set holds: a card counts in every set one of its printings is in. */
export function setCardCounts(rows: readonly { packCode: string; packCodes: readonly string[] }[], sets: readonly CollectionSet[]): ReadonlyMap<string, number> {
  const setsOfPack = new Map<string, string[]>();
  for (const set of sets) for (const code of set.packs) setsOfPack.set(code, [...(setsOfPack.get(code) ?? []), set.id]);
  const counts = new Map<string, number>(sets.map((set) => [set.id, 0]));
  for (const row of rows) {
    const codes = row.packCodes.length > 0 ? row.packCodes : [row.packCode];
    const ids = new Set(codes.flatMap((code) => setsOfPack.get(code) ?? []));
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function cardWords(count: number): string {
  return `${count.toLocaleString("en-US")} player ${count === 1 ? "card" : "cards"}`;
}

/** A switch's line: its detail, the packs owned while only some are, and its card count. "Or the Hero Expansion · 75 player cards". */
export function setDetail(set: CollectionSet, ownership: SetOwnership, notOwned: ReadonlySet<string>, cards: number): string {
  const parts: string[] = [];
  if (ownership === "some") {
    const owned = set.packs.filter((code) => !notOwned.has(code)).length;
    parts.push(`${owned} of ${set.packs.length} packs owned`);
  } else if (set.detail) {
    parts.push(set.detail);
  }
  parts.push(cardWords(cards));
  return parts.join(" · ");
}

/** The line over the list: "9 of 23 owned · 642 player cards", or "Everything owned · 1,048 player cards". */
export function collectionTally(sets: readonly CollectionSet[], notOwned: ReadonlySet<string>, ownedCards: number): string {
  if (notOwned.size === 0) return `Everything owned · ${cardWords(ownedCards)}`;
  const owned = sets.filter((set) => setOwnership(set, notOwned) !== "none").length;
  return `${owned} of ${sets.length} owned · ${cardWords(ownedCards)}`;
}

/**
 * The deck editor's note on the cards outside the collection, by title, in deck order: "3 cards are not in your collection: Bow of the
 * Galadhrim, Elven Light and A Light in the Dark." Past five titles the rest are counted. Null when every card is owned.
 */
export function notOwnedNote(names: readonly string[]): string | null {
  const titles = [...new Set(names)];
  if (titles.length === 0) return null;
  const head = titles.length === 1 ? "1 card is not in your collection" : `${titles.length} cards are not in your collection`;
  const shown = titles.length > 5 ? [...titles.slice(0, 5), `${titles.length - 5} more`] : titles;
  const list = shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}`;
  return `${head}: ${list}.`;
}
