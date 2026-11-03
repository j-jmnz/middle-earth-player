// Work that waits for the first paint. `afterPaint` runs after the frame the screen mounts in; `useOpenedAfterPaint` holds the
// result of a heavy open (a replay) that starts in an effect, so the screen paints its loading state first.
import { useEffect, useEffectEvent, useState } from "react";

/**
 * Runs `work` after the frame being built is painted (two animation frames: the first is the frame the screen mounts in, the second
 * the one after it). React Native 0.88 has no InteractionManager. Returns the cancel.
 */
export function afterPaint(work: () => void): () => void {
  let second = 0;
  const first = requestAnimationFrame(() => {
    second = requestAnimationFrame(work);
  });
  return () => {
    cancelAnimationFrame(first);
    cancelAnimationFrame(second);
  };
}

export type Opened<T> = { key: string; value: T };

/** The value held for `key`, or null for another key, a null key and nothing held. */
export function valueFor<T>(opened: Opened<T> | null, key: string | null): T | null {
  return key != null && opened?.key === key ? opened.value : null;
}

/** Whether `key` still has to be opened: a key already held keeps its value (a screen shown again must not build a new session). */
export function needsOpen<T>(opened: Opened<T> | null, key: string | null): key is string {
  return key != null && opened?.key !== key;
}

/**
 * `open()` for `key`. A value `peek()` has at once for the first key (a session already opened and cached) is held from the first render, so the
 * screen never shows its loading state; otherwise `open()` runs in an effect after the first paint. Null while it has not run and
 * for a null key. A new key opens again; the value of the old key is never returned for the new one, and a key already open is
 * never opened again (an effect that runs again when a hidden screen is shown keeps the value, and with it the screen's store).
 */
export function useOpenedAfterPaint<T>(key: string | null, peek: () => T | null, open: () => T): T | null {
  const [opened, setOpened] = useState<Opened<T> | null>(() => {
    const kept = key != null ? peek() : null;
    return key != null && kept != null ? { key, value: kept } : null;
  });
  // The latest `open` and held value, read when the effect's turn comes: a new closure alone does not open again.
  const run = useEffectEvent(open);
  const held = useEffectEvent((k: string) => !needsOpen(opened, k));
  useEffect(() => {
    if (key == null || held(key)) return undefined;
    return afterPaint(() => {
      if (!held(key)) setOpened({ key, value: run() });
    });
  }, [key]);
  return valueFor(opened, key);
}
