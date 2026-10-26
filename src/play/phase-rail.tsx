// The phase rail in the top bar's middle (docs/design-system.md, Table; phase 20): a pill holding the round, the phase in gold
// Marcellus caps and the step, with the previous and next phase beside it when there is room. A tap opens the phase carousel
// (phase-carousel.tsx); the rail itself sends no intent. Phase changes slide the neighbor names one place and flash the pill's
// edge, a step change cross-fades the step; all of it snaps under reduced motion and never gates a rule.
import { useEffect, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolateColor,
  LayoutAnimationConfig,
  ReduceMotion,
  SlideInRight,
  SlideOutLeft,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { STOP_AHEAD_WORDS } from "./carousel.ts";
import type { Rail } from "./rail.ts";
import { tableTokens as t, withAlphaHex } from "./tokens.ts";
import { CHEVRON, PHASE_SLOT, SIDE_GAP, STOP_MARK } from "./top-bar-layout.ts";

// Motion values for phase 23's motion-tokens.ts: neighbor names slide 280 ms ease-out, the pill's edge flashes gold for 300 ms,
// the step cross-fades in 200 ms.
const SLIDE_MS = 280;
const FLASH_IN_MS = 60;
const FLASH_MS = 300;
const STEP_MS = 200;
const slideIn = SlideInRight.duration(SLIDE_MS).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System);
const slideOut = SlideOutLeft.duration(SLIDE_MS).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System);
const stepIn = FadeIn.duration(STEP_MS).reduceMotion(ReduceMotion.System);
const stepOut = FadeOut.duration(STEP_MS).reduceMotion(ReduceMotion.System);

/** A chevron drawn as two edges of a rotated square: no printed icon fits, and a glyph depends on the font. */
export function Chevron({ direction, color = t.muted }: { direction: "previous" | "next" | "up" | "down"; color?: string }) {
  const turn = {
    next: "45deg",
    previous: "225deg",
    down: "135deg",
    up: "315deg",
  }[direction];
  return (
    <View
      style={{
        width: CHEVRON,
        height: CHEVRON,
        alignItems: "center",
        justifyContent: "center",
      }}
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderTopWidth: 1.5,
          borderRightWidth: 1.5,
          borderColor: color,
          transform: [{ rotate: turn }],
        }}
      />
    </View>
  );
}

// The neighbor phase's name in a slot of fixed width: a new name slides in from the right while the old one leaves to the left.
function Neighbor({ side, name, stopAhead }: { side: "previous" | "next"; name: string; stopAhead: boolean }) {
  const slot = (
    <View style={{ width: PHASE_SLOT, height: 18, overflow: "hidden" }}>
      {name ? (
        <Animated.Text
          key={name}
          testID={`rail-${side}`}
          numberOfLines={1}
          entering={slideIn}
          exiting={slideOut}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            color: t.muted,
            fontSize: 13,
            lineHeight: 18,
            textAlign: side === "previous" ? "right" : "left",
          }}
        >
          {name}
        </Animated.Text>
      ) : null}
    </View>
  );
  // Both sides keep the room for the gold S, so the pill stays centered whether or not a stop is ahead.
  const mark = (
    <View style={{ width: STOP_MARK, alignItems: "center" }}>
      {side === "next" && stopAhead ? (
        <Text testID="rail-stop-ahead" accessibilityLabel={STOP_AHEAD_WORDS} className="font-display text-label text-gold">
          S
        </Text>
      ) : null}
    </View>
  );
  return (
    <View importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", alignItems: "center", gap: SIDE_GAP }}>
      {side === "previous" ? (
        <>
          {mark}
          <Chevron direction="previous" />
          {slot}
        </>
      ) : (
        <>
          {slot}
          <Chevron direction="next" />
          {mark}
        </>
      )}
    </View>
  );
}

/**
 * The rail: round, phase and step in a pill, "Round 3 · QUEST" over "Staging". `wide` adds the previous and next phase at its
 * sides; `shortRound` (a phone under 760 pt inside the insets) says "R3" for the round. `stopAhead` puts a gold S by the next
 * chevron, or at the end of the pill's top line when the neighbors are not shown. The pill's goldLine edge says it is a button. A tap calls `onPress` (the carousel opens or closes).
 */
export function PhaseRail({
  rail,
  wide,
  shortRound,
  stopAhead = false,
  open = false,
  onPress,
}: {
  rail: Rail;
  wide: boolean;
  shortRound: boolean;
  stopAhead?: boolean;
  open?: boolean;
  onPress?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const flash = useSharedValue(0);
  const lastPhase = useRef(rail.phase);
  useEffect(() => {
    if (lastPhase.current === rail.phase) return;
    lastPhase.current = rail.phase;
    if (!reduceMotion) flash.set(withSequence(withTiming(1, { duration: FLASH_IN_MS }), withTiming(0, { duration: FLASH_MS - FLASH_IN_MS })));
  }, [rail.phase, reduceMotion, flash]);
  const edge = useAnimatedStyle(() => ({
    borderColor: interpolateColor(flash.get(), [0, 1], [open ? t.gold : t.goldLine, t.gold]),
  }));
  const round = rail.round > 0 ? (shortRound ? `R${rail.round}` : `Round ${rail.round}`) : "";
  const label = [rail.round > 0 ? `Round ${rail.round}` : "", rail.phase, rail.current, stopAhead ? STOP_AHEAD_WORDS : ""].filter(Boolean).join(". ");
  return (
    <Pressable
      testID="rail"
      accessible
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={label}
      accessibilityHint={onPress ? "Shows the round's phases" : undefined}
      accessibilityState={{ expanded: open }}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 0,
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: SIDE_GAP,
        minHeight: 44,
        borderRadius: 999,
        backgroundColor: pressed ? withAlphaHex(t.bone, 0.12) : "transparent",
      })}
    >
      {/* What is on the table when it opens appears; it does not slide or fade in. */}
      <LayoutAnimationConfig skipEntering>
        {wide ? <Neighbor side="previous" name={rail.previousPhase} stopAhead={false} /> : null}
        <Animated.View
          style={[
            {
              flexShrink: 1,
              alignItems: "center",
              borderWidth: 1,
              borderRadius: 18,
              paddingHorizontal: 10,
              paddingVertical: 1,
            },
            edge,
          ]}
        >
          {rail.phase || round ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flexShrink: 1,
              }}
            >
              {round ? (
                <Text testID="rail-round" numberOfLines={1} className="text-label text-muted" style={{ lineHeight: 20 }}>
                  {round}
                </Text>
              ) : null}
              {round && rail.phase ? (
                <Text className="text-label text-muted" style={{ marginHorizontal: 4, lineHeight: 20 }}>
                  ·
                </Text>
              ) : null}
              {rail.phase ? (
                <Text
                  testID="rail-phase"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  className="font-display text-body uppercase text-gold"
                  style={{
                    lineHeight: 20,
                    textShadowColor: t.gold,
                    textShadowRadius: 8,
                    textShadowOffset: { width: 0, height: 0 },
                  }}
                >
                  {rail.phase}
                </Text>
              ) : null}
              {/* Without the neighbors there is no chevron to carry the S: it stands in the pill, in the room the floor keeps. */}
              {!wide && stopAhead ? (
                <Text testID="rail-stop-ahead" accessibilityLabel={STOP_AHEAD_WORDS} className="font-display text-label text-gold" style={{ marginLeft: 4, lineHeight: 20 }}>
                  S
                </Text>
              ) : null}
            </View>
          ) : null}
          <Animated.View key={rail.current} entering={stepIn} exiting={stepOut}>
            <Text testID="rail-current" numberOfLines={1} className="text-label" style={{ color: t.bone, lineHeight: 16 }}>
              {rail.current}
            </Text>
          </Animated.View>
        </Animated.View>
        {wide ? <Neighbor side="next" name={rail.nextPhase} stopAhead={stopAhead} /> : null}
      </LayoutAnimationConfig>
    </Pressable>
  );
}
