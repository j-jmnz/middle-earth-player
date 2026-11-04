// The phase title sweep (phase 23): the new phase's name in large display type crosses the screen's center once when the round moves
// into it (user request, 2026-11-01: larger, and centered on the screen, not the canvas). Taps pass through it (pointerEvents none), it never gates a rule, and it is skipped under Quick, under reduced motion and
// when the table passes the whole phase for the player (sweep.ts), or while a combat spotlight plays.
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useStore } from "zustand";

import { timing, useMotionScale } from "../../ui/motion-run.ts";
import { MOTION, SHAPE } from "../../ui/motion-tokens.ts";
import { busyBetween, SETTLE_MS, sweepFrame, sweepName } from "./sweep.ts";
import type { TableStore } from "../store/store.ts";
import { useSpotlightHold } from "../spotlight/use-spotlight.ts";
import { useUiScale } from "../../ui/ui-scale.ts";
import { useTableTokens } from "../../ui/use-table-tokens.ts";
import { Text } from "../../ui/text.tsx";

// The title's size: twice the display type (24 pt), so it reads as an announcement across the table.
const SWEEP_TYPE = 48;
const SWEEP_LINE = 56;

/** `area` is the whole screen: the title crosses its center. */
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
  // A combat spotlight playing when the title is due holds the stage: the title is dropped, never run under it.
  const spotlit = useSpotlightHold(store);
  const spotlitNow = useEffectEvent(() => spotlit);
  // On a change of phase (or round): sweep unless the state moves cards, changes a count, or took the phase back. The game before is
  // the one just before that change (kept by the listener below, which runs when the store sets, before this renders).
  useEffect(() => {
    const was = before.current;
    const now = store.getState().game;
    const name = sweepName({ phase: was.phase, round: was.round }, { phase: now.phase, round: now.round }, scale, busyBetween(was, now));
    if (!name) return;
    const timer = setTimeout(() => {
      if (spotlitNow()) return;
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
  const style = useAnimatedStyle(() => {
    const frame = sweepFrame(progress.get(), SHAPE.sweepSlide * s);
    return { opacity: frame.opacity, transform: [{ translateX: frame.offset }] };
  });
  if (shown == null) return null;
  return (
    <View testID="phase-sweep" pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ position: "absolute", ...area, alignItems: "center", justifyContent: "center" }}>
      {/* The text is a plain Text under the animated view: NativeWind styles Text, not Animated.Text. */}
      <Animated.View style={style}>
        <Text
          className="font-display text-bone"
          style={{ fontSize: SWEEP_TYPE * s, lineHeight: SWEEP_LINE * s, textAlign: "center", textShadowColor: t.night, textShadowRadius: 16 * s, textShadowOffset: { width: 0, height: 3 * s }, letterSpacing: 6 * s, textTransform: "uppercase" }}
        >
          {shown}
        </Text>
      </Animated.View>
    </View>
  );
}
