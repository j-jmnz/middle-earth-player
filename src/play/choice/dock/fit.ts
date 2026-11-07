// What the dock needs in its column at the phone's text size (docs/design-system-table.md, Command column; docs/design-system.md, Type):
// the column it stands in, built from the real top bar and foot, and the pinned block counted from what the components draw, so a short
// phone at a large text size folds the reading aids behind More before a control would be cut. Pure arithmetic in screen points at a UI
// scale `s` and a font scale `text`: a text's line is its Medium line times both; a control keeps its touch floor (`touch`, ui-scale.ts)
// and grows with its words. At a font scale of 1 `foldAids` is never true, so every layout there is the one the components draw alone.
import type { Readout } from "../../readouts/readout.ts";
import { barTopOf, TOP_BAR } from "../../chrome/top-bar-layout.ts";
import { touch } from "../../../ui/ui-scale.ts";
import { armedRoom, dockArmedLines, lineCount } from "./armed-room.ts";
import { DOCK_PAD_DENSE_PX, DOCK_PAD_PX, isDense, LABEL_CHAR_PT, LABEL_PX, labelChars, planWords, smallPictures, TITLE_PX, trayRoom, wordsWindow, type WordsPlan } from "./budget.ts";
import type { Dock } from "../table-choice.ts";

// The foot under the command column (table/view.tsx): 8 pt at Medium, or the bottom inset when that is more.
export const FOOT_PX = 8;

/** The room under the dock's column: the foot's padding at the UI scale `s` and the bottom inset. */
export function footPadOf(insetBottom: number, s: number): number {
  return Math.max(insetBottom, FOOT_PX * s);
}

/**
 * The height of the room the dock stands in: the screen less the top bar (under the top inset, never at the screen's very edge) and the
 * foot, the column of table/view.tsx. The dock's own padding is counted by the dock.
 */
export function dockColumn(height: number, s: number, insets: { top: number; bottom: number }): number {
  return height - barTopOf(insets.top, s) - TOP_BAR * s - footPadOf(insets.bottom, s);
}

/** The width of the dock's words in a command column `commandWidth` wide: the column's and the dock's side padding (8 and 12 pt at Medium) less. */
export function dockTextWidth(commandWidth: number, s: number): number {
  return commandWidth - 42 * s;
}

// What the dock draws, as its components size it (ui/buttons.tsx, dock/table-dock.tsx). Logical points; label type's characters are
// LABEL_CHAR_PT. The primary's and the answers' words are Marcellus SC (0.62 em, tracked): 17 pt tracked 1.2 and 15 pt tracked 1.
const PRIMARY_CHAR_PT = 11.8;
const PRIMARY_PAD = 35;
const PRIMARY_LINE = 21;
const ANSWER_CHAR_PT = 10.3;
const ANSWER_PAD = 36;
const ANSWER_LINE = 19;
const TEXT_BUTTON_PAD = 21;
const NUMBERS_ROW = 24;
const NUMBERS_GAP = 6;
// gap-0.5, gap-1 and gap-2 at the phone's rem (14 pt): the dock's rows and the answers' wrap gap.
const GAP_HALF = 1.75;
const GAP_ONE = 3.5;
const GAP_TWO = 7;

/** What the pinned block holds: the moment's dock, its readout and refusal, and the labels of the quiet row. */
export type DockContent = { dock: Dock; readout: Readout | null; refusal: string | null; aids: readonly string[]; hasExtras: boolean };

type Item = { w: number; h: number };

// The height of items laid out in a wrapping row of width `cap` with `gap` between them (flex-row flex-wrap).
function wrapped(items: readonly Item[], cap: number, gap: number): number {
  let total = 0;
  let rowH = 0;
  let used = 0;
  for (const item of items) {
    const w = Math.min(item.w, cap);
    if (used > 0 && used + gap + w > cap) {
      total += rowH + gap;
      rowH = 0;
      used = 0;
    }
    used += (used > 0 ? gap : 0) + w;
    rowH = Math.max(rowH, item.h);
  }
  return total + rowH;
}

// A Marcellus capsule's width and height for a `label` in `cap` logical points: it wraps when its words are wider than the row.
function capsule(label: string, a: { cap: number; text: number; s: number; charPt: number; pad: number; line: number; floorH: number; minW: number }): Item {
  const natural = Math.max(a.minW, label.length * a.charPt * a.text + a.pad);
  const lines = natural <= a.cap ? 1 : lineCount(label, Math.max(4, Math.floor((a.cap - a.pad) / (a.charPt * a.text))));
  return { w: natural * a.s, h: Math.max(a.floorH, lines * a.line * a.text * a.s) };
}

/**
 * The height of the dock's pinned block at the UI scale `s` and the font scale `text`, in screen points, for the moment in `content`: the
 * numbers row, the readout's result and the refusal at the lines their words take (a dense dock keeps the result at one line while the rows
 * are open, and the refusal at three: fixed slots, the cut text whole behind the "i"), the armed room, the primary at the lines its label
 * takes in `width`, the answers wrapped in a row (More joins them when `folded`, and wraps to a row of its own when they fill it) and, when
 * not `folded`, the quiet row.
 */
export function pinnedBlock(a: { content: DockContent; dense: boolean; s: number; text: number; width: number; trayOpen: boolean; folded: boolean }): number {
  const { content, dense, s, text } = a;
  const { dock, readout, refusal } = content;
  const chars = labelChars(a.width, s, text);
  const cap = a.width / s;
  const label = LABEL_PX * text * s;
  const resultLines = readout?.result ? (dense && a.trayOpen ? 1 : lineCount(readout.result, chars)) : 0;
  const numbers = (readout?.stats.length ?? 0) > 0 ? (NUMBERS_ROW * text + NUMBERS_GAP) * s : 0;
  const result = resultLines > 0 ? resultLines * label + (dense ? 0 : GAP_HALF * s) : 0;
  const readoutRow = numbers + result;
  const refusalRow = refusal ? (dense ? Math.min(3, lineCount(refusal, chars)) : lineCount(refusal, chars)) * label : 0;
  const primaryLines = dock.primary ? lineCount(dock.primary.label, Math.max(4, Math.floor((cap - PRIMARY_PAD) / (PRIMARY_CHAR_PT * text)))) : 0;
  const primary = dock.primary ? Math.max(touch(s, dense ? 44 : 46), primaryLines * PRIMARY_LINE * text * s) : 0;
  const answerRow = dense ? 40 * s : touch(s, 44);
  const answerFace = dense ? 36 * s : touch(s, 44);
  const answerItem = (word: string) => capsule(word, { cap, text, s, charPt: ANSWER_CHAR_PT, pad: ANSWER_PAD, line: ANSWER_LINE, floorH: Math.max(answerRow, answerFace), minW: 44 });
  const textItem = (word: string) => capsule(word, { cap, text, s, charPt: LABEL_CHAR_PT, pad: TEXT_BUTTON_PAD, line: LABEL_PX, floorH: answerRow, minW: 44 });
  const inline = a.folded && content.hasExtras;
  const answers = [...dock.secondary.map((button) => answerItem(button.label)), ...(inline ? [textItem("More")] : [])];
  const answersRow = answers.length > 0 ? (dense ? 4 : 6) * s + wrapped(answers, a.width, GAP_TWO * s) : 0;
  const aidItems = a.folded ? [] : content.aids.map(textItem);
  const aidsRow = aidItems.length > 0 ? (dense ? 2 : 4) * s + wrapped(aidItems, a.width, GAP_ONE * s) : 0;
  const rows = [armedRoom(dockArmedLines(dock, dense, chars), dense, s, text), primary, answersRow, aidsRow];
  const buttons = rows.reduce((sum, h) => sum + h, 0) + (dense ? 0 : GAP_HALF * s) * Math.max(0, rows.filter((h) => h > 0).length - 1);
  const children = (readoutRow > 0 ? 1 : 0) + (refusalRow > 0 ? 1 : 0);
  const gap = (dense ? GAP_HALF : GAP_ONE) * s * children;
  return (a.trayOpen ? (dense ? 2 : 4) * s : 0) + readoutRow + refusalRow + buttons + gap;
}

export type DockFit = { column: number; used: number; plan: WordsPlan };

/**
 * The column and what the dock uses in it, with the choice's one row open or not: the title at the lines the words' window leaves it, the
 * dock's padding, one row and the pinned block. `used` over `column` is a control or a title line cut.
 */
export function dockFit(a: { height: number; s: number; text: number; insets: { top: number; bottom: number }; width: number; content: DockContent; trayOpen: boolean; folded: boolean; title: string }): DockFit {
  const { height, s, text } = a;
  const dense = isDense(height, s);
  const column = dockColumn(height, s, a.insets);
  const block = pinnedBlock({ content: a.content, dense, s, text, width: a.width, trayOpen: a.trayOpen, folded: a.folded });
  const row = a.trayOpen ? trayRoom(smallPictures(height, s), text) * s : 0;
  const space = wordsWindow({ room: column, block: block + row, dense }, s);
  const plan = planWords({ space, dense, clamp: a.trayOpen, title: a.title, textWidth: a.width, hasLine: false, foldable: true, text }, s);
  const pad = (dense ? DOCK_PAD_DENSE_PX : DOCK_PAD_PX) * s;
  return { column, used: Math.max(plan.titleLines, 1) * TITLE_PX * text * s + pad + row + block, plan };
}

/**
 * Whether the reading aids go behind the More pill: only above the phone's default text size (`text` over 1), when one title line, the
 * dock's padding, the choice's one row (when `trayOpen`) and the pinned block with the quiet row do not fit the column, and folding takes
 * room back (More wraps to a row of its own when the answers fill theirs, which can cost as much as the quiet row). At a font scale of 1 it
 * is never true, so every layout there is unchanged. Folded, More sits on the answers' row and the quiet row is not drawn.
 */
export function aidsFoldHelps(a: { height: number; s: number; text: number; insets: { top: number; bottom: number }; width: number; content: DockContent; trayOpen: boolean }): boolean {
  if (a.text <= 1) return false;
  const dense = isDense(a.height, a.s);
  const row = a.trayOpen ? trayRoom(smallPictures(a.height, a.s), a.text) * a.s : 0;
  const pad = (dense ? DOCK_PAD_DENSE_PX : DOCK_PAD_PX) * a.s;
  const block = (folded: boolean) => pinnedBlock({ content: a.content, dense, s: a.s, text: a.text, width: a.width, trayOpen: a.trayOpen, folded });
  const open = block(false);
  return TITLE_PX * a.text * a.s + pad + row + open > dockColumn(a.height, a.s, a.insets) && block(true) < open;
}
