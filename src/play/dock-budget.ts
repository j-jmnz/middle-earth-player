// The room for the words above the dock's pinned block (docs/design-system.md, Table, Command column; phase 22): the step, the
// title and the folded lines. On a short phone (under 400 pt tall) that room is small, and a long title with a long caution
// armed under it leaves it almost none, so the title is clamped to the lines that fit and the rest waits behind the "i" pill (the
// accessibility label keeps it whole). When the "i" opens the lines, they take the title's room. Pure arithmetic; the dock measures
// the room and draws what this says.
import { lineCount } from "./armed-room.ts";

// Line heights of the type the words use (tailwind.config.js): the eyebrow step, the title in body type, label type.
export const STEP_PX = 16;
export const TITLE_PX = 24;
export const LABEL_PX = 18;
// A line of the expanded list that is a refusal sits 4 pt under the line before it.
export const REFUSAL_GAP_PX = 4;
// The dock's own border and padding around its two blocks: 1 + 6 top and 4 + 1 bottom, or 1 + 2 and 2 + 1 on a dense dock.
export const DOCK_PAD_PX = 12;
export const DOCK_PAD_DENSE_PX = 6;
// Body type in the display face is about this many points a character.
export const TITLE_CHAR_PT = 9.5;
// A short phone's screen height under which the dock is dense (the choice tray's dense tiles use the same line).
export const DENSE_BELOW = 400;
// Two refusals and a guide and a note: the most the dock's lines hold in a real game.
export const EXPANDED_REALISTIC = { guide: 1, note: 1, refusals: 2 } as const;

/** The height of the words' window: the dock's room (the column less its padding) less its measured pinned block. */
export function wordsWindow(a: { room: number; block: number; dense?: boolean }): number {
  return Math.max(0, a.room - (a.dense ? DOCK_PAD_DENSE_PX : DOCK_PAD_PX) - a.block);
}

/** How many lines a title takes in `width` points, at most two (the title is never more than two lines unfolded). */
export function titleLinesOf(title: string, width: number): number {
  return Math.min(2, lineCount(title, Math.max(8, Math.floor(width / TITLE_CHAR_PT))));
}

/**
 * The folded dock's title lines: all of them when they fit with the step and the folded line, else as many as do, never fewer
 * than one (the step and one title line are always in view). Off a dense screen the title keeps its own two lines.
 */
export function foldedTitleLines(a: { space: number; dense: boolean; title: number; folded: number }): number {
  if (!a.dense) return a.title;
  const room = a.space - STEP_PX - a.folded * LABEL_PX;
  return Math.max(1, Math.min(a.title, Math.floor(room / TITLE_PX)));
}

/** The height the expanded lines take: each line's wrapped rows in label type, a refusal 4 pt under the line before it. */
export function expandedHeight(lines: readonly { rows: number; refusal: boolean }[]): number {
  return lines.reduce((sum, line, index) => sum + line.rows * LABEL_PX + (index > 0 && line.refusal ? REFUSAL_GAP_PX : 0), 0);
}

/** Whether the words scroll: their content is taller than the window. */
export function scrolls(a: { space: number; title: number; lines: number }): boolean {
  return STEP_PX + a.title * TITLE_PX + a.lines > a.space;
}
