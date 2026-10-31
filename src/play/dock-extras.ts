// The dock's extra (quiet) buttons: Undo, read the card the moment is about, list the choices on paper, list every Action, and
// bring a folded tray back. Split out of use-table-choice.ts; the handlers are the hook's.
import type { DockExtra } from "./dock-buttons.tsx";
import type { Sheet } from "./sheet-types.ts";
import { tappable } from "./table-choice.ts";

// Undo always shows on the dock. The other quiet pills show as they are while there are this many or fewer; one more and they
// fold into a single More pill (dock-more-actions) that opens a popover (dock-more.tsx).
export const UNDO_ID = "table-undo";
export const PILLS_BEFORE_MORE = 2;
export const MORE_ID = "dock-more-actions";

export type DockPills = {
  // The pills on the row, Undo first when there is one.
  pills: readonly DockExtra[];
  // The pills behind More, in order; empty when nothing folds (and then there is no More pill).
  more: readonly DockExtra[];
};

/** Undo first and always out; the others as they are, or all of them behind More when more than PILLS_BEFORE_MORE would show. */
export function dockPills(extras: readonly DockExtra[]): DockPills {
  const undo = extras.filter((item) => item.testID === UNDO_ID);
  const others = extras.filter((item) => item.testID !== UNDO_ID);
  return others.length > PILLS_BEFORE_MORE ? { pills: undo, more: others } : { pills: [...undo, ...others], more: [] };
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
