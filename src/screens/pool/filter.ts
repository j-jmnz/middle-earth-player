import { traitTokens } from "../../catalog/deck-save";
import { matchCard, searchIndexOf, searchTerms, type SearchRow } from "./card-search";
import { sphereWord } from "../kit/sphere-mark";

export type PoolPack = {
  code: string;
  name: string;
  position: number;
  cyclePosition: number;
};

export type CycleGroup = {
  cyclePosition: number;
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
  pack: { kind: "cycle"; cyclePosition: number } | { kind: "pack"; code: string } | null;
  trait: string | null;
  cost: string | null;
  unique: boolean;
  activeText: boolean;
};

export const emptyPoolFilter: PoolFilter = {
  sphere: null,
  typeCode: null,
  pack: null,
  trait: null,
  cost: null,
  unique: false,
  activeText: false,
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

export function cycleGroups(packs: readonly PoolPack[]): CycleGroup[] {
  const byCycle = new Map<number, PoolPack[]>();
  for (const pack of packs) {
    const group = byCycle.get(pack.cyclePosition) ?? [];
    group.push(pack);
    byCycle.set(pack.cyclePosition, group);
  }
  return [...byCycle.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([cyclePosition, group]) => {
      const sorted = [...group].sort((left, right) => left.position - right.position || left.name.localeCompare(right.name));
      const label = sorted[0]?.name ?? String(cyclePosition);
      return { cyclePosition, label, packs: sorted };
    });
}

function cyclePackCodes(groups: readonly CycleGroup[], cyclePosition: number): ReadonlySet<string> {
  const group = groups.find((candidate) => candidate.cyclePosition === cyclePosition);
  return new Set(group?.packs.map((pack) => pack.code) ?? []);
}

function matchesPack(card: PoolCard, filter: PoolFilter, groups: readonly CycleGroup[]): boolean {
  if (!filter.pack) return true;
  if (filter.pack.kind === "pack") {
    return card.packCode === filter.pack.code || card.packCodes.includes(filter.pack.code);
  }
  const cycle = cyclePackCodes(groups, filter.pack.cyclePosition);
  if (cycle.has(card.packCode)) return true;
  return card.packCodes.some((code) => cycle.has(code));
}

/** The cards the search and filter keep. With search text they come best match first, ties in the order given (sortPool). */
export function filterPool<T extends PoolCard & SearchRow>(
  cards: readonly T[],
  search: string,
  filter: PoolFilter,
  groups: readonly CycleGroup[],
  // Codes whose unique text is inactive (textInactive in src/catalog/active-text.ts).
  inactiveCodes: ReadonlySet<string>,
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
    kept.push({ card, score, at });
  }
  if (searching) kept.sort((left, right) => left.score - right.score || left.at - right.at);
  return kept.map((entry) => entry.card);
}

// An alternate printing's tag ("(MotK) Aragorn", the Messenger of the King heroes) does not sort; the name does.
function nameKey(name: string): string {
  return name.replace(/^\([^)]*\)\s*/, "");
}

/** The pool in name order, a printing's leading tag ignored (the untagged printing first), then by code. Each key is worked out once. */
export function sortPool<T extends { code: string; name: string }>(cards: readonly T[]): T[] {
  const keyed = cards.map((card) => {
    const key = nameKey(card.name);
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

export function packChooserRows(groups: readonly CycleGroup[]): PackChooserRow[] {
  const rows: PackChooserRow[] = [{ key: "any", label: "Any", detail: "", pack: null }];
  for (const group of groups) {
    rows.push({
      key: `cycle-${group.cyclePosition}`,
      label: group.label,
      detail: "Cycle",
      pack: { kind: "cycle", cyclePosition: group.cyclePosition },
    });
    for (const pack of group.packs) {
      rows.push({
        key: `pack-${pack.code}`,
        label: pack.name,
        detail: "Pack",
        pack: { kind: "pack", code: pack.code },
      });
    }
  }
  return rows;
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
