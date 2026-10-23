import { traitTokens } from "../catalog/deck-save";
import { sphereWord } from "./sphere-mark";

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

export function filterPool<T extends PoolCard>(
  cards: readonly T[],
  search: string,
  filter: PoolFilter,
  groups: readonly CycleGroup[],
  activeCodes: ReadonlySet<string>,
): T[] {
  const query = search.trim().toLowerCase();
  return cards.filter((card) => {
    if (query.length > 0 && !card.name.toLowerCase().includes(query)) return false;
    if (filter.sphere && card.sphereCode !== filter.sphere) return false;
    if (filter.typeCode && card.typeCode !== filter.typeCode) return false;
    if (!matchesPack(card, filter, groups)) return false;
    if (filter.trait && !traitTokens(card.traits).includes(filter.trait)) return false;
    if (filter.cost && shownCost(card) !== filter.cost) return false;
    if (filter.unique && !card.isUnique) return false;
    if (filter.activeText && !activeCodes.has(card.code)) return false;
    return true;
  });
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
