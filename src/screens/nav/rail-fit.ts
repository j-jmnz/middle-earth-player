// The rail in a short window (docs/design-system.md, Tablets): the full rail's items are 72 pt tall with 36 pt above them and 24 below, so six of them need about
// 490 pt. A window shorter than `isShortWindow` (size-class.ts) is a desktop window dragged low (a phone never shows a root screen that short), and the rail
// there takes the height the window has so every tab and Settings are on screen; each item keeps at least 44 pt, a touch target.
import { MIN_TARGET } from "../../play/layout/slots.ts";

/** The room the compact rail keeps above and below its items, in points. */
export const COMPACT_PAD = 8;

/** The height of one rail item in a short window: the window shared by the items and the margins, never taller than the full rail's 72 pt (times the UI scale) nor under 44 pt. */
export function compactItemHeight(windowHeight: number, scale: number, items: number): number {
  const share = Math.floor((windowHeight - 2 * COMPACT_PAD) / Math.max(1, items));
  return Math.max(MIN_TARGET, Math.min(72 * scale, share));
}
