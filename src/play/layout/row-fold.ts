// Rules: dcce.ship-enemies, dcce.boarding (data/rules/entries.json). The table's crowding budget for the two rows that can run out of room, staging and the
// engagement area (docs/design-system-table.md, Spacing and the play area's rows, "Squeeze, then fold"), as dock/budget.ts is the dock's. Pure, and the
// same for every scenario:
//
// 1. Natural: groups stand a gap apart.
// 2. Squeeze: groups overlap evenly while every step between neighbours is at least a 44 pt target. That is exactly what `rowXs` does today.
// 3. Fold: when even 44 pt steps do not fit, groups leave the row one at a time, in fold order, into a fold stack at the row's left end, until the rest
//    fits at 44 pt steps beside it. A group the open moment asks about, a pick, or the banner's beat names never folds.
//
// A row whose steps stay at 44 pt or more is laid out as `rowXs` lays it out, which a test pins for the Fellowship and Mirkwood tables.
import { rowXs } from "./slots.ts";
import type { ZoneEntry } from "../store/selectors.ts";

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
  // How far in from the group's left edge its last card stands: the next group covers the last card from its own left edge on, so the strip the last card shows is the step less this (0 for a group whose
  // last card stands at its left edge). The Stormcaller's area has its cards over its stage's right part.
  tail?: number;
  // The cards that leave this group before any group folds, the group's lead staying (the Stormcaller's area: its stage never folds, its cards do, docs/design-system-table.md, "The Stormcaller's area").
  // `keptWidth` and `keptTail` are the group's width and tail once they have left. A pinned group sheds too: `cards` lists only the cards the moment does not ask about.
  shed?: { cards: readonly string[]; keptWidth: number; keptTail: number };
};

export type FoldStack = {
  // The row's left end; its width is the stack's.
  x: number;
  w: number;
  // The folded groups, left to right, and every card in them (the cards shed from a group stand where that group stands).
  groups: readonly number[];
  cards: readonly string[];
  // The card whose face the stack shows: the first folded group's lead, or the first shed card when only shed cards are in it.
  top: string;
};

export type FoldPlan = {
  // The left edge of each group, or null for a folded one.
  xs: readonly (number | null)[];
  // The groups that shed their cards (FoldGroup.shed), by index: they stand at `keptWidth`.
  shed: readonly number[];
  stack: FoldStack | null;
  // The least step between two shown neighbours (Infinity with fewer than two shown).
  step: number;
  // Every step is at least the target: false only when nothing more may fold.
  fits: boolean;
};

// The smallest step between neighbours when `widths` stand across `width`, squeezed evenly (`rowXs`) when they do not fit a gap apart. Infinity while
// nothing overlaps: groups a gap apart need no target, however narrow. `tails` (per group, default 0) take the offset of a group's last card from the step: the strip that card shows.
export function leastStep(widths: readonly number[], width: number, gap: number, tails?: readonly number[]): number {
  if (widths.length <= 1) return Infinity;
  const natural = widths.reduce((sum, w) => sum + w, 0) + gap * (widths.length - 1);
  if (natural <= width) return Infinity;
  const squeeze = (natural - width) / (widths.length - 1);
  return Math.min(...widths.slice(0, -1).map((w, at) => w - (tails?.[at] ?? 0) + gap - squeeze));
}

/**
 * The row's groups across `[x, x + width]`: squeezed while every step stays at `target`, else folded. `stackW` is the fold stack's width; it and one gap
 * are taken from the row once anything has folded or been shed.
 */
export function foldRow(groups: readonly FoldGroup[], row: { x: number; width: number; gap: number; target: number; stackW: number }): FoldPlan {
  const folded: number[] = [];
  const shedAt: number[] = [];
  const shown = () => groups.map((_, at) => at).filter((at) => !folded.includes(at));
  const widthOf = (at: number) => (shedAt.includes(at) ? (groups[at]?.shed?.keptWidth ?? 0) : (groups[at]?.width ?? 0));
  const tailOf = (at: number) => (shedAt.includes(at) ? (groups[at]?.shed?.keptTail ?? 0) : (groups[at]?.tail ?? 0));
  for (;;) {
    const kept = shown();
    const taken = folded.length + shedAt.length > 0 ? row.stackW + row.gap : 0;
    const step = leastStep(kept.map(widthOf), row.width - taken, row.gap, kept.map(tailOf));
    // What may leave next: a whole group (not pinned), or the cards a group sheds (once), lowest rank first, then leftmost.
    const options = [
      ...kept.filter((at) => groups[at]?.pinned !== true).map((at) => ({ at, whole: true })),
      ...kept.filter((at) => !shedAt.includes(at) && (groups[at]?.shed?.cards.length ?? 0) > 0).map((at) => ({ at, whole: false })),
    ].sort((left, right) => (groups[left.at]?.rank ?? 0) - (groups[right.at]?.rank ?? 0) || left.at - right.at || Number(left.whole) - Number(right.whole));
    const next = options[0];
    // A lone group that sheds cards sheds them when it is wider than the row; any other lone group stays and overflows.
    const lone = kept.length === 1 ? kept[0] : undefined;
    const tooWide = lone != null && !shedAt.includes(lone) && (groups[lone]?.shed?.cards.length ?? 0) > 0 && widthOf(lone) > row.width - taken;
    if (next == null || (!tooWide && (step >= row.target || (kept.length <= 1 && next.whole)))) {
      const xs: (number | null)[] = groups.map(() => null);
      const placed = rowXs(kept.map(widthOf), row.x + taken, row.width - taken, row.gap);
      kept.forEach((at, index) => {
        xs[at] = placed[index] ?? row.x + taken;
      });
      const order = [...folded, ...shedAt].sort((left, right) => left - right);
      const first = order[0];
      const cardsOf = (at: number) => (folded.includes(at) ? (groups[at]?.cards ?? []) : (groups[at]?.shed?.cards ?? []));
      const topFolded = [...folded].sort((left, right) => left - right)[0];
      const stack: FoldStack | null =
        first == null
          ? null
          : { x: row.x, w: row.stackW, groups: [...folded].sort((left, right) => left - right), cards: order.flatMap(cardsOf), top: topFolded != null ? (groups[topFolded]?.id ?? "") : (groups[first]?.shed?.cards[0] ?? "") };
      return { xs, shed: [...shedAt].sort((left, right) => left - right), stack, step, fits: step >= row.target };
    }
    if (next.whole) folded.push(next.at);
    else shedAt.push(next.at);
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

// The fold order of a staging group, lowest first (docs/design-system-table.md): the Stormcaller's area while it is not at the players' stage (0), then cards the players control (`claimed`, the engine's marker for an objective a player took; a freed tower is one), then guarded
// pairs, then locations, then enemies, then any other card; a location with enemies grappled under it folds last of all (the count and the Threat they add are on it, and a fold list reads them, dcce.grapple). A revealed card has a `controller` (the seat that revealed it), so that says nothing here.
export const STAGING_RANK = { area: 0, controlled: 1, guarded: 2, location: 3, enemy: 4, other: 5, grappled: 6 } as const;

/** The fold rank of a staging group, from its lead entry and how many cards it holds. */
export function stagingRank(group: readonly ZoneEntry[]): number {
  const lead = group[0];
  if (!lead) return STAGING_RANK.other;
  // The area's group folds first while its cards are out of the staging area; at the players' stage they are staging cards and fold as a guarded pair does.
  if (lead.area === "stage") return group.some((entry) => entry.area === "together") ? STAGING_RANK.guarded : STAGING_RANK.area;
  if (lead.card.claimed === true) return STAGING_RANK.controlled;
  if (group.length > 1) return STAGING_RANK.guarded;
  if (lead.kind === "location") return lead.attached.some((card) => card.zone === "grappled") ? STAGING_RANK.grappled : STAGING_RANK.location;
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
