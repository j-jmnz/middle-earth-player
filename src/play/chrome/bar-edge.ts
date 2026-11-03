// Where the threat dials end in the top bar, measured by the bar (src/screens/table-top-bar.tsx) and read by the layers over it
// (table-layers.tsx): the choice tray's outside-tap layer over the bar stops short of the dials, so a tap on a dial reaches it. A dial
// cannot pick, so one tap is enough: the table view folds the tray and then peeks or opens the threat panel as usual. Plain module
// state, as scrub-open.ts: there is one top bar. 0 until it is measured, when the layer covers the whole bar as before.
import { useSyncExternalStore } from "react";

let edge = 0;
const listeners = new Set<() => void>();

/** The top bar: the dials end this far from the bar's left edge, inside the safe-area inset. */
export function setDialsEdge(value: number): void {
  const next = Math.max(0, Math.round(value));
  if (next === edge) return;
  edge = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** How far from the bar's left edge, inside the safe-area inset, the dials end. */
export function useDialsEdge(): number {
  return useSyncExternalStore(subscribe, () => edge, () => 0);
}
