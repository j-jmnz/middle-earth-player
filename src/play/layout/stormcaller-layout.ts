// Rules: dcce.stormcallers-area, dcce.stormcallers-area-stages (data/rules/entries.json). The Stormcaller's area in the staging row (docs/design-system-table.md, Cards, "The Stormcaller's area"): its current
// quest stage drawn sideways at a staging card's sideways footprint, and its cards over the stage's right part, stepped as a guarded pair (PAIR_STEP, and never less than a 44 pt target). The stage keeps the
// strip, the tokens and the pops in the part the cards leave uncovered, and it never folds: when the row is crowded the area's cards fold into the row's stack first (row-fold.ts) and the stage stays.
// Pure geometry, called by placeRow (layout.ts).
import type { ZoneEntry } from "../store/selectors.ts";
import type { CardSlot, Rect } from "./layout.ts";
import { cardRect, MIN_TARGET, PAIR_STEP, placeStaging, placeUnder, slotOf, type Metrics } from "./slots.ts";
import { keeps, stagingRank, type FoldGroup } from "./row-fold.ts";
import { touch } from "../../ui/ui-scale.ts";

type Size = { w: number; h: number };

/** The group that heads staging in the Stormcaller's scenario: the stage first, then the cards of its area. */
export const isAreaGroup = (group: readonly ZoneEntry[]): boolean => group[0]?.area === "stage";

// How far in from the stage's left edge its first card stands: a guarded pair's step of the stage's sideways footprint, and the stage leaves a 44 pt target uncovered where the cards are small.
function areaOffset(size: Size, m: Metrics): number {
  return Math.min(size.h, Math.max(Math.round(size.h * PAIR_STEP), touch(m.scale, MIN_TARGET)));
}

function areaStep(size: Size, m: Metrics): number {
  return Math.max(size.w * PAIR_STEP, touch(m.scale, MIN_TARGET));
}

/** The room the area takes in the row with `cards` cards over its stage (the stage alone when there are none), a gap included. */
export function areaWidth(cards: number, size: Size, m: Metrics): number {
  return cards <= 0 ? size.h : areaOffset(size, m) + size.w + (cards - 1) * areaStep(size, m) + m.gap;
}

// How far in from the group's left edge its last card stands.
function areaTail(cards: number, size: Size, m: Metrics): number {
  return cards <= 0 ? 0 : areaOffset(size, m) + (cards - 1) * areaStep(size, m);
}

/**
 * The area's group as a fold group (row-fold.ts): the stage is pinned, the cards the open moment does not ask about leave first (`shed`), and the last card's strip is counted against the target.
 * Null for any other group.
 */
export function areaGroupFold(group: readonly ZoneEntry[], width: number, size: Size, m: Metrics, keep: ReadonlySet<string> | undefined): FoldGroup | null {
  if (!isAreaGroup(group)) return null;
  const cards = group.slice(1);
  const staying = cards.filter((entry) => keeps([entry], keep));
  const leaving = cards.filter((entry) => !staying.includes(entry)).map((entry) => entry.card.id);
  return {
    id: group[0]?.card.id ?? "",
    width,
    cards: [group[0]?.card.id ?? "", ...cards.map((entry) => entry.card.id)],
    rank: stagingRank(group),
    pinned: true,
    tail: areaTail(cards.length, size, m),
    shed: { cards: leaving, keptWidth: areaWidth(staying.length, size, m), keptTail: areaTail(staying.length, size, m) },
  };
}

/**
 * Places the stage and the cards of `group` that stand (the stage first). The cards keep a target step; a row that cannot give it (the moment keeps cards no fold can take) steps them closer, never so far
 * that the last one is covered past a target by the next group (`nextX`) or runs past the row's end (`rowEnd`).
 */
export function placeArea(group: readonly ZoneEntry[], left: number, y: number, size: Size, out: CardSlot[], m: Metrics, stacks: boolean, nextX: number | null, rowEnd: number, target: number): void {
  const [head, ...cards] = group;
  if (!head) return;
  const offset = areaOffset(size, m);
  const lastAt = nextX != null ? nextX - target : rowEnd - size.w;
  const step = cards.length > 1 ? Math.min(areaStep(size, m), Math.max(0, (lastAt - left - offset) / (cards.length - 1))) : areaStep(size, m);
  const rect: Rect = { x: left, y: y + Math.round((size.h - size.w) / 2), w: size.h, h: size.w };
  out.push({ ...slotOf(head.card, "staging", "card", rect, true), stormcaller: "stage", ...(cards.length > 0 ? { shown: offset } : {}) });
  cards.forEach((entry, at) => {
    const card = cardRect(entry.card, left + offset + at * step, y, size);
    if (stacks) placeStaging(entry, card, out, m);
    else placeUnder(entry, "staging", card, out, [], m.peek);
    out.push({ ...slotOf(entry.card, "staging", "card", card), ...(entry.area ? { stormcaller: entry.area } : {}) });
  });
}
