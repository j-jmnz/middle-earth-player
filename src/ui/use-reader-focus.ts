// Moves a screen reader's focus to `ref` when `key` changes (user instruction, 2026-11-05: the reader path is separate from ordinary play).
// Only under useReaderMode, so a sighted player, the web build and a phone with no reader on never run it. The move waits SETTLE_MS for the
// new moment's layout and enter motion to settle, so the reader lands on the element where it now stands. `hold` keeps focus where the
// reader is (it is on a card the new moment still asks about). `settled` is called after that wait with whether focus moved, so the caller
// can say the new moment once focus is where it will be. The move also waits for the announcer to fall silent (announce.ts, onIdle), so the
// title it reads does not talk over the banner's lines. The timer and the wait are cancelled with the key, the reader setting and the screen.
import { useEffect, useEffectEvent, useRef, type ComponentRef, type RefObject } from "react";
import { AccessibilityInfo, findNodeHandle, type View } from "react-native";

import { onIdle } from "./announce.ts";
import { focusPlan } from "./reader-focus.ts";
import { useReaderMode } from "./screen-reader.ts";

// The trays enter over MOTION.trayEnter and the layout measures a frame later; this is after both.
export const SETTLE_MS = 350;

// A module-level function: the React Compiler cannot compile a try/catch inside a hook.
export function focusNode(target: ComponentRef<typeof View> | null): void {
  try {
    const node = target ? findNodeHandle(target) : null;
    if (node != null) AccessibilityInfo.setAccessibilityFocus(node);
  } catch {
    // A platform without accessibility focus has nothing to move.
  }
}

export function useReaderFocus(ref: RefObject<ComponentRef<typeof View> | null>, key: string, hold?: boolean, settled?: (moved: boolean) => void): void {
  const reader = useReaderMode();
  const previous = useRef(key);
  const held = useEffectEvent(() => hold === true);
  const land = useEffectEvent((moves: boolean) => {
    if (moves) focusNode(ref.current);
    settled?.(moves);
  });
  useEffect(() => {
    const plan = focusPlan(previous.current, key, held());
    previous.current = key;
    if (!reader || plan === "none") return;
    const waiting = { cancel: null as (() => void) | null };
    const timer = setTimeout(() => {
      waiting.cancel = onIdle(() => land(plan === "focus"));
    }, SETTLE_MS);
    return () => {
      clearTimeout(timer);
      waiting.cancel?.();
    };
  }, [key, reader]);
}
