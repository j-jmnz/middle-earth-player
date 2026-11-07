// The dock's extra (quiet) buttons: Undo, read the card the moment is about, list the choices on paper, list every Action, and
// bring a folded tray back. Split out of use-table-choice.ts; the handlers are the hook's.
import type { DockExtra } from "./buttons.tsx";
import type { Readout } from "../../readouts/readout.ts";
import type { Sheet } from "../sheet-types.ts";
import { tappable, type Dock } from "../table-choice.ts";
import { aidsFoldHelps } from "./fit.ts";

export { dockTextWidth, footPadOf } from "./fit.ts";

// Undo always shows on the dock, except where foldAids puts every aid behind More. The other quiet pills show as they are while there are this many or fewer; one more and they
// fold into a single More pill (dock-more-actions) that opens a popover (dock/more.tsx).
export const UNDO_ID = "table-undo";
export const PILLS_BEFORE_MORE = 2;
export const MORE_ID = "dock-more-actions";

export type DockPills = {
  // The pills on the row, Undo first when there is one.
  pills: readonly DockExtra[];
  // The pills behind More, in order; empty when nothing folds (and then there is no More pill).
  more: readonly DockExtra[];
};


/**
 * Undo first and always out; the others as they are, or all of them behind More when more than PILLS_BEFORE_MORE would show. With
 * `fold` (foldAids: a larger text size and a short room) every one, Undo too, is behind More; Undo keeps its id, label and hint there.
 */
export function dockPills(extras: readonly DockExtra[], fold = false): DockPills {
  if (fold && extras.length > 0) return { pills: [], more: extras };
  const undo = extras.filter((item) => item.testID === UNDO_ID);
  const others = extras.filter((item) => item.testID !== UNDO_ID);
  return others.length > PILLS_BEFORE_MORE ? { pills: undo, more: others } : { pills: [...undo, ...others], more: [] };
}

/**
 * Whether every reading aid goes behind More at this moment (fit.ts, aidsFoldHelps): above the default text size, when the moment as
 * the dock would draw it, with Undo and its other aids in their own row, does not fit the column and folding them takes room back. `width` is the dock's words' width.
 */
export function foldAids(a: { height: number; s: number; text: number; insets: { top: number; bottom: number }; width: number; trayOpen: boolean; dock: Dock; readout: Readout | null; refusal: string | null; extras: readonly DockExtra[] }): boolean {
  if (a.text <= 1 || a.extras.length === 0) return false;
  const open = dockPills(a.extras, false);
  const aids = [...open.pills.map((item) => item.label), ...(open.more.length > 0 ? ["More"] : [])];
  return aidsFoldHelps({ height: a.height, s: a.s, text: a.text, insets: a.insets, width: a.width, trayOpen: a.trayOpen, content: { dock: a.dock, readout: a.readout, refusal: a.refusal, aids, hasExtras: true } });
}

export function dockExtras(a: {
  sheet: Sheet;
  undoButton: DockExtra | null;
  panel: boolean;
  panelOpen: boolean;
  onRead: (cardId: string, about: readonly string[]) => void;
  onList: () => void;
  onCommit: () => void;
  onActions: () => void;
  onChoose: () => void;
}): DockExtra[] {
  const { sheet } = a;
  const extras: DockExtra[] = [];
  // Undo is in the dock, in reach of the thumb; a sheet opened from the table has Cancel instead.
  if (a.undoButton) extras.push(a.undoButton);
  const about = sheet.kind === "pick" ? (sheet.about ?? []) : sheet.kind === "trigger" && sheet.sourceId ? [sheet.sourceId] : [];
  const first = about[0];
  if (first) extras.push({ label: "Read", accessibilityLabel: "Read the card", testID: "sheet-inspect", onPress: () => a.onRead(first, about) });
  if (!a.panel && sheet.kind !== "window" && tappable(sheet).size > 0) extras.push({ label: "List", testID: "sheet-list", onPress: a.onList });
  // A Sailing test's look: the cards listed with their marks, read-only (sea-sheets.ts); also the path a screen reader takes.
  if (!a.panel && sheet.kind === "pick" && sheet.look != null && sheet.look.length > 0) extras.push({ label: "List", testID: "sheet-list", onPress: a.onList });
  if (sheet.kind === "window" && sheet.commit) extras.push({ label: "List", testID: "sheet-list", onPress: a.onCommit });
  if (sheet.kind === "window" && sheet.triggers.length > 0) extras.push({ label: `Actions (${sheet.triggers.length})`, testID: "table-actions", onPress: a.onActions });
  if (a.panel && !a.panelOpen) extras.push({ label: "Choose", testID: "sheet-expand", onPress: a.onChoose });
  return extras;
}
