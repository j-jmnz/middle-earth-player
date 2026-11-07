// The table's keyboard shortcuts (docs/design-system-table.md, Screen reader). A key event maps to an action or to none; the table decides
// whether the action may run now. Enter and Space are the platform's press of the focused control and are not mapped here. React Native
// 0.88 delivers key events to a view only on Android (JSKeyDispatcher, to the focused view); iOS and the web send none through a View.
export type KeyAction = "escape" | "undo";

export type KeyInput = { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean; repeat?: boolean };

/** Escape closes the top layer; Z, Ctrl+Z or Cmd+Z is Undo. A held key, Alt, or Shift+Z is nothing, so a repeat never undoes twice. */
export function keyAction(event: KeyInput): KeyAction | null {
  if (event.repeat === true || event.altKey === true) return null;
  const plain = event.ctrlKey !== true && event.metaKey !== true && event.shiftKey !== true;
  if (event.key === "Escape") return plain ? "escape" : null;
  if ((event.key === "z" || event.key === "Z") && event.shiftKey !== true) return "undo";
  return null;
}
