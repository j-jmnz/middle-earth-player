// How wide the Card screen draws the card's picture (docs/design-system.md, Card; Tablets). Pure, so a test reads it in Node.
// Compact is the phone's: 236 wide at most (Carved Stone's card screen), 96 in from the window. Medium raises the cap to 360 in its reading column. Expanded draws
// the picture in its own pane, sized by the pane's height (`inspectSize`); a quest card, printed sideways, is as wide as that
// height, so it fills the pane's width the way a portrait card fills its height. Sizes are in screen points; the cap is Medium's
// number times the scale `s`.
import { inspectSize } from "../play/preview-size";
import type { SizeClass } from "../play/size-class";

export type PicturePane = { width: number; height: number };

/** The widest the picture may be, for the window's size class; null in an expanded window whose picture pane is not measured yet. */
export function pictureMaxWidth(size: SizeClass, windowWidth: number, s: number, pane: PicturePane | null, landscapeCard: boolean): number | null {
  if (size !== "expanded") return Math.max(0, Math.min(windowWidth - 96 * s, (size === "medium" ? 360 : 236) * s));
  if (!pane || pane.width <= 0 || pane.height <= 0) return null;
  const fit = inspectSize(pane.width, pane.height, s);
  return landscapeCard ? Math.min(Math.max(0, pane.width - 32 * s), fit.height) : fit.width;
}
