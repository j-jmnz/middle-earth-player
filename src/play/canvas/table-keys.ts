// The table's keys on the web and the desktop (docs/design-system-table.md, Pointer and keys; imported by the web gate, table-canvas.tsx, only). React Native Web hands a key
// to a View only while a control inside it holds focus, and a click on the table's empty ground focuses nothing, so Escape and Z (src/ui/key-shortcuts.ts) did nothing
// until the player had tabbed in. One window listener sees every key; one that the table maps, pressed where the focus is outside the table's root, is sent to the
// root as the same key, and the root's own `onKeyDown` (screens/table/use-table-back.ts) runs it: the one path the phone's keyboard takes, so a key never runs twice
// (a key pressed inside the root reaches it by itself). Typing in a field is left alone.
import { keyAction, type KeyInput } from "../../ui/key-shortcuts.ts";

// The table screen's root: the View that takes `onKeyDown` (screens/kit/chrome-frame.tsx), whose testID the web renders as `data-testid`.
const ROOT = '[data-testid="table"]';

/** Whether a key pressed at this target is typed text (a field, a select, a rich-text box) and not a shortcut. */
export function typingIn(target: unknown): boolean {
  if (typeof target !== "object" || target === null) return false;
  const { tagName, isContentEditable } = target as { tagName?: unknown; isContentEditable?: unknown };
  return isContentEditable === true || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

/** Whether a key is sent to the root: one the table maps, not already handled, not typing, and pressed outside the root. */
export function relays(event: KeyInput & { defaultPrevented?: boolean; target?: unknown }, root: { contains: (node: never) => boolean } | null): boolean {
  if (root === null || event.defaultPrevented === true || keyAction(event) === null || typingIn(event.target)) return false;
  return !(typeof event.target === "object" && event.target !== null && root.contains(event.target as never));
}

/** Binds the listener; returns the unbinding. */
export function relayKeys(): () => void {
  const listener = (event: KeyboardEvent) => {
    const root = document.querySelector(ROOT);
    if (!root || !relays(event, root)) return;
    const { key, ctrlKey, metaKey, altKey, shiftKey, repeat } = event;
    root.dispatchEvent(new KeyboardEvent("keydown", { key, ctrlKey, metaKey, altKey, shiftKey, repeat, bubbles: true, cancelable: true }));
  };
  window.addEventListener("keydown", listener);
  return () => window.removeEventListener("keydown", listener);
}
