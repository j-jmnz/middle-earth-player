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

type Opened<T> = { key: string; value: T };

/**
 * `open()` for `key`, run in an effect after the first paint. Null while it has not run and for a null key. A new key opens again;
 * the value of the old key is never returned for the new one.
 */
export function useOpenedAfterPaint<T>(key: string | null, open: () => T): T | null {
  const [opened, setOpened] = useState<Opened<T> | null>(null);
  // The latest `open`, read when the effect's turn comes: a new closure alone does not open again.
  const run = useEffectEvent(open);
  useEffect(() => {
    if (key == null) return undefined;
    return afterPaint(() => setOpened({ key, value: run() }));
  }, [key]);
  return key != null && opened?.key === key ? opened.value : null;
}
