// The phase title sweep (phase 23): the new phase's name in Marcellus display crosses the canvas center once when the round moves into
// it. Taps pass through it (pointerEvents none), it never gates a rule, and it is skipped under Quick, under reduced motion and
// when the table passes the whole phase for the player (sweep.ts).
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useStore } from "zustand";

import { timing, useMotionScale } from "./motion-run.ts";
import { MOTION, SHAPE } from "./motion-tokens.ts";
import { SETTLE_MS, sweepFrame, sweepName } from "./sweep.ts";
import type { TableStore } from "./store.ts";
import { tableSettings } from "./table-settings.ts";
import { tableTokens as t } from "./tokens.ts";

/** `area` is the canvas on the screen: the title crosses its center. */
export function PhaseSweep({ store, area }: { store: TableStore; area: { left: number; top: number; width: number; height: number } }) {
  const phase = useStore(store, (state) => state.game.phase);
  const speed = useStore(tableSettings, (state) => state.settings.animationSpeed);
  const scale = useMotionScale();
  const before = useRef(phase);
  const [shown, setShown] = useState<string | null>(null);
  const progress = useSharedValue(0);
  useEffect(() => {
    const was = before.current;
    before.current = phase;
    const name = sweepName(was, phase, speed, scale);
    if (!name) return;
    const timer = setTimeout(() => {
      setShown(name);
      progress.set(0);
      progress.set(
        withTiming(1, timing(MOTION.sweep, 1), (finished) => {
          if (finished) scheduleOnRN(setShown, null);
        }),
      );
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [phase, speed, scale, progress]);
  const style = useAnimatedStyle(() => {
    const frame = sweepFrame(progress.get(), SHAPE.sweepSlide);
    return { opacity: frame.opacity, transform: [{ translateX: frame.offset }] };
  });
  if (shown == null) return null;
  return (
    <View testID="phase-sweep" pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ position: "absolute", ...area, alignItems: "center", justifyContent: "center" }}>
      {/* The text is a plain Text under the animated view: NativeWind styles Text, not Animated.Text. */}
      <Animated.View style={style}>
        <Text className="font-display text-display text-bone" style={{ textShadowColor: t.night, textShadowRadius: 10, textShadowOffset: { width: 0, height: 2 }, letterSpacing: 4, textTransform: "uppercase" }}>
          {shown}
        </Text>
      </Animated.View>
    </View>
  );
}
