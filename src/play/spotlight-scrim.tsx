// The night over the top bar and the dock while the combat spotlight plays (docs/design-system.md, Table, Spotlight; phase 24). The
// canvas dims itself; these React Native views dim the rest of the screen the same way (65% night, in over `spotlightScrim`, out as the
// last attack goes back, or over `spotlightScrim` after a skip) and catch the skip tap: a touch anywhere on the scrim skips every
// attack of the moment on press (not on release; a click too quick to report a press skips on release), and reaches nothing under it. The moment the gate ends the scrim stops catching
// touches (`pointerEvents`), though its fill is still fading, so the dock is live at once. It shows only while the gate is open
// (spotlight-gate.ts), so it is absent under reduced motion, with the spotlight switched off and on the web, and a tray's outside-tap
// fold, the popovers' outside tap and Android Back are untouched once it is gone.
import { useEffect, useState } from "react";
import { Pressable } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { timing, useMotionScale } from "./motion-run.ts";
import { MOTION, SHAPE } from "./motion-tokens.ts";
import type { TableStore } from "./store.ts";
import { withAlphaHex } from "./tokens.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { useScrim } from "./use-spotlight.ts";

type Box = { top?: number; bottom?: number; left?: number; right?: number; width?: number; height?: number };

/**
 * The scrim's views: the top bar, the command column (with the right inset) and the left inset. `shows` fades it in and, when it turns
 * off, out (over the return beat while the gate is still held, over a skip's fade after it ends); `catches` is whether it takes
 * touches, which a press on any of them turns into `onSkip`.
 */
function ScrimView({
  shows,
  catches,
  onSkip,
  insets,
  barBottom,
  commandWidth,
}: {
  shows: boolean;
  catches: boolean;
  onSkip: () => void;
  insets: { left: number; right: number };
  // The screen y under the top bar.
  barBottom: number;
  commandWidth: number;
}) {
  const scale = useMotionScale();
  const t = useTableTokens();
  const opacity = useSharedValue(0);
  // Mounted while it shows and until its fade out has run.
  const [lingers, setLingers] = useState(false);
  if (shows && !lingers) setLingers(true);
  useEffect(() => {
    if (shows) {
      opacity.set(withTiming(1, timing(MOTION.spotlightScrim, scale)));
    } else {
      opacity.set(
        withTiming(0, timing(catches ? MOTION.spotlightReturn : MOTION.spotlightScrim, scale), (finished) => {
          if (finished) scheduleOnRN(setLingers, false);
        }),
      );
    }
  }, [shows, catches, scale, opacity]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  if (!shows && !lingers) return null;
  const fill = withAlphaHex(t.night, SHAPE.spotlightNight);
  const region = (id: string, box: Box) => (
    <Animated.View key={id} pointerEvents={catches ? "auto" : "none"} style={[{ position: "absolute", backgroundColor: fill, ...box }, fade]}>
      <Pressable testID={id} accessible={false} importantForAccessibility="no" onPressIn={onSkip} onPress={onSkip} style={{ flex: 1 }} />
    </Animated.View>
  );
  return (
    <>
      {region("spotlight-scrim-bar", { top: 0, left: 0, right: 0, height: barBottom })}
      {region("spotlight-scrim-dock", { top: barBottom, bottom: 0, right: 0, width: commandWidth + insets.right })}
      {insets.left > 0 ? region("spotlight-scrim-edge", { top: barBottom, bottom: 0, left: 0, width: insets.left }) : null}
    </>
  );
}

/** The scrim of the table: shown while the store's spotlight gate is open and its last attack has not begun to go back; a press ends the gate. */
export function SpotlightScrim({ store, insets, barBottom, commandWidth }: { store: TableStore; insets: { left: number; right: number }; barBottom: number; commandWidth: number }) {
  const { shows, catches } = useScrim(store);
  return <ScrimView shows={shows} catches={catches} onSkip={() => store.getState().endSpotlight("skipped")} insets={insets} barBottom={barBottom} commandWidth={commandWidth} />;
}
