// The player's collection (docs/brief.md, Deckbuilding): the products they own, as switches the Collection screen shows under its
// headings, and which deck-legal cards that leaves them. data/collection.json lists the switches, each with the catalog packs it holds;
// the save keeps only the packs switched off, so a pack the catalog adds later starts owned and no saved row means everything is.
import { z } from "zod";

export const collectionSetSchema = z.object({
  // Stable: a saved collection names packs, not sets, but a testID and the pool's Pack or cycle filter name the set.
  id: z.string().regex(/^[a-z0-9-]+$/),
  // The heading the screen files it under ("Cycles"); sets with the same heading sit together, in the file's order.
  heading: z.string().min(1),
  // The row's name under its heading ("Core Set" under Core Set, "Angmar Awakened" under Cycles).
  name: z.string().min(1),
  // Its name on its own, outside the Collection screen ("Core Set (2011)"): the pool's Pack or cycle chooser.
  title: z.string().min(1),
  // A short line before the card count: the year, the revised product that holds the same cards, or what kind of pack it is.
  detail: z.string().min(1).nullable(),
  // Catalog pack codes. A card is in the set when any of its printings is in one of them.
  packs: z.array(z.string().min(1)).min(1),
});

export type CollectionSet = z.infer<typeof collectionSetSchema>;

export const collectionSchema = z.array(collectionSetSchema);

export type CollectionHeading = { heading: string; sets: readonly CollectionSet[] };

/** The sets under their headings, each heading where its first set is. */
export function collectionHeadings(sets: readonly CollectionSet[]): CollectionHeading[] {
  const order: CollectionHeading[] = [];
  const byHeading = new Map<string, CollectionSet[]>();
  for (const set of sets) {
    let group = byHeading.get(set.heading);
    if (!group) {
      group = [];
      byHeading.set(set.heading, group);
      order.push({ heading: set.heading, sets: group });
    }
    group.push(set);
  }
  return order;
}

/** Every pack some set holds. A printing in any other pack (none today) neither gives nor takes a card. */
export function claimedPacks(sets: readonly CollectionSet[]): ReadonlySet<string> {
  return new Set(sets.flatMap((set) => set.packs));
}

/** A pool row as far as the collection reads it: the pack of its first printing, and every pack it is printed in. */
export type PrintedRow = { packCode: string; packCodes: readonly string[] };

/** The packs a card is printed in: `packCodes`, or its one pack for a row built without them. */
export function printedIn(row: PrintedRow): readonly string[] {
  return row.packCodes.length > 0 ? row.packCodes : [row.packCode];
}

/**
 * The packs that hold a deck-legal card: every pack one of the rows is printed in. A pack outside it (a Campaign Expansion, a
 * scenario pack of encounter cards only) gives the player nothing to build with, so no screen lists it.
 */
export function deckPacks(rows: readonly PrintedRow[]): ReadonlySet<string> {
  return new Set(rows.flatMap(printedIn));
}

export type SetOwnership = "all" | "some" | "none";

/** Whether the player owns every pack of the set, some of them or none. */
export function setOwnership(set: { packs: readonly string[] }, notOwned: ReadonlySet<string>): SetOwnership {
  const off = set.packs.filter((code) => notOwned.has(code)).length;
  if (off === 0) return "all";
  return off === set.packs.length ? "none" : "some";
}

/** A card is owned when one of its printings is in a claimed pack the player has not switched off. */
export function ownsCard(packCodes: readonly string[], claimed: ReadonlySet<string>, notOwned: ReadonlySet<string>): boolean {
  return packCodes.some((code) => claimed.has(code) && !notOwned.has(code));
}

/** The codes of the cards the player does not own, of the rows given; empty while nothing is switched off. */
export function unownedCodes(
  rows: readonly { code: string; packCode: string; packCodes: readonly string[] }[],
  claimed: ReadonlySet<string>,
  notOwned: ReadonlySet<string>,
): ReadonlySet<string> {
  const out = new Set<string>();
  if (notOwned.size === 0) return out;
  for (const row of rows) {
    if (!ownsCard(printedIn(row), claimed, notOwned)) out.add(row.code);
  }
  return out;
}

/** The packs switched off after one or more packs are switched on or off, sorted so the saved row reads the same each time. */
export function switchPacks(notOwned: readonly string[], packs: readonly string[], owned: boolean): string[] {
  const next = new Set(notOwned);
  for (const code of packs) {
    if (owned) next.delete(code);
    else next.add(code);
  }
  return [...next].sort();
}

/** The saved form: `{ notOwned: [...] }`. Anything else reads as everything owned, so a bad row never hides cards. */
export function parseCollection(value: unknown): string[] {
  const parsed = z.object({ notOwned: z.array(z.string()) }).safeParse(value);
  return parsed.success ? [...new Set(parsed.data.notOwned)].sort() : [];
}
