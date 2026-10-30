// The phase title sweep (phase 23): the new phase's name in Marcellus SC crosses the middle of the table (the canvas and the command
// column together, under the top bar) once when the round moves into it, on a dark band that fades at its ends between two hairlines.
// Taps pass through it (pointerEvents none), it never gates a rule, and it is skipped under Quick, under reduced motion and when the
// table passes the whole phase for the player (sweep.ts).
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useStore } from "zustand";

import { timing, useMotionScale } from "./motion-run.ts";
import { MOTION, SHAPE } from "./motion-tokens.ts";
import { busyBetween, SETTLE_MS, sweepFrame, sweepName } from "./sweep.ts";
import type { TableStore } from "./store.ts";
import { withAlphaHex } from "./tokens.ts";
import { useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

// The band: at most this wide (pt), the night at this opacity in its middle, fading out over the outer fifth at each side.
const BAND = 520;
const BAND_NIGHT = 0.82;

/** `area` is the table under the top bar, the canvas and the command column together: the title crosses its center. */
export function PhaseSweep({ store, area }: { store: TableStore; area: { left: number; top: number; width: number; height: number } }) {
  // Only a change of phase or round renders this (not every state).
  const phase = useStore(store, (state) => state.game.phase);
  const round = useStore(store, (state) => state.game.round);
  const scale = useMotionScale();
  const t = useTableTokens();
  const s = useUiScale();
  const before = useRef(store.getState().game);
  const [shown, setShown] = useState<string | null>(null);
  const progress = useSharedValue(0);
  // On a change of phase (or round): sweep unless the state moves cards, changes a count, or took the phase back. The game before is
  // the one just before that change (kept by the listener below, which runs when the store sets, before this renders).
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
  useEffect(
    () =>
      store.subscribe((state, previous) => {
        if (state.game.phase !== previous.game.phase || state.game.round !== previous.game.round) before.current = previous.game;
      }),
    [store],
  );
  // The sweep's animation stops with the view.
  useEffect(() => () => cancelAnimation(progress), [progress]);
  // The band fades in and out where it stands; only the title slides across it.
  const band = useAnimatedStyle(() => ({ opacity: sweepFrame(progress.get(), 0).opacity }));
  const title = useAnimatedStyle(() => ({ transform: [{ translateX: sweepFrame(progress.get(), SHAPE.sweepSlide * s).offset }] }));
  if (shown == null) return null;
  const night = withAlphaHex(t.night, BAND_NIGHT);
  const clear = withAlphaHex(t.night, 0);
  const line = withAlphaHex(t.accentLine, 0);
  const hairline = { alignSelf: "stretch" as const, height: 1, backgroundImage: `linear-gradient(90deg, ${line}, ${t.accentLine} 30%, ${t.accentLine} 70%, ${line})` };
  return (
    <View testID="phase-sweep" pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ position: "absolute", ...area, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ width: Math.min(area.width, BAND * s), alignItems: "center", overflow: "hidden", backgroundImage: `linear-gradient(90deg, ${clear}, ${night} 20%, ${night} 80%, ${clear})` }, band]}>
        <View style={hairline} />
        {/* The text is a plain Text under the animated view: NativeWind styles Text, not Animated.Text. */}
        <Animated.View style={[{ paddingVertical: 10 * s }, title]}>
          <Text className="font-display text-display text-bone" style={{ letterSpacing: 6 * s, textTransform: "uppercase" }}>
            {shown}
          </Text>
        </Animated.View>
        <View style={hairline} />
      </Animated.View>
    </View>
  );
}
