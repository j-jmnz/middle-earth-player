// The frame the choice tray and the reading panels share (docs/design-system-table.md, Reading panels): a card-cornered box at the
// command column's right edge, with no drawn edge (user request, 2026-10-27: fewer borders). The choice tray is the dock's own flat
// night and stands on the dock as its upper part (`joined`); a reading panel stays on paper. It enters decelerating (16 pt up and a
// fade) and leaves accelerating (MOTION.trayEnter, MOTION.trayLeave), and snaps under reduced motion.
import { useState, type ReactNode } from "react";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { MOTION } from "./motion-tokens.ts";
import { useOpenMotion } from "./motion-run.ts";
import { panelSurface, parchmentSurface, raisedEdgeOf } from "./surfaces.ts";
import { withAlphaHex } from "./tokens.ts";
import { useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";

const RISE = 16;
const RADIUS = 4;

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
  joined = false,
  testID,
  children,
}: {
  open: boolean;
  place: TrayPlace;
  surface?: "night" | "paper";
  // The choice tray: it stands on the dock (its foot is the dock's top, its corners there square) in the dock's fill, so the two
  // read as one panel, the choice above and the answers under it. Its shadow falls up and out, never onto the dock.
  joined?: boolean;
  testID: string;
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
      style={[
        {
          position: "absolute",
          right: place.right,
          width: place.width,
          bottom: place.bottom,
          ...(place.top != null ? { top: place.top } : {}),
          ...(place.maxHeight != null ? { maxHeight: place.maxHeight } : {}),
          ...(paper ? parchmentSurface(t) : panelSurface(false, t)),
          ...(paper ? {} : { boxShadow: `${raisedEdgeOf(t)}, 0 -10px 24px -8px ${withAlphaHex(t.shade, t.depth === "light" ? 0.25 : 0.8)}` }),
          borderRadius: RADIUS * s,
          ...(joined ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 } : {}),
          paddingHorizontal: 12 * s,
          paddingTop: 10 * s,
          paddingBottom: (joined ? 4 : 8) * s,
          overflow: "hidden",
        },
        motion,
      ]}
    >
      {children}
    </Animated.View>
  );
}
