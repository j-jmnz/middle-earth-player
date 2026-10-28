// The phase rail in the top bar's middle (docs/design-system.md, Table; phase 20): a pill holding the round, the phase in gold
// Cinzel capitals and the step, with the previous and next phase inline at the phase's sides when there is room. A tap opens the
// phase carousel (phase-carousel.tsx); the rail itself sends no intent. A phase change flashes the pill's edge, a step change
// cross-fades the step (MOTION.railFlash, railStep); both snap under reduced motion and never gate a rule. The neighbor names do not
// move: they change in place.
import { useEffect, useMemo, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, interpolateColor, LayoutAnimationConfig, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { STOP_AHEAD_WORDS } from "./carousel.ts";
import { layoutAnim, timing, useMotionScale } from "./motion-run.ts";
import { MOTION } from "./motion-tokens.ts";
import type { Rail } from "./rail.ts";
import { withAlphaHex } from "./tokens.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { CHEVRON, NEIGHBOR_GAP } from "./top-bar-layout.ts";


/** A chevron drawn as two edges of a rotated square: no printed icon fits, and a glyph depends on the font. */
export function Chevron({ direction, color }: { direction: "previous" | "next" | "up" | "down"; color?: string }) {
  const t = useTableTokens();
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
          borderColor: color ?? t.muted,
          transform: [{ rotate: turn }],
        }}
      />
    </View>
  );
}

// A neighbor phase's name, inline at the phase's side in muted label. Plain text: it neither slides nor fades.
function Neighbor({ side, name }: { side: "previous" | "next"; name: string }) {
  if (!name) return null;
  return (
    <Text
      testID={`rail-${side}`}
      numberOfLines={1}
      importantForAccessibility="no"
      className="text-label text-muted"
      style={{ lineHeight: 20, [side === "previous" ? "marginRight" : "marginLeft"]: NEIGHBOR_GAP }}
    >
      {name}
    </Text>
  );
}

/**
 * The rail: round, phase and step in a pill, "Round 3 · QUEST" over "Staging". `wide` puts the previous and next phase inline at
 * the phase's sides, "Round 3 · Planning QUEST Travel"; `shortRound` (a phone under 760 pt inside the insets) says "R3" for the
 * round. `stopAhead` puts a gold S at the end of the pill's top line. The pill's goldLine edge says it is a button. A tap calls
 * `onPress` (the carousel opens or closes).
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
  const scale = useMotionScale();
  const t = useTableTokens();
  const step = useMemo(() => ({ in: layoutAnim(FadeIn, MOTION.railStep, scale), out: layoutAnim(FadeOut, MOTION.railStep, scale) }), [scale]);
  const flash = useSharedValue(0);
  const lastPhase = useRef(rail.phase);
  useEffect(() => {
    if (lastPhase.current === rail.phase) return;
    lastPhase.current = rail.phase;
    if (scale > 0) flash.set(withSequence(withTiming(1, timing(MOTION.railFlashIn, scale)), withTiming(0, timing(MOTION.railFlashOut, scale))));
  }, [rail.phase, scale, flash]);
  // The colors go into the worklet as strings, so a theme change draws the edge again.
  const gold = t.gold;
  const goldLine = t.goldLine;
  const edge = useAnimatedStyle(() => ({
    borderColor: interpolateColor(flash.get(), [0, 1], [open ? gold : goldLine, gold]),
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
        minHeight: 44,
        borderRadius: 999,
        backgroundColor: pressed ? withAlphaHex(t.bone, 0.12) : "transparent",
      })}
    >
      {/* What is on the table when it opens appears; it does not slide or fade in. */}
      <LayoutAnimationConfig skipEntering>
        <Animated.View
          style={[
            {
              flexShrink: 1,
              alignItems: "center",
              borderWidth: 1,
              borderRadius: 20,
              paddingHorizontal: 10,
              paddingVertical: 3,
              backgroundColor: withAlphaHex(t.night, 0.78),
              boxShadow: `inset 0 1px 0 ${withAlphaHex(t.lit, 0.06)}, 0 2px 10px ${withAlphaHex(t.night, 0.45)}`,
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
              {wide && rail.phase ? <Neighbor side="previous" name={rail.previousPhase} /> : null}
              {rail.phase ? (
                <Text
                  testID="rail-phase"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  className="font-display-bold uppercase text-gold"
                  style={{
                    // 14 pt: top-bar-layout.ts counts the pill's floor from this size and Cinzel Bold's capitals.
                    fontSize: 14,
                    lineHeight: 20,
                    textShadowColor: t.glow,
                    textShadowRadius: 8,
                    textShadowOffset: { width: 0, height: 0 },
                  }}
                >
                  {rail.phase}
                </Text>
              ) : null}
              {wide && rail.phase ? <Neighbor side="next" name={rail.nextPhase} /> : null}
              {/* The S stands at the end of the top line, in the room the floor keeps. */}
              {stopAhead ? (
                <Text testID="rail-stop-ahead" accessibilityLabel={STOP_AHEAD_WORDS} className="font-display-bold text-label text-gold" style={{ marginLeft: 4, lineHeight: 20 }}>
                  S
                </Text>
              ) : null}
            </View>
          ) : null}
          <Animated.View key={rail.current} entering={step.in} exiting={step.out}>
            <Text testID="rail-current" numberOfLines={1} className="text-label" style={{ color: withAlphaHex(t.bone, 0.85), lineHeight: 16 }}>
              {rail.current}
            </Text>
          </Animated.View>
        </Animated.View>
      </LayoutAnimationConfig>
    </Pressable>
  );
}
