// The phase title sweep (phase 23): the new phase's name in Cinzel display crosses the canvas center once when the round moves into
// it. Taps pass through it (pointerEvents none), it never gates a rule, and it is skipped under Quick, under reduced motion and
// when the table passes the whole phase for the player (sweep.ts).
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useStore } from "zustand";

import { timing, useMotionScale } from "./motion-run.ts";
import { MOTION, SHAPE } from "./motion-tokens.ts";
import { busyBetween, SETTLE_MS, sweepFrame, sweepName } from "./sweep.ts";
import type { TableStore } from "./store.ts";
import { useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

/** `area` is the canvas on the screen: the title crosses its center. */
export function PhaseSweep({ store, area }: { store: TableStore; area: { left: number; top: number; width: number; height: number } }) {
  // Every state renders this, so the effect that keeps the game before reads the one just before this.
  const game = useStore(store, (state) => state.game);
  const { phase, round } = game;
  const scale = useMotionScale();
  const t = useTableTokens();
  const s = useUiScale();
  const before = useRef(store.getState().game);
  const [shown, setShown] = useState<string | null>(null);
  const progress = useSharedValue(0);
  // On a change of phase (or round): sweep unless the state moves cards, changes a count, or took the phase back. The game before
  // is kept by the effect below, which runs after this one.
  useEffect(() => {
    const was = before.current;
    const now = store.getState().game;
    const name = sweepName({ phase: was.phase, round: was.round }, { phase: now.phase, round: now.round }, scale, busyBetween(was, now));
    if (!name) return;
    const timer = setTimeout(() => {
      setShown(name);
      progress.set(0);
      progress.set(
        withTiming(1, timing(MOTION.sweep, scale), (finished) => {
          if (finished) scheduleOnRN(setShown, null);
        }),
      );
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [phase, round, scale, store, progress]);
  useEffect(() => {
    before.current = store.getState().game;
  });
  const style = useAnimatedStyle(() => {
    const frame = sweepFrame(progress.get(), SHAPE.sweepSlide * s);
    return { opacity: frame.opacity, transform: [{ translateX: frame.offset }] };
  });
  if (shown == null) return null;
  return (
    <View testID="phase-sweep" pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ position: "absolute", ...area, alignItems: "center", justifyContent: "center" }}>
      {/* The text is a plain Text under the animated view: NativeWind styles Text, not Animated.Text. */}
      <Animated.View style={style}>
        <Text className="font-display text-display text-bone" style={{ textShadowColor: t.night, textShadowRadius: 10 * s, textShadowOffset: { width: 0, height: 2 * s }, letterSpacing: 4 * s, textTransform: "uppercase" }}>
          {shown}
        </Text>
      </Animated.View>
    </View>
  );
}
