// The night over the top bar and the dock while the combat spotlight plays (docs/design-system.md, Table, Spotlight; phase 24). The
// canvas dims itself; these React Native views dim the rest of the screen the same way (65% night, in over the first beat, out as the
// last attack goes back) and catch the skip tap: a tap anywhere on the scrim skips every attack of the moment and reaches nothing
// under it. The dock's next moment is ready under the scrim. It shows only while the gate is open (spotlight-gate.ts), so it is
// absent under reduced motion and on the web, and a tray's outside-tap fold, the popovers' outside tap and Android Back are
// untouched once it is gone.
import { useMemo } from "react";
import { Pressable } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { layoutAnim, useMotionScale } from "./motion-run.ts";
import { MOTION, SHAPE } from "./motion-tokens.ts";
import type { TableStore } from "./store.ts";
import { tableTokens as t, withAlphaHex } from "./tokens.ts";
import { useScrimShows } from "./use-spotlight.ts";

type Box = { top?: number; bottom?: number; left?: number; right?: number; width?: number; height?: number };

/** The scrim's views: the top bar, the command column (with the right inset) and the left inset, when `shows`. A tap on any calls `onSkip`. */
export function ScrimView({
  shows,
  onSkip,
  insets,
  barBottom,
  commandWidth,
}: {
  shows: boolean;
  onSkip: () => void;
  insets: { left: number; right: number };
  // The screen y under the top bar.
  barBottom: number;
  commandWidth: number;
}) {
  const scale = useMotionScale();
  const fade = useMemo(() => ({ enter: layoutAnim(FadeIn, MOTION.spotlightDim, scale), leave: layoutAnim(FadeOut, MOTION.spotlightReturn, scale) }), [scale]);
  if (!shows) return null;
  const fill = withAlphaHex(t.night, SHAPE.spotlightNight);
  const region = (id: string, box: Box) => (
    <Animated.View key={id} entering={fade.enter} exiting={fade.leave} style={{ position: "absolute", backgroundColor: fill, ...box }}>
      <Pressable testID={id} accessible={false} importantForAccessibility="no" onPress={onSkip} style={{ flex: 1 }} />
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

/** The scrim of the table: shown while the store's spotlight gate is open and its last attack has not begun to go back; a tap ends the gate. */
export function SpotlightScrim({ store, insets, barBottom, commandWidth }: { store: TableStore; insets: { left: number; right: number }; barBottom: number; commandWidth: number }) {
  const shows = useScrimShows(store);
  return <ScrimView shows={shows} onSkip={() => store.getState().endSpotlight("skipped")} insets={insets} barBottom={barBottom} commandWidth={commandWidth} />;
}
