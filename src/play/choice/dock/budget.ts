// The room for the words above the dock's pinned block (docs/design-system-table.md, Command column; phase 22): the title and the
// folded line. On a short phone (under DENSE_BELOW tall) that room is small, and a long title with a long caution armed under it
// leaves it almost none, so the title is clamped to the lines that fit and the rest of it, with every folded line, waits behind the
// "i" button, which opens them in a popover (dock/more.tsx). Where the room cannot hold one title line and one label line, the
// folded line is dropped and the button sits on the title row: a control is never half visible. Pure
// arithmetic; the dock measures the room and draws what this says. At a UI `scale` (ui-scale.ts) a measured length comes in as
// screen points and goes out as screen points; the arithmetic is the Medium one, in logical points (the screen over the scale). The phone's
// own text size (`text`, the font scale, 1 when it is not set) grows the words only, not the dock's padding: React Native text follows it
// (docs/design-system.md, Type), so a title's characters and the line heights are counted `text` times wider and taller.
import { lineCount } from "./armed-room.ts";

// Line heights of the type the words use (tailwind.config.js): the title (Marcellus SC at the heading size on its 22 pt line), label type.
export const TITLE_PX = 22;
export const LABEL_PX = 18;
// The dock's padding around its two blocks (it draws no border): 10 above the words, 8 under them and 8 under the buttons, or
// 4, 2 and 4 on a dense dock (table-dock.tsx).
export const DOCK_PAD_PX = 26;
export const DOCK_PAD_DENSE_PX = 10;
// The title, Marcellus SC at the heading size's 17 pt, is at most about 0.62 em × 17 = 10.5 pt a character; label type about
// LABEL_CHAR_PT.
export const TITLE_CHAR_PT = 10.6;
export const LABEL_CHAR_PT = 6.6;
// The "i" button's width (26 pt) and its gap beside a line or a title.
export const PILL_PT = 32;
// A short phone's screen height under which the dock is dense; the choice tray's dense tiles use the same line.
export const DENSE_BELOW = 400;
// A card's picture in a card list and in the choice's rows (docs/design-system-table.md, Choice tray, Reading panels): the table's card on a
// tablet, smaller on a phone, where a list would otherwise hold about three rows and the choice's one row would crowd the dock.
export const LIST_PICTURE = { w: 51, h: 71 };
export const LIST_PICTURE_SMALL = { w: 34, h: 47 };
// The least room one row of the choice takes, its picture with the row's padding and gap (choice/tray.tsx, sheet-paper.tsx Tile: up to 3.5 pt
// above and below and a 5.25 pt gap at the phone's rem): the words are budgeted against it while the rows are open, and the rows always keep it.
// The small picture is sized so that one row with a detail line, the longest caution armed and one title line fit the dock at 667 x 375.
export const TRAY_ROW_PX = 84;
export const TRAY_ROW_SMALL_PX = 59;

/** Whether a screen `height` tall is a short phone's: the logical height, at the UI scale, is under DENSE_BELOW. */
export function isDense(height: number, scale = 1): boolean {
  return height / scale < DENSE_BELOW;
}

/** Whether a card list and the choice's rows draw the small picture: a phone, by its real height or its logical height at the UI scale. */
export function smallPictures(height: number, scale = 1): boolean {
  return height < DENSE_BELOW || isDense(height, scale);
}

// The least a row is without its picture: one line of body type (tailwind.config.js, text-body) and the row's padding.
export const TRAY_LABEL_LINE_PX = 20;
export const TRAY_ROW_PAD_PX = 8;

/**
 * The least room the choice's rows keep (Medium's points, times the scale where it is used): one row of the picture size in use, or one
 * line of the row's name at the phone's text size (`text`, the font scale) when that is taller. A longer row is as tall as its words and
 * the rows scroll (tray.tsx).
 */
export function trayRoom(small: boolean, text = 1): number {
  return Math.max(small ? TRAY_ROW_SMALL_PX : TRAY_ROW_PX, TRAY_LABEL_LINE_PX * text + TRAY_ROW_PAD_PX);
}

/** The height of the words' window: the dock's room (the column less its padding) less its measured pinned block. */
export function wordsWindow(a: { room: number; block: number; dense?: boolean }, scale = 1): number {
  return Math.max(0, (a.room - a.block) / scale - (a.dense ? DOCK_PAD_DENSE_PX : DOCK_PAD_PX)) * scale;
}

/** How many lines a title takes in `width` points, at most two (the title is never more than two lines unfolded). */
export function titleLinesOf(title: string, width: number, scale = 1, text = 1): number {
  return Math.min(2, lineCount(title, Math.max(8, Math.floor(width / scale / (TITLE_CHAR_PT * text)))));
}

/** The characters a label-type line holds in `width` points. */
export function labelChars(width: number, scale = 1, text = 1): number {
  return Math.max(12, Math.floor(width / scale / (LABEL_CHAR_PT * text)));
}

export type WordsPlan = {
  // The lines the title shows (numberOfLines); `cut` is true when it has more than that.
  titleLines: number;
  cut: boolean;
  // The folded line shows under the title; false when there is none or the room cannot hold it.
  showLine: boolean;
  // The "i" button is needed: lines wait behind it, the title is cut, or the folded line was dropped.
  pill: boolean;
  // The button sits on the title row (to the right of the title) rather than beside the folded line.
  pillOnTitle: boolean;
};

/**
 * What the dock draws in its words window. Off a dense screen the title keeps its own lines and the folded line shows. On a dense
 * one the title is clamped to the lines that fit above the folded line, never fewer than one; with room for less than one title
 * line and one label line, the folded line goes and the button moves to the title row, where the title is counted against the
 * width the button leaves. `foldable` is `DockLines.foldable` (lines wait behind the pill). `clamp` is the choice's rows being open:
 * the words are budgeted by their room on a taller screen too, because the rows keep their own minimum and the words cannot shrink.
 */
export function planWords(a: { space: number; dense: boolean; clamp?: boolean; title: string; textWidth: number; hasLine: boolean; foldable: boolean; text?: number }, scale = 1): WordsPlan {
  // The room and the width come in as screen points; the budget is counted in logical ones.
  const space = a.space / scale;
  const textWidth = a.textWidth / scale;
  const text = a.text ?? 1;
  const titlePx = TITLE_PX * text;
  const labelPx = LABEL_PX * text;
  if (!a.dense && !a.clamp) {
    const natural = titleLinesOf(a.title, textWidth, 1, text);
    return { titleLines: natural, cut: false, showLine: a.hasLine, pill: a.foldable, pillOnTitle: !a.hasLine && a.foldable };
  }
  const showLine = a.hasLine && space >= titlePx + labelPx;
  const room = space - (showLine ? labelPx : 0);
  const fits = Math.max(1, Math.floor(room / titlePx));
  const onTitle = !showLine;
  // The button takes the title row's right end when it sits there; count against what it leaves.
  const count = (pillThere: boolean) => titleLinesOf(a.title, textWidth - (pillThere ? PILL_PT : 0), 1, text);
  let natural = count(onTitle && (a.foldable || a.hasLine));
  if (onTitle && !(a.foldable || a.hasLine) && natural > fits) natural = count(true);
  const titleLines = Math.min(natural, fits);
  const cut = titleLines < natural;
  const pill = a.foldable || cut || (a.hasLine && !showLine);
  return { titleLines, cut, showLine, pill, pillOnTitle: pill && (onTitle || !a.hasLine) };
}

// The "i" popover (dock/lines-popover.tsx): its widest, its gap from the screen's edge and the least room it keeps.
const POPOVER_MAX_WIDTH = 280;
const POPOVER_GAP = 6;
const POPOVER_EDGE = 8;
const POPOVER_MIN_ROOM = 88;

/** The popover's width and its room under `top`: as wide as the canvas beside the command column allows, down to the screen's foot. */
export function linesPlace(a: { screenWidth: number; screenHeight: number; commandWidth: number; insetLeft: number; insetRight: number; top: number }, scale = 1): { width: number; maxHeight: number } {
  const canvas = (a.screenWidth - a.insetLeft - a.insetRight - a.commandWidth) / scale - POPOVER_GAP - POPOVER_EDGE;
  return { width: Math.max(180, Math.min(POPOVER_MAX_WIDTH, canvas)) * scale, maxHeight: Math.max(POPOVER_MIN_ROOM, (a.screenHeight - a.top) / scale - POPOVER_EDGE) * scale };
}
