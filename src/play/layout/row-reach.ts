// A crowded top row that reaches under the command column (docs/design-system-table.md, Spacing and the play area's rows, "Under the
// command column"). The column lies over the canvas's right edge, and its top is empty above the dock and the head; a row wholly above
// that part (column-reach.ts) may run on past the canvas's right edge into it. Pure geometry, beside row-fold.ts.
//
// The row keeps its own span, then skips the piles at its right end (the second slot's piles in the engagement area), which stay where
// they are, and goes on into the column's room. Staging has no hole: its piles (the encounter deck, its discard pile and the victory
// display) move to the screen's edge, so the row's cards stay left of them (layout.ts). It takes the
// extra room only when its own span would squeeze below a gap between neighbours or fold: an uncrowded row is laid out exactly as
// `foldRow` lays it out.
import { foldRow, type FoldGroup, type FoldPlan } from "./row-fold.ts";

/** The room a row has past its own span: `hole`, the piles it skips at its right end (0 when none stand there, or when they move aside), then `extra` more. */
export type RowReach = { hole: number; extra: number };

/** A row's plan, and whether it took the room past its own span. */
export type ReachPlan = FoldPlan & { reached?: true };

type Row = Parameters<typeof foldRow>[1];

// The width a group stands at in a plan: the width it keeps once it has shed its cards.
function widthIn(plan: FoldPlan, groups: readonly FoldGroup[], at: number): number {
  const group = groups[at];
  return plan.shed.includes(at) ? (group?.shed?.keptWidth ?? 0) : (group?.width ?? 0);
}

// The plan's groups carried past the hole: the first group that would cross the row's own end starts past the hole, and every group after
// it moves right as far, so no card lies over a pile and every step stays at least what the plan gave it.
function across(plan: FoldPlan, groups: readonly FoldGroup[], end: number, hole: number): readonly (number | null)[] {
  if (hole <= 0) return plan.xs;
  let shift: number | null = null;
  return plan.xs.map((x, at) => {
    if (x == null) return null;
    if (shift == null && x + widthIn(plan, groups, at) > end) shift = end + hole - Math.min(x, end);
    return x + (shift ?? 0);
  });
}

const foldedCount = (plan: FoldPlan): number => plan.stack?.cards.length ?? 0;

/**
 * The row's groups across `row`, reaching on into `reach` when its own span is crowded (it squeezes or folds) and the reach folds fewer
 * cards or leaves wider steps. With no reach, or an uncrowded row, it is `foldRow`'s plan.
 */
export function reachRow(groups: readonly FoldGroup[], row: Row, reach: RowReach | null): ReachPlan {
  const base = foldRow(groups, row);
  if (!reach || reach.extra <= 0 || (base.stack == null && base.step === Infinity)) return base;
  const end = row.x + row.width;
  const last = end + reach.hole + reach.extra;
  // Laid out across the row's span and the extra room as one, then carried past the hole. A group carried past it pushes the row's right
  // end out by up to its own width, so the span is narrowed by that overflow and a gap and laid out again (a few rounds settle it).
  let narrow = 0;
  for (let round = 0; round < 8; round += 1) {
    const plan = foldRow(groups, { ...row, width: row.width + reach.extra - narrow });
    const xs = across(plan, groups, end, reach.hole);
    const right = Math.max(...xs.map((x, at) => (x == null ? -Infinity : x + widthIn(plan, groups, at))));
    const over = right - last;
    if (over <= 0.5) {
      const better = foldedCount(plan) < foldedCount(base) || (foldedCount(plan) === foldedCount(base) && plan.step > base.step);
      return better ? { ...plan, xs, reached: true } : base;
    }
    narrow += over + row.gap;
  }
  return base;
}
