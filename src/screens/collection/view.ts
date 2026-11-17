// What the Collection screens say (docs/design-system.md, Collection): the list under its sticky cycle headings, each switch's line,
// and the tally over the list. Pure, so the words are tested without a screen.
import { collectionHeadings, setOwnership, type CollectionSet, type SetOwnership } from "../../catalog/collection";

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

/** What a screen reader hears for a switch: its state, and the packs while only some are owned. */
export function ownershipWords(ownership: SetOwnership): string {
  if (ownership === "all") return "Owned";
  if (ownership === "some") return "Some packs owned";
  return "Not owned";
}
