// Rules: dcce.ship-enemies, dcce.boarding (data/rules/entries.json). The table's crowding budget for the two rows that can run out of room, staging and the
// engagement area (docs/design-system-table.md, Spacing and the play area's rows, "Squeeze, then fold"), as dock-budget.ts is the dock's. Pure, and the
// same for every scenario:
//
// 1. Natural: groups stand a gap apart.
// 2. Squeeze: groups overlap evenly while every step between neighbours is at least a 44 pt target. That is exactly what `rowXs` does today.
// 3. Fold: when even 44 pt steps do not fit, groups leave the row one at a time, in fold order, into a fold stack at the row's left end, until the rest
//    fits at 44 pt steps beside it. A group the open moment asks about, a pick, or the banner's beat names never folds.
//
// A row whose steps stay at 44 pt or more is laid out as `rowXs` lays it out, which a test pins for the Fellowship and Mirkwood tables.
import { rowXs } from "./layout-slots.ts";
import type { ZoneEntry } from "./selectors.ts";

/** One group of a row: a card with its stack, a guarded pair, an engaged enemy with its shadows and fighters. */
export type FoldGroup = {
  // The lead card's id.
  id: string;
  // The room the group takes in the row.
  width: number;
  // Every card of the group, the lead first (the fold stack counts them).
  cards: readonly string[];
  // Folds first at the lowest rank; ties fold leftmost first. Never folds when pinned.
  rank: number;
  pinned: boolean;
};

export type FoldStack = {
  // The row's left end; its width is the stack's.
  x: number;
  w: number;
  // The folded groups, left to right, and every card in them.
  groups: readonly number[];
  cards: readonly string[];
  // The card whose face the stack shows: the first folded group's lead.
  top: string;
};

export type FoldPlan = {
  // The left edge of each group, or null for a folded one.
  xs: readonly (number | null)[];
  stack: FoldStack | null;
  // The least step between two shown neighbours (Infinity with fewer than two shown).
  step: number;
  // Every step is at least the target: false only when nothing more may fold.
  fits: boolean;
};

// The smallest step between neighbours when `widths` stand across `width`, squeezed evenly (`rowXs`) when they do not fit a gap apart. Infinity while
// nothing overlaps: groups a gap apart need no target, however narrow.
export function leastStep(widths: readonly number[], width: number, gap: number): number {
  if (widths.length <= 1) return Infinity;
  const natural = widths.reduce((sum, w) => sum + w, 0) + gap * (widths.length - 1);
  if (natural <= width) return Infinity;
  const squeeze = (natural - width) / (widths.length - 1);
  return Math.min(...widths.slice(0, -1).map((w) => w + gap - squeeze));
}

/**
 * The row's groups across `[x, x + width]`: squeezed while every step stays at `target`, else folded. `stackW` is the fold stack's width; it and one gap
 * are taken from the row once anything has folded.
 */
export function foldRow(groups: readonly FoldGroup[], row: { x: number; width: number; gap: number; target: number; stackW: number }): FoldPlan {
  const folded: number[] = [];
  const shown = () => groups.map((_, at) => at).filter((at) => !folded.includes(at));
  for (;;) {
    const kept = shown();
    const taken = folded.length > 0 ? row.stackW + row.gap : 0;
    const step = leastStep(kept.map((at) => groups[at]?.width ?? 0), row.width - taken, row.gap);
    const next = kept
      .filter((at) => groups[at]?.pinned !== true)
      .sort((left, right) => (groups[left]?.rank ?? 0) - (groups[right]?.rank ?? 0) || left - right)[0];
    if (step >= row.target || kept.length <= 1 || next == null) {
      const xs: (number | null)[] = groups.map(() => null);
      const placed = rowXs(kept.map((at) => groups[at]?.width ?? 0), row.x + taken, row.width - taken, row.gap);
      kept.forEach((at, index) => {
        xs[at] = placed[index] ?? row.x + taken;
      });
      const order = [...folded].sort((left, right) => left - right);
      const first = order[0];
      const stack: FoldStack | null =
        first == null ? null : { x: row.x, w: row.stackW, groups: order, cards: order.flatMap((at) => groups[at]?.cards ?? []), top: groups[first]?.id ?? "" };
      return { xs, stack, step, fits: step >= row.target };
    }
    folded.push(next);
  }
}

// What the fold stack says: a count strip and a word.
export const FOLD_WORD = "More";
export const foldCount = (count: number): string => `+${count}`;

/** What a screen reader hears of a fold stack: "3 more cards in staging". `where` is "staging" or "the engagement area". */
export function foldWords(count: number, where: string): string {
  return `${count} more ${count === 1 ? "card" : "cards"} in ${where}`;
}

/** The row list's title: where the cards were, as the panel names them. */
export function foldTitle(where: "staging" | "engaged"): string {
  return where === "staging" ? "Staging" : "Engagement area";
}

// The fold order of a staging group, lowest first (docs/design-system-table.md): the Stormcaller's area while it is not at the players' stage (0, built by
// its scenario phase), then cards the players control (`claimed`, the engine's marker for an objective a player took; a freed tower is one), then guarded
// pairs, then locations, then enemies; any other card goes last. A revealed card has a `controller` (the seat that revealed it), so that says nothing here.
export const STAGING_RANK = { area: 0, controlled: 1, guarded: 2, location: 3, enemy: 4, other: 5 } as const;

/** The fold rank of a staging group, from its lead entry and how many cards it holds. */
export function stagingRank(group: readonly ZoneEntry[]): number {
  const lead = group[0];
  if (!lead) return STAGING_RANK.other;
  if (lead.card.claimed === true) return STAGING_RANK.controlled;
  if (group.length > 1) return STAGING_RANK.guarded;
  if (lead.kind === "location") return STAGING_RANK.location;
  if (lead.kind === "enemy" || lead.kind == null) return STAGING_RANK.enemy;
  return STAGING_RANK.other;
}

/** Whether a group of entries names a card `keep` holds: the open moment's cards, the picked ones and the banner's beat. */
export function keeps(group: readonly ZoneEntry[], keep: ReadonlySet<string> | undefined): boolean {
  if (!keep || keep.size === 0) return false;
  return group.some((entry) => keep.has(entry.card.id) || entry.attached.some((card) => keep.has(card.id)) || entry.paired.some((card) => keep.has(card.id)));
}

/** The ids of every card of a group of entries. */
export function groupCards(group: readonly ZoneEntry[]): string[] {
  return group.flatMap((entry) => [entry.card.id, ...entry.paired.map((card) => card.id)]);
}
