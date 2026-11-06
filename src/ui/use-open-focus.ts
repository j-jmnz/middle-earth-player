// Moves a screen reader's focus to `ref` when a sheet opens, and again when `key` (its title) changes while it stays open. A sheet mounts
// when it opens, so the first run of the effect is the opening. Reader mode only (user instruction, 2026-11-05: the reader path is separate
// from ordinary play), so a sighted player, the web build and a phone with no reader on run nothing here. The wait and the move are
// use-reader-focus.ts's; the timer is cancelled with the key, the reader setting and the sheet.
import { useEffect, type ComponentRef, type RefObject } from "react";
import type { View } from "react-native";

import { useReaderMode } from "./screen-reader.ts";
import { focusNode, SETTLE_MS } from "./use-reader-focus.ts";

export function useOpenFocus(ref: RefObject<ComponentRef<typeof View> | null>, key: string): void {
  const reader = useReaderMode();
  useEffect(() => {
    if (!reader) return;
    const timer = setTimeout(() => focusNode(ref.current), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [key, reader, ref]);
}
