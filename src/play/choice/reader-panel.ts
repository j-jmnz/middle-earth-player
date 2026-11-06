// Whether a reading panel is open, for the reader table behind it (docs/design-system-table.md, Screen reader, Reading panels). iOS hides what
// is behind a modal view (`accessibilityViewIsModal`); Android does not, so the reader table is hidden from TalkBack while a panel is open.
// One module store the frame writes and the table reads through useSyncExternalStore. Reader mode only: the frame writes nothing otherwise.
import { useEffect, useSyncExternalStore } from "react";

import { useReaderMode } from "../../ui/screen-reader.ts";

let panelOpen = false;
const listeners = new Set<() => void>();

function set(value: boolean): void {
  if (panelOpen === value) return;
  panelOpen = value;
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const current = () => panelOpen;
const closed = () => false;

/** Whether a panel is open over the table. */
export function useReaderPanelOpen(): boolean {
  return useSyncExternalStore(subscribe, current, closed);
}

/** The frame of a reading panel tells the table it is open for as long as it is. */
export function useReaderPanel(open: boolean): void {
  const reader = useReaderMode();
  useEffect(() => {
    if (!reader || !open) return;
    set(true);
    return () => set(false);
  }, [reader, open]);
}
