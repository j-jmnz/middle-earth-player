// The pictures still loading on screen, for the README showcase's captures (docs/showcase.md, Every picture drawn). Only the
// showcase build (EXPO_PUBLIC_SHOWCASE=1, inlined by Expo at build time) counts them; every other build holds nothing and never renders the
// marker. A picture holds a key while it has not drawn (its file not loaded, or not yet decoded for the canvas) and lets it go once it has,
// or when it leaves the screen. The marker (pictures-ready.tsx) shows once nothing has been held for a moment.

/** True in the showcase build only. */
export const SHOWCASE = process.env.EXPO_PUBLIC_SHOWCASE === "1";

const held = new Set<string>();
const listeners = new Set<() => void>();
// Counts every hold and release, so the marker can tell an idle screen from one that was busy a moment ago.
let changes = 0;

function changed(): void {
  changes += 1;
  for (const listener of listeners) listener();
}

/** Holds `key` until the returned release runs. Releasing twice, or a key never held, changes nothing. */
export function holdPicture(key: string): () => void {
  if (held.has(key)) return () => undefined;
  held.add(key);
  changed();
  return () => {
    if (!held.delete(key)) return;
    changed();
  };
}

export function subscribePictures(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** How many holds and releases there have been, or -1 while a picture is held: the marker's snapshot. */
export function pictureSnapshot(): number {
  return held.size > 0 ? -1 : changes;
}
