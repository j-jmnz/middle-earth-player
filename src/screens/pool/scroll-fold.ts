// When the pool's filters fold away under the search (docs/design-system.md, Card pool (the Cards tab)): a scroll down past the filters'
// own height folds them, a scroll back up or a return to the top shows them again. Pure, so the hook in filter-fold.tsx only feeds it.
import { withAlphaHex } from "../../ui/tokens";

/** The fold and the offset the next turn is measured from: the lowest offset since the last fold, or the highest while folded. */
export type FoldScroll = { folded: boolean; anchor: number };

export const OPEN_FOLD: FoldScroll = { folded: false, anchor: 0 };

// How far the list must move one way, in points, before the filters follow it: a finger's wobble does not fold or show them.
export const FOLD_SLOP = 16;
// At or above this offset the filters always show.
const TOP = 2;

/** Open, measuring the next turn from offset `y`: after the list changes, or when a folded filter takes the keyboard's focus. */
export function openAt(y: number): FoldScroll {
  return { folded: false, anchor: Math.max(0, y) };
}

/**
 * The fold after the list reports offset `y`. `end` is the furthest offset the list can scroll to now, and `room` the filters' height:
 * they fold only once the list is past it. An offset past either end (iOS's bounce) counts as that end. At the foot the offset only moves
 * the anchor while folded: the fold makes the list taller, the list pulls its offset back to its new end, and that is not a scroll up.
 */
export function foldOnScroll(state: FoldScroll, offset: number, end: number, room: number): FoldScroll {
  const last = Math.max(0, end);
  const y = Math.min(Math.max(0, offset), last);
  if (y <= TOP) return state.folded || state.anchor !== y ? openAt(y) : state;
  if (!state.folded) {
    if (y - state.anchor > FOLD_SLOP && y > room) return { folded: true, anchor: y };
    return y < state.anchor ? { ...state, anchor: y } : state;
  }
  if (y >= last - 1) return y === state.anchor ? state : { ...state, anchor: y };
  if (state.anchor - y > FOLD_SLOP) return openAt(y);
  return y > state.anchor ? { ...state, anchor: y } : state;
}

// The shade's darkest, under the rows.
const SHADE_ALPHA = 0.94;
// The steps of its fall, from the rows' foot (0) to its end (1).
const FALL_STEPS = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1];

/**
 * The shade behind the filters as a CSS gradient: solid night down to `solid` (a share of its height), then easing to nothing on a
 * smoothstep, so neither end of the fall shows as a line.
 */
export function shadeOf(night: string, solid: number): string {
  const from = Math.min(1, Math.max(0, solid)) * 100;
  const stops = FALL_STEPS.map((t) => {
    const eased = t * t * (3 - 2 * t);
    return `${withAlphaHex(night, SHADE_ALPHA * (1 - eased))} ${(from + t * (100 - from)).toFixed(1)}%`;
  });
  return `linear-gradient(180deg, ${withAlphaHex(night, SHADE_ALPHA)} 0%, ${stops.join(", ")})`;
}
