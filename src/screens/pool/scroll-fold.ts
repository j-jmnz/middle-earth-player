// When the pool's filters fold away under the search (docs/design-system.md, Card pool (the Cards tab)): a scroll down past the filters'
// own height folds them, a scroll back up or a return to the top shows them again. Pure, so the hook in scroll-fold.tsx only feeds it.

/** The fold and the offset the next turn is measured from: the lowest offset since the last fold, or the highest while folded. */
export type FoldScroll = { folded: boolean; anchor: number; quietUntil: number };

export const OPEN_FOLD: FoldScroll = { folded: false, anchor: 0, quietUntil: 0 };

// How far the list must move one way, in points, before the filters follow it: a finger's wobble does not fold or show them.
export const FOLD_SLOP = 16;
// After a fold or an unfold the list's height changes, and near the foot the list moves its offset to stay in range. Offsets in this
// time, in ms, only move the anchor, so that move does not undo the fold.
export const FOLD_QUIET = 320;
// At or above this offset the filters always show.
const TOP = 2;

/** The fold after the list reports offset `y` at time `now`. `room` is the filters' height: they fold only once the list is past it. */
export function foldOnScroll(state: FoldScroll, y: number, now: number, room: number): FoldScroll {
  if (y <= TOP) return state.folded ? { folded: false, anchor: Math.max(0, y), quietUntil: now + FOLD_QUIET } : { ...state, anchor: Math.max(0, y) };
  if (now < state.quietUntil) return { ...state, anchor: y };
  if (!state.folded) {
    if (y - state.anchor > FOLD_SLOP && y > room) return { folded: true, anchor: y, quietUntil: now + FOLD_QUIET };
    return y < state.anchor ? { ...state, anchor: y } : state;
  }
  if (state.anchor - y > FOLD_SLOP) return { folded: false, anchor: y, quietUntil: now + FOLD_QUIET };
  return y > state.anchor ? { ...state, anchor: y } : state;
}
