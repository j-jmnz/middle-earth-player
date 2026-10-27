import { useSyncExternalStore } from "react";

// The card pool's view: a grid of the card pictures, or one row per card. Kept while the app is open, shared by the Cards tab and
// the pool the deck editor opens.
export type PoolView = "Grid" | "List";

let view: PoolView = "Grid";
const listeners = new Set<() => void>();

export function setPoolView(next: PoolView): void {
  if (next === view) return;
  view = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePoolView(): PoolView {
  return useSyncExternalStore(subscribe, () => view, () => view);
}
