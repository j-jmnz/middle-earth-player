// The groups the player chose to show while the app is open (the spoiler ask of docs/design-system.md, Card groups). Nothing is saved: a relaunch asks
// again. A tiny store read through useSyncExternalStore with a selector that returns one boolean, so a group re-renders only for its own key.
import { useSyncExternalStore } from "react";

const shown = new Set<string>();
const listeners = new Set<() => void>();

/** The key a group is remembered under. */
export function groupKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}

export function reveal(key: string): void {
  if (shown.has(key)) return;
  shown.add(key);
  for (const listener of [...listeners]) listener();
}

export function isRevealed(key: string): boolean {
  return shown.has(key);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether this group was shown already. */
export function useRevealed(key: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => shown.has(key),
    () => false,
  );
}

/** Forgets every shown group (tests). */
export function resetRevealed(): void {
  shown.clear();
}
