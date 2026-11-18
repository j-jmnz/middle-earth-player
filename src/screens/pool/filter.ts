import { traitTokens } from "../../catalog/deck-save";
import { matchCard, searchIndexOf, searchTerms, type SearchRow } from "./card-search";
import { untagged } from "../groups/motk";
import { sphereWord } from "../kit/sphere-mark";

export type PoolPack = {
  code: string;
  name: string;
  position: number;
  cyclePosition: number;
};

// A switch of the collection (data/collection.json) as the Pack or cycle chooser lists it: its own name, then its packs.
export type PackGroup = {
  id: string;
  label: string;
  packs: PoolPack[];
};

export type PoolCard = {
  code: string;
  name: string;
  typeCode: string;
  sphereCode: string | null;
  packCode: string;
  packCodes: readonly string[];
  traits: string | null;
  cost: string | null;
  threat: number | null;
  isUnique: boolean;
};

export type PoolFilter = {
  sphere: string | null;
  typeCode: string | null;
  pack: { kind: "set"; id: string } | { kind: "pack"; code: string } | null;
  trait: string | null;
  cost: string | null;
  unique: boolean;
  activeText: boolean;
  // "My collection": only the cards the player owns. On whenever the pool opens; it hides nothing while everything is owned.
  owned: boolean;
};

export const emptyPoolFilter: PoolFilter = {
  sphere: null,
  typeCode: null,
  pack: null,
  trait: null,
  cost: null,
  unique: false,
  activeText: false,
  owned: true,
};

/**
 * What a request from outside the pool (the deck editor's Add) leaves: the type it names (null is All), no search text, and the
 * "Applied only" switch off, so nothing hides the cards it asked to see. The sheet's other fields stay as the builder set them.
 */
export function applyTypeRequest(filter: PoolFilter, type: string | null): { filter: PoolFilter; search: string } {
  return { filter: { ...filter, typeCode: type, activeText: false }, search: "" };
}

/** The sentence a screen reader hears when a request changes the type: "Showing heroes", or "Showing all cards". */
export function typeRequestWords(types: readonly { code: string; name: string }[], type: string | null): string {
  if (type == null) return "Showing all cards";
  const name = types.find((entry) => entry.code === type)?.name ?? type;
  return `Showing ${name.toLowerCase()} cards`;
}

/** The chooser's groups: each collection switch with the catalog packs it holds, in the collection's order. */
export function packGroups(sets: readonly { id: string; title: string; packs: readonly string[] }[], packs: readonly PoolPack[]): PackGroup[] {
  const byCode = new Map(packs.map((pack) => [pack.code, pack]));
  return sets.map((set) => ({ id: set.id, label: set.title, packs: set.packs.flatMap((code) => byCode.get(code) ?? []) }));
}

function matchesPack(card: PoolCard, filter: PoolFilter, groups: readonly PackGroup[]): boolean {
  if (!filter.pack) return true;
  const selected = filter.pack;
  const codes = selected.kind === "pack" ? [selected.code] : (groups.find((group) => group.id === selected.id)?.packs.map((pack) => pack.code) ?? []);
  return codes.some((code) => card.packCode === code || card.packCodes.includes(code));
}

/** The cards the search and filter keep. With search text they come best match first, ties in the order given (sortPool). */
export function filterPool<T extends PoolCard & SearchRow>(
  cards: readonly T[],
  search: string,
  filter: PoolFilter,
  groups: readonly PackGroup[],
  // Codes whose unique text is inactive (textInactive in src/catalog/active-text.ts).
  inactiveCodes: ReadonlySet<string>,
  // Codes of the cards outside the player's collection (unownedCodes in src/catalog/collection.ts); empty while everything is owned.
  unowned: ReadonlySet<string>,
): T[] {
  const terms = searchTerms(search);
  const searching = terms.length > 0;
  const kept: { card: T; score: number; at: number }[] = [];
  for (const [at, card] of cards.entries()) {
    let score = 0;
    if (searching) {
      const found = matchCard(searchIndexOf(card), terms);
      if (found == null) continue;
      score = found;
    }
    if (filter.sphere && card.sphereCode !== filter.sphere) continue;
    if (filter.typeCode && card.typeCode !== filter.typeCode) continue;
    if (!matchesPack(card, filter, groups)) continue;
    if (filter.trait && !traitTokens(card.traits).includes(filter.trait)) continue;
    if (filter.cost && shownCost(card) !== filter.cost) continue;
    if (filter.unique && !card.isUnique) continue;
    if (filter.activeText && inactiveCodes.has(card.code)) continue;
    if (filter.owned && unowned.has(card.code)) continue;
    kept.push({ card, score, at });
  }
  if (searching) kept.sort((left, right) => left.score - right.score || left.at - right.at);
  return kept.map((entry) => entry.card);
}

/** The pool in name order, a printing's leading tag ignored (the untagged printing first), then by code. Each key is worked out once. */
export function sortPool<T extends { code: string; name: string }>(cards: readonly T[]): T[] {
  const keyed = cards.map((card) => {
    const key = untagged(card.name);
    return { card, key, tagged: key === card.name ? 0 : 1 };
  });
  keyed.sort((left, right) => left.key.localeCompare(right.key) || left.tagged - right.tagged || left.card.code.localeCompare(right.card.code));
  return keyed.map((entry) => entry.card);
}

/** The number printed in the row: cost, or threat when the card has no cost. */
export function shownCost(card: { cost: string | null; threat: number | null }): string {
  if (card.cost && card.cost.length > 0) return card.cost;
  if (card.threat == null) return "—";
  return String(card.threat);
}

export function poolDetail(card: {
  typeName: string;
  sphereName: string | null;
  cost: string | null;
  threat: number | null;
}): string {
  const sphere = sphereWord(card.sphereName);
  return `${card.typeName} · ${sphere} · ${shownCost(card)}`;
}

export type PackChooserRow = {
  key: string;
  label: string;
  detail: string;
  pack: PoolFilter["pack"];
};

/**
 * The Pack or cycle rows: each collection switch, then its packs when it holds more than one (a switch of one pack is that pack's row).
 * With `notOwned` (My collection on), only the packs the player owns, and no switch they own none of.
 */
export function packChooserRows(groups: readonly PackGroup[], notOwned: ReadonlySet<string> | null): PackChooserRow[] {
  const rows: PackChooserRow[] = [{ key: "any", label: "Any", detail: "", pack: null }];
  for (const group of groups) {
    const packs = notOwned ? group.packs.filter((pack) => !notOwned.has(pack.code)) : group.packs;
    if (packs.length === 0) continue;
    if (group.packs.length > 1) {
      rows.push({ key: `set-${group.id}`, label: group.label, detail: "Cycle", pack: { kind: "set", id: group.id } });
    }
    for (const pack of packs) {
      rows.push({ key: `pack-${pack.code}`, label: pack.name, detail: "Pack", pack: { kind: "pack", code: pack.code } });
    }
  }
  return rows;
}

/** The chooser's word for the pick: the switch's name or the pack's, or Any. */
export function packDetail(filter: PoolFilter, groups: readonly PackGroup[]): string {
  const selected = filter.pack;
  if (!selected) return "Any";
  if (selected.kind === "set") return groups.find((group) => group.id === selected.id)?.label ?? "Cycle";
  for (const group of groups) {
    const pack = group.packs.find((candidate) => candidate.code === selected.code);
    if (pack) return pack.name;
  }
  return selected.code;
}

/** The count over the pool: "642 cards in your collection", "1,048 cards · 406 you don't own", or "852 cards" while all are owned. */
export function poolCountLine(shown: number, owned: boolean, collectionSet: boolean, unownedShown: number): string {
  const cards = `${shown.toLocaleString("en-US")} ${shown === 1 ? "card" : "cards"}`;
  if (!collectionSet) return cards;
  if (owned) return `${cards} in your collection`;
  return unownedShown > 0 ? `${cards} · ${unownedShown.toLocaleString("en-US")} you don't own` : cards;
}

export type TraitChooserRow = {
  key: string;
  label: string;
  detail: string;
};

export function traitChooserRows(traits: readonly string[]): TraitChooserRow[] {
  return [
    { key: "any", label: "Any", detail: "" },
    ...traits.map((trait) => ({ key: trait, label: trait, detail: "" })),
  ];
}

export function costOptions(rows: readonly { cost: string | null; threat: number | null }[]): string[] {
  const costs = new Set<string>();
  for (const row of rows) {
    const shown = shownCost(row);
    if (shown !== "—") costs.add(shown);
  }
  return [...costs].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

export function filterSheetAnimation(reduceMotion: boolean): "none" | "fade" {
  return reduceMotion ? "none" : "fade";
}

/** How many fields the filter sheet sets, for the Filter button ("Filter · 2"). The type is the chip row's, in plain sight. */
export function activeFilterCount(filter: PoolFilter): number {
  let count = 0;
  if (filter.sphere) count += 1;
  if (filter.pack) count += 1;
  if (filter.trait) count += 1;
  if (filter.cost) count += 1;
  if (filter.unique) count += 1;
  if (filter.activeText) count += 1;
  return count;
}
