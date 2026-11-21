// The math of the two-column screens (docs/design-system.md, Tablets): Campaigns and Scenarios split their scroll in two only
// when the main column keeps room to read. An expanded window can be barely wider than 840 (the rail takes 88), so the size class alone
// is not enough: the measured width decides. Pure, so a test reads it in Node; the hook is use-split-columns.ts.
import { paneWidths, type SizeClass } from "../../ui/size-class";

/** The narrowest a main column may get, in logical points; under it the screen keeps its one readable column. */
export const MIN_MAIN = 400;

/** A fixed side pane and the main column beside it, or null while the width is unmeasured or the main column would be under 400·s. */
export function sideSplit(width: number, s: number, range: { min: number; max: number }): { side: number; main: number; gap: number } | null {
  if (width <= 0) return null;
  const panes = paneWidths("supporting", width, s, range);
  return panes.main >= MIN_MAIN * s ? panes : null;
}

/** The first-frame width of a list: nothing in compact (a phone is exactly as before), else the window less the page inset on each side. */
export function seedWidth(size: SizeClass, windowWidth: number, s: number, pageInset: number): number {
  return size === "compact" ? 0 : Math.max(0, windowWidth - 2 * pageInset * s);
}
