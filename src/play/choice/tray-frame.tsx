// The frame of the reading panels (docs/design-system-table.md, Reading panels): a container-cornered box at the command column's
// right edge, with no drawn edge (user request, 2026-10-27: fewer borders), on parchment, or on night for the table settings. It
// enters decelerating (16 pt up and a fade) and leaves accelerating (MOTION.trayEnter, MOTION.trayLeave), and snaps under reduced
// motion. The choice's rows (choice/tray.tsx) share its motion but stand in the dock.
import { useState, type ReactNode } from "react";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { MOTION } from "../../ui/motion-tokens.ts";
import { useOpenMotion } from "../../ui/motion-run.ts";
import { CONTAINER_RADIUS } from "../../ui/radius.ts";
import { floatingSurface, parchmentSurface, raisedEdgeOf } from "../../ui/surfaces.ts";
import { withAlphaHex } from "../../ui/tokens.ts";
import { useUiScale } from "../../ui/ui-scale.ts";
import { useTableTokens } from "../../ui/use-table-tokens.ts";

const RISE = 16;

type TrayPlace = { right: number; width: number; bottom: number; top?: number; maxHeight?: number };

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
  onClose,
  children,
}: {
  open: boolean;
  place: TrayPlace;
  surface?: "night" | "paper";
  testID: string;
  // What a screen reader's escape gesture does while the panel is open (it is then modal: the table behind it is not read).
  onClose?: () => void;
  children: ReactNode;
}) {
  const t = useTableTokens();
  const s = useUiScale();
  const { progress, leaving } = useOpenMotion(open, MOTION.trayEnter, MOTION.trayLeave);
  const motion = useAnimatedStyle(() => ({ opacity: progress.get(), transform: [{ translateY: (1 - progress.get()) * RISE * s }] }));
  if (!open && !leaving) return null;
  const paper = surface === "paper";
  return (
    <Animated.View
      testID={testID}
      collapsable={false}
      pointerEvents={open ? "auto" : "none"}
      accessibilityViewIsModal={open}
      onAccessibilityEscape={open ? onClose : undefined}
      style={[
        {
          position: "absolute",
          right: place.right,
          width: place.width,
          bottom: place.bottom,
          ...(place.top != null ? { top: place.top } : {}),
          ...(place.maxHeight != null ? { maxHeight: place.maxHeight } : {}),
          ...(paper ? parchmentSurface(t) : floatingSurface(t)),
          ...(paper ? {} : { boxShadow: `${raisedEdgeOf(t)}, 0 -10px 24px -8px ${withAlphaHex(t.shade, t.depth === "light" ? 0.25 : 0.8)}` }),
          borderRadius: CONTAINER_RADIUS * s,
          paddingHorizontal: 12 * s,
          paddingTop: 10 * s,
          paddingBottom: 8 * s,
          overflow: "hidden",
        },
        motion,
      ]}
    >
      {children}
    </Animated.View>
  );
}
