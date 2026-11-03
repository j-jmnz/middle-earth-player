// A counter that moves whenever a write changes the saved decks (deck/store.ts, starter-decks.ts). A reader of the decks that is not on
// the deck screens (the Decks tab's dot, tab-bar.tsx) reads them again when it moves, and not on every change of tab. Pure.
let revision = 0;
const listeners = new Set<() => void>();

export function deckRevision(): number {
  return revision;
}

/** The saved decks changed: wakes the readers. */
export function bumpDeckRevision(): void {
  revision += 1;
  for (const listener of listeners) listener();
}

export function subscribeDeckRevision(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
