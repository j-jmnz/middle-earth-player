// The room for the words above the dock's pinned block (docs/design-system.md, Table, Command column; phase 22): the step, the
// title and the folded line. On a short phone (under DENSE_BELOW tall) that room is small, and a long title with a long caution
// armed under it leaves it almost none, so the title is clamped to the lines that fit and the rest of it, with every folded line,
// waits behind the "i" pill, which opens them in a popover (dock-more.tsx). Where the room cannot hold the step, one title line
// and one label line, the folded line is dropped and the pill sits on the title row: a control is never half visible. Pure
// arithmetic; the dock measures the room and draws what this says.
import { lineCount } from "./armed-room.ts";

// Line heights of the type the words use (tailwind.config.js): the eyebrow step, the title (Cinzel at the heading size on a
// 24 pt line), label type.
export const STEP_PX = 16;
export const TITLE_PX = 24;
export const LABEL_PX = 18;
// The dock's own border and padding around its two blocks: 1 + 6 top and 4 + 1 bottom, or 1 + 2 and 2 + 1 on a dense dock.
export const DOCK_PAD_PX = 12;
export const DOCK_PAD_DENSE_PX = 6;
// The title, Cinzel SemiBold at 15 pt with the heading size's 0.3 pt tracking, is at most 0.61 em × 15 + 0.3 = 9.45 pt a
// character; label type about LABEL_CHAR_PT.
export const TITLE_CHAR_PT = 9.5;
export const LABEL_CHAR_PT = 6.6;
// The "i" pill's width and its gap beside a line or a title.
export const PILL_PT = 30;
// A short phone's screen height under which the dock is dense; the choice tray's dense tiles use the same line.
export const DENSE_BELOW = 400;

/** The height of the words' window: the dock's room (the column less its padding) less its measured pinned block. */
export function wordsWindow(a: { room: number; block: number; dense?: boolean }): number {
  return Math.max(0, a.room - (a.dense ? DOCK_PAD_DENSE_PX : DOCK_PAD_PX) - a.block);
}

/** How many lines a title takes in `width` points, at most two (the title is never more than two lines unfolded). */
export function titleLinesOf(title: string, width: number): number {
  return Math.min(2, lineCount(title, Math.max(8, Math.floor(width / TITLE_CHAR_PT))));
}

/** The characters a label-type line holds in `width` points. */
export function labelChars(width: number): number {
  return Math.max(12, Math.floor(width / LABEL_CHAR_PT));
}

export type WordsPlan = {
  // The lines the title shows (numberOfLines); `cut` is true when it has more than that.
  titleLines: number;
  cut: boolean;
  // The folded line shows under the title; false when there is none or the room cannot hold it.
  showLine: boolean;
  // The "i" pill is needed: lines wait behind it, the title is cut, or the folded line was dropped.
  pill: boolean;
  // The pill sits on the title row (to the right of the title) rather than beside the folded line.
  pillOnTitle: boolean;
};

/**
 * What the dock draws in its words window. Off a dense screen the title keeps its own lines and the folded line shows. On a dense
 * one the title is clamped to the lines that fit under the step and the folded line, never fewer than one; with room for less
 * than the step, one title line and one label line, the folded line goes and the pill moves to the title row, where the title is
 * counted against the width the pill leaves. `foldable` is `DockLines.foldable` (lines wait behind the pill).
 */
export function planWords(a: { space: number; dense: boolean; title: string; textWidth: number; hasLine: boolean; foldable: boolean }): WordsPlan {
  if (!a.dense) {
    const natural = titleLinesOf(a.title, a.textWidth);
    return { titleLines: natural, cut: false, showLine: a.hasLine, pill: a.foldable, pillOnTitle: !a.hasLine && a.foldable };
  }
  const showLine = a.hasLine && a.space >= STEP_PX + TITLE_PX + LABEL_PX;
  const room = a.space - STEP_PX - (showLine ? LABEL_PX : 0);
  const fits = Math.max(1, Math.floor(room / TITLE_PX));
  const onTitle = !showLine;
  // The pill takes the title row's right end when it sits there; count against what it leaves.
  const count = (pillThere: boolean) => titleLinesOf(a.title, a.textWidth - (pillThere ? PILL_PT : 0));
  let natural = count(onTitle && (a.foldable || a.hasLine));
  if (onTitle && !(a.foldable || a.hasLine) && natural > fits) natural = count(true);
  const titleLines = Math.min(natural, fits);
  const cut = titleLines < natural;
  const pill = a.foldable || cut || (a.hasLine && !showLine);
  return { titleLines, cut, showLine, pill, pillOnTitle: pill && (onTitle || !a.hasLine) };
}

// The "i" popover (dock-lines-popover.tsx): its widest, its gap from the screen's edge and its Close row.
const POPOVER_MAX_WIDTH = 280;
const POPOVER_GAP = 6;
const POPOVER_EDGE = 8;
export const CLOSE_ROW = 48;

/** The popover's width and its room under `top`: as wide as the canvas beside the command column allows, down to the screen's foot. */
export function linesPlace(a: { screenWidth: number; screenHeight: number; commandWidth: number; insetLeft: number; insetRight: number; top: number }): { width: number; maxHeight: number } {
  const canvas = a.screenWidth - a.insetLeft - a.insetRight - a.commandWidth - POPOVER_GAP - POPOVER_EDGE;
  return { width: Math.max(180, Math.min(POPOVER_MAX_WIDTH, canvas)), maxHeight: Math.max(CLOSE_ROW + 40, a.screenHeight - a.top - POPOVER_EDGE) };
}

