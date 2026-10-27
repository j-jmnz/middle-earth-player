// The frame the choice tray and the reading panels share (docs/design-system.md, Table, Panels): a card-cornered box at the
// command column's right edge. The tray is night raised with a hairline edge; a reading panel may stay on paper. It enters
// decelerating (16 pt up and a fade) and leaves accelerating (MOTION.trayEnter, MOTION.trayLeave), and snaps under reduced motion.
import { useState, type ReactNode } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { MOTION } from "./motion-tokens.ts";
import { useOpenMotion } from "./motion-run.ts";
import { goldSurface, panelSurface, raisedEdge } from "./surfaces.ts";
import { tableTokens as t, withAlphaHex } from "./tokens.ts";

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
  squareFoot = false,
  accent = false,
  testID,
  children,
}: {
  open: boolean;
  place: TrayPlace;
  surface?: "night" | "paper";
  // The dock-side foot corner is square (the tray stands on the dock's block).
  squareFoot?: boolean;
  // A choice waiting on the player (the choice tray): a goldLine edge, a worked-gold rule along its top and a deep shadow, so it
  // stands apart from the dock under it, which shares the night surface.
  accent?: boolean;
  testID: string;
  children: ReactNode;
}) {
  const { progress, leaving } = useOpenMotion(open, MOTION.trayEnter, MOTION.trayLeave);
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
          ...(paper ? { backgroundColor: t.paper } : panelSurface()),
          borderWidth: 1,
          borderColor: paper ? t.inkLine : accent ? t.goldLine : t.hairline,
          ...(accent ? { boxShadow: `${raisedEdge}, 0 10px 28px ${withAlphaHex(t.night, 0.7)}, 0 0 18px ${withAlphaHex(t.gold, 0.1)}` } : {}),
          borderRadius: RADIUS,
          ...(squareFoot ? { borderBottomRightRadius: 0 } : {}),
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 8,
          overflow: "hidden",
        },
        motion,
      ]}
    >
      {accent ? <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, ...goldSurface() }} /> : null}
      {children}
    </Animated.View>
  );
}
