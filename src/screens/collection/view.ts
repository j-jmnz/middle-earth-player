// What the Collection screen says (docs/design-system.md, Collection): the list under its headings, each row's line and the tally
// over the list. Pure, so the words are tested without a screen.
import { collectionHeadings, printedIn, type CollectionSet, type PrintedRow, type SetOwnership } from "../../catalog/collection";

/** The words on a card outside the collection: the pool's line and strip, the deck editor's strip. */
export const NOT_OWNED = "Not owned";

/** A pack of a Collection row: its name and how many deck-legal cards are printed in it. */
export type CollectionPack = { code: string; name: string; cards: number };

/** A row of the Collection list: a switch of data/collection.json cut to its packs that hold a deck-legal card. */
export type CollectionEntry = {
  id: string;
  label: string;
  // The year, or the revised product that holds the same cards.
  detail: string | null;
  packs: readonly CollectionPack[];
  // The codes of `packs`, in their order.
  codes: readonly string[];
  // A card counts once, in however many of the packs it is printed.
  cards: number;
};

export type CollectionRow = { kind: "heading"; title: string } | { kind: "set"; entry: CollectionEntry };

/** How many deck-legal cards each set holds: a card counts in every set one of its printings is in. */
export function setCardCounts(rows: readonly PrintedRow[], sets: readonly CollectionSet[]): ReadonlyMap<string, number> {
  const setsOfPack = new Map<string, string[]>();
  for (const set of sets) for (const code of set.packs) setsOfPack.set(code, [...(setsOfPack.get(code) ?? []), set.id]);
  const counts = new Map<string, number>(sets.map((set) => [set.id, 0]));
  for (const row of rows) {
    const ids = new Set(printedIn(row).flatMap((code) => setsOfPack.get(code) ?? []));
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** How many deck-legal cards are printed in each pack. */
export function packCardCounts(rows: readonly PrintedRow[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) for (const code of new Set(printedIn(row))) counts.set(code, (counts.get(code) ?? 0) + 1);
  return counts;
}

/**
 * The rows of the Collection list under their headings, in the file's order. A pack with no deck-legal card is left out, and so is
 * a set with none (a Campaign Expansion): there is nothing of theirs to build with. A set left with one pack of several is that
 * pack's row, under the pack's name.
 */
export function collectionRows(sets: readonly CollectionSet[], rows: readonly PrintedRow[], packNames: ReadonlyMap<string, string>): CollectionRow[] {
  const perPack = packCardCounts(rows);
  const perSet = setCardCounts(rows, sets);
  const out: CollectionRow[] = [];
  for (const group of collectionHeadings(sets)) {
    const entries: CollectionEntry[] = [];
    for (const set of group.sets) {
      const packs = set.packs.flatMap((code) => {
        const cards = perPack.get(code) ?? 0;
        return cards > 0 ? [{ code, name: packNames.get(code) ?? code, cards }] : [];
      });
      const only = packs.length === 1 ? packs[0] : undefined;
      if (packs.length === 0) continue;
      entries.push({
        id: set.id,
        label: only && set.packs.length > 1 ? only.name : set.name,
        detail: set.detail,
        packs,
        codes: packs.map((pack) => pack.code),
        cards: perSet.get(set.id) ?? 0,
      });
    }
    if (entries.length === 0) continue;
    out.push({ kind: "heading", title: group.heading });
    for (const entry of entries) out.push({ kind: "set", entry });
  }
  return out;
}

/** "75 cards". Every card the Collection counts is a deck-legal player card. */
function cardWords(count: number): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "card" : "cards"}`;
}

function lowerFirst(words: string): string {
  return words.charAt(0).toLowerCase() + words.slice(1);
}

/**
 * A row's line: what it holds, then its card count. "7 packs, or the Hero Expansion · 75 cards", "3 of 7 packs · 75 cards" while
 * only some are owned, "2020 · 73 cards" for a row of one pack.
 */
export function entryLine(entry: CollectionEntry, ownership: SetOwnership, notOwned: ReadonlySet<string>): string {
  const parts: string[] = [];
  if (ownership === "some") {
    parts.push(`${entry.codes.filter((code) => !notOwned.has(code)).length} of ${entry.codes.length} packs`);
  } else if (entry.codes.length > 1) {
    parts.push(entry.detail ? `${entry.codes.length} packs, ${lowerFirst(entry.detail)}` : `${entry.codes.length} packs`);
  } else if (entry.detail) {
    parts.push(entry.detail);
  }
  parts.push(cardWords(entry.cards));
  return parts.join(" · ");
}

/** The line over the list: "653 of 853 cards", or "Everything owned · 853 cards". */
export function collectionTally(ownedCards: number, cards: number): string {
  if (ownedCards >= cards) return `Everything owned · ${cardWords(cards)}`;
  return `${ownedCards.toLocaleString("en-US")} of ${cardWords(cards)}`;
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
