// How far a pinned bar runs past the app's root view (bottom-inset.ts, overrun), measured in the window after each layout and again
// once a screen's open animation has settled (the stack slides a screen in, so a first measure can be off).
import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import type { View } from "react-native";
import { useSafeAreaFrame } from "react-native-safe-area-context";

import { overrun } from "./bottom-inset";

const SETTLED_MS = [400, 1200] as const;

export function useOverrun(): { ref: React.RefObject<ComponentRef<typeof View> | null>; onLayout: () => void; overrun: number } {
  const frame = useSafeAreaFrame();
  const ref = useRef<ComponentRef<typeof View> | null>(null);
  const [past, setPast] = useState(0);
  const rootBottom = frame.y + frame.height;
  const measure = useCallback(() => {
    ref.current?.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      const next = overrun(y + h, rootBottom);
      setPast((now) => (Math.abs(now - next) > 1 ? next : now));
    });
  }, [rootBottom]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onLayout = useCallback(() => {
    measure();
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = SETTLED_MS.map((ms) => setTimeout(measure, ms));
  }, [measure]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return { ref, onLayout, overrun: past };
}
