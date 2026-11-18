// Whether the player chose to see the encounter and campaign cards while the app is open (the spoiler ask of docs/design-system.md, Card groups).
// One answer covers every set, scenario and campaign section (user decision, 2026-11-18): the first group that holds spoilers asks, and Show them
// opens them all. Nothing is saved: a relaunch asks again. A tiny store read through useSyncExternalStore.
import { useSyncExternalStore } from "react";

/** The one ask: its answer shows every encounter and campaign card until the app closes. */
export const SPOILER_TEXT = "Encounter and campaign cards show what the scenarios hold. Show all of them?";

let shown = false;
const listeners = new Set<() => void>();

export function revealSpoilers(): void {
  if (shown) return;
  shown = true;
  for (const listener of [...listeners]) listener();
}

export function spoilersRevealed(): boolean {
  return shown;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): boolean {
  return shown;
}

function serverSnapshot(): boolean {
  return false;
}

/** Whether the player has shown the spoilers since the app opened. */
export function useSpoilersRevealed(): boolean {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** Forgets the answer (tests). */
export function resetRevealed(): void {
  shown = false;
}
