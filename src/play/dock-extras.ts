// The dock's extra (quiet) buttons: Undo, read the card the moment is about, list the choices on paper, list every Action, and
// bring a folded tray back. Split out of use-table-choice.ts; the handlers are the hook's.
import type { DockExtra } from "./dock-buttons.tsx";
import type { Sheet } from "./sheet-types.ts";
import { tappable } from "./table-choice.ts";

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
  if (first) extras.push({ label: "Read the card", testID: "sheet-inspect", onPress: () => a.onRead(first, about) });
  if (!a.panel && sheet.kind !== "window" && tappable(sheet).size > 0) extras.push({ label: "List", testID: "sheet-list", onPress: a.onList });
  if (sheet.kind === "window" && sheet.commit) extras.push({ label: "List", testID: "sheet-list", onPress: a.onCommit });
  if (sheet.kind === "window" && sheet.triggers.length > 0) extras.push({ label: `Actions (${sheet.triggers.length})`, testID: "table-actions", onPress: a.onActions });
  if (a.panel && !a.panelOpen) extras.push({ label: "Choose", testID: "sheet-expand", onPress: a.onChoose });
  return extras;
}
