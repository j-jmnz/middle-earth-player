// The frame the choice tray and the reading panels share (docs/design-system.md, Table, Panels): a card-cornered box at the
// command column's right edge. The tray is night raised with a hairline edge; a reading panel may stay on paper. It enters in
// 260 ms decelerating (16 pt up and a fade), leaves in 180 ms accelerating, and snaps under reduced motion. Motion values for
// phase 23's motion-tokens.ts.
import { useEffect, useState, type ReactNode } from "react";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { tableTokens as t } from "./tokens.ts";

const ENTER_MS = 260;
const LEAVE_MS = 180;
const RISE = 16;
const RADIUS = 20;

export type TrayPlace = { right: number; width: number; bottom: number; top?: number; maxHeight?: number };

/** A value held while it is null, so a frame that is leaving still shows what it held. */
export function useHeld<T>(value: T | null): T | null {
  const [held, setHeld] = useState(value);
  if (value != null && value !== held) setHeld(value);
  return value ?? held;
}

export function TrayFrame({
  open,
  place,
  surface = "night",
  testID,
  children,
}: {
  open: boolean;
  place: TrayPlace;
  surface?: "night" | "paper";
  testID: string;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  // Mounted while it leaves, set while rendering when `open` turns off.
  const [wasOpen, setWasOpen] = useState(open);
  const [leaving, setLeaving] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    setLeaving(!open && !reduceMotion);
  }
  const progress = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    if (open) progress.set(reduceMotion ? 1 : withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) }));
    else if (reduceMotion) progress.set(0);
    else
      progress.set(
        withTiming(0, { duration: LEAVE_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) scheduleOnRN(setLeaving, false);
        }),
      );
  }, [open, reduceMotion, progress]);
  const motion = useAnimatedStyle(() => ({ opacity: progress.get(), transform: [{ translateY: (1 - progress.get()) * RISE }] }));
  if (!open && !leaving) return null;
  const paper = surface === "paper";
  return (
    <Animated.View
      testID={testID}
      collapsable={false}
      pointerEvents={open ? "auto" : "none"}
      style={[
        {
          position: "absolute",
          right: place.right,
          width: place.width,
          bottom: place.bottom,
          ...(place.top != null ? { top: place.top } : {}),
          ...(place.maxHeight != null ? { maxHeight: place.maxHeight } : {}),
          backgroundColor: paper ? t.paper : t.raised,
          borderWidth: 1,
          borderColor: paper ? t.inkLine : t.hairline,
          borderRadius: RADIUS,
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 8,
          overflow: "hidden",
        },
        motion,
      ]}
    >
      {children}
    </Animated.View>
  );
}
