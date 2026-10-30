// The phone's accessibility settings the table follows, kept once for the whole app: Reduce motion and whether a screen reader (VoiceOver,
// TalkBack) is on. The hooks that read them (useReduceMotion and useMotionScale in motion-run.ts, useScreenReader in screen-reader.ts) share
// this store through useSyncExternalStore, so the two AccessibilityInfo listeners exist once while any component reads them, not once for
// each hook call (about twenty on an open table). The first subscriber starts the listeners and reads the current values; the last one
// leaving removes them.
import { AccessibilityInfo } from "react-native";

export type Accessibility = {
  // The phone's Reduce motion, or null until the phone has answered (the hook then uses Reanimated's reading of it).
  reduceMotion: boolean | null;
  screenReader: boolean;
};

let state: Accessibility = { reduceMotion: null, screenReader: false };
const listeners = new Set<() => void>();
let stop: (() => void) | null = null;

function set(change: Partial<Accessibility>): void {
  const next = { ...state, ...change };
  // A value that did not change keeps the same state, so a reader is not told twice.
  if (next.reduceMotion === state.reduceMotion && next.screenReader === state.screenReader) return;
  state = next;
  for (const listener of [...listeners]) listener();
}

// Reads the current values and follows them live; returns the way to stop.
function start(): () => void {
  let live = true;
  AccessibilityInfo.isReduceMotionEnabled()
    .then((enabled) => {
      if (live) set({ reduceMotion: enabled });
    })
    .catch(() => undefined);
  AccessibilityInfo.isScreenReaderEnabled()
    .then((enabled) => {
      if (live) set({ screenReader: enabled });
    })
    .catch(() => undefined);
  const subscriptions = [
    AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => set({ reduceMotion: enabled })),
    AccessibilityInfo.addEventListener("screenReaderChanged", (enabled) => set({ screenReader: enabled })),
  ];
  return () => {
    live = false;
    for (const subscription of subscriptions) subscription.remove();
  };
}

/** For useSyncExternalStore: calls `listener` when either setting changes, and returns the way to stop. */
export function subscribeAccessibility(listener: () => void): () => void {
  listeners.add(listener);
  if (!stop) stop = start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && stop) {
      stop();
      stop = null;
    }
  };
}

/** The settings as last heard of; the same object until one changes. */
export function accessibility(): Accessibility {
  return state;
}
