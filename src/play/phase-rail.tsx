// The phase rail in the top bar's middle (docs/design-system.md, Table; phase 20): the phase in Marcellus SC over the round's seven
// phases as ticks over the round and the step, with the previous and next phase inline at the phase's sides when there is room. A tap opens the
// phase carousel (phase-carousel.tsx); the rail itself sends no intent. A phase change flashes the pill's edge, a step change
// cross-fades the step (MOTION.railFlash, railStep); both snap under reduced motion and never gate a rule. The neighbor names do not
// move: they change in place.
import { useEffect, useMemo, useRef } from "react";
import { Platform, Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut, LayoutAnimationConfig, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { STOP_AHEAD_WORDS } from "./carousel.ts";
import { layoutAnim, timing, useMotionScale } from "./motion-run.ts";
import { MOTION } from "./motion-tokens.ts";
import { withAlphaHex } from "./tokens.ts";
import { touch, useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { ROUND_PHASES, type Rail } from "./rail.ts";
import { CHEVRON, NEIGHBOR_GAP, STOP_MARK, TICK, TICK_GAP } from "./top-bar-layout.ts";
import { Text } from "./text.tsx";


/** A chevron drawn as two edges of a rotated square: no printed icon fits, and a glyph depends on the font. */
export function Chevron({ direction, color }: { direction: "previous" | "next" | "up" | "down"; color?: string }) {
  const t = useTableTokens();
  const s = useUiScale();
  const turn = {
    next: "45deg",
    previous: "225deg",
    down: "135deg",
    up: "315deg",
  }[direction];
  return (
    <View
      style={{
        width: CHEVRON * s,
        height: CHEVRON * s,
        alignItems: "center",
        justifyContent: "center",
      }}
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={{
          width: 8 * s,
          height: 8 * s,
          borderTopWidth: 1.5 * s,
          borderRightWidth: 1.5 * s,
          borderColor: color ?? t.muted,
          transform: [{ rotate: turn }],
        }}
      />
    </View>
  );
}

// A neighbor phase's name, inline at the phase's side in muted label. Plain text: it neither slides nor fades.
function Neighbor({ side, name, s }: { side: "previous" | "next"; name: string; s: number }) {
  if (!name) return null;
  return (
    <Text
      testID={`rail-${side}`}
      numberOfLines={1}
      importantForAccessibility="no"
      className="text-micro text-faint"
      style={side === "previous" ? { lineHeight: 20 * s, marginRight: NEIGHBOR_GAP * s } : { lineHeight: 20 * s, marginLeft: NEIGHBOR_GAP * s }}
    >
      {name}
    </Text>
  );
}

/**
 * The rail (docs/design-system.md, Table): the phase in Marcellus SC, tracked wide with a silver glow; under it the round's seven
 * phases as ticks, the past ones dim green, the current one lit and glowing, the ones to come dark; and "Round 3 · Staging" under
 * those. `wide` puts the previous and next phase inline at the phase's sides; `shortRound` (a phone under 760 pt inside the insets)
 * says "R3" for the round. `stopAhead` puts an accent S after the phase. No pill and no edge: a tap anywhere on it calls `onPress`
 * (the carousel opens or closes), and a phase change flashes the phase's glow.
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
  const s = useUiScale();
  const step = useMemo(() => ({ in: layoutAnim(FadeIn, MOTION.railStep, scale), out: layoutAnim(FadeOut, MOTION.railStep, scale) }), [scale]);
  const flash = useSharedValue(0);
  const lastPhase = useRef(rail.phase);
  useEffect(() => {
    if (lastPhase.current === rail.phase) return;
    lastPhase.current = rail.phase;
    if (scale > 0) flash.set(withSequence(withTiming(1, timing(MOTION.railFlashIn, scale)), withTiming(0, timing(MOTION.railFlashOut, scale))));
  }, [rail.phase, scale, flash]);
  const glow = useAnimatedStyle(() => ({ opacity: 0.55 + 0.45 * flash.get() }));
  const round = rail.round > 0 ? (shortRound ? `R${rail.round}` : `Round ${rail.round}`) : "";
  const at = ROUND_PHASES.findIndex((phase) => phase.toLowerCase() === rail.phase.toLowerCase());
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
        alignItems: "center",
        justifyContent: "center",
        minHeight: touch(s, 44),
        borderRadius: 10 * s,
        backgroundColor: pressed || open ? withAlphaHex(t.bone, 0.08) : "transparent",
      })}
    >
      {/* What is on the table when it opens appears; it does not slide or fade in. */}
      <LayoutAnimationConfig skipEntering>
        {/* The phase stands on the rail's middle (user request, 2026-10-29): the neighbor phases sit in equal slots at its sides, and the
            S keeps its room on both sides of it. */}
        <View style={{ alignSelf: "stretch", flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
          {wide && rail.phase ? (
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Neighbor side="previous" name={rail.previousPhase} s={s} />
            </View>
          ) : null}
          {rail.phase ? (
            // iOS tracks after the last letter too; Android splits the tracking round each letter.
            <View style={{ paddingLeft: (STOP_MARK + (Platform.OS === "ios" ? 4 : 0)) * s, paddingRight: STOP_MARK * s }}>
              <Animated.View pointerEvents="none" style={[{ position: "absolute", left: -8 * s, right: -8 * s, top: 2 * s, bottom: 2 * s, borderRadius: 12 * s, backgroundImage: `radial-gradient(50% 50% at 50% 50%, ${withAlphaHex(t.glow, 0.22)}, ${withAlphaHex(t.glow, 0)})` }, glow]} />
              <Text
                testID="rail-phase"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                className="font-display"
                style={{
                  // 17 pt tracked 4: top-bar-layout.ts counts the rail's floor from this size and Marcellus SC's letters.
                  fontSize: 17 * s,
                  lineHeight: 21 * s,
                  letterSpacing: 4 * s,
                  color: t.bone,
                  ...(t.depth === "light" ? {} : { textShadowColor: withAlphaHex(t.glow, 0.8), textShadowRadius: 10 * s, textShadowOffset: { width: 0, height: 0 } }),
                }}
              >
                {rail.phase}
              </Text>
              {/* The S stands after the phase, in the room the floor keeps. */}
              {stopAhead ? (
                <Text testID="rail-stop-ahead" accessibilityLabel={STOP_AHEAD_WORDS} className="font-display text-label text-accent" style={{ position: "absolute", right: 0, width: (STOP_MARK - 4) * s, lineHeight: 21 * s }}>
                  S
                </Text>
              ) : null}
            </View>
          ) : null}
          {wide && rail.phase ? (
            <View style={{ flex: 1, alignItems: "flex-start" }}>
              <Neighbor side="next" name={rail.nextPhase} s={s} />
            </View>
          ) : null}
        </View>
        {/* The round's seven phases: past, current, to come. */}
        <View testID="rail-ticks" importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", gap: TICK_GAP * s, marginTop: 3 * s }}>
          {ROUND_PHASES.map((phase, index) => {
            const past = at >= 0 ? index < at : rail.phase === "End";
            const current = index === at;
            return (
              <View
                key={phase}
                style={{
                  width: TICK * s,
                  height: 3 * s,
                  borderRadius: 1.5 * s,
                  backgroundColor: current ? t.accentHigh : past ? t.accentLine : withAlphaHex(t.bone, 0.12),
                  ...(current ? { boxShadow: `0 0 8px ${withAlphaHex(t.glow, 0.8)}` } : {}),
                }}
              />
            );
          })}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 * s }}>
          {round ? (
            <Text testID="rail-round" numberOfLines={1} className="text-micro" style={{ color: t.faint, lineHeight: 14 * s }}>
              {`${round}${rail.current ? " · " : ""}`}
            </Text>
          ) : null}
          <Animated.View key={rail.current} entering={step.in} exiting={step.out}>
            <Text testID="rail-current" numberOfLines={1} className="text-micro" style={{ color: t.muted, lineHeight: 14 * s }}>
              {rail.current}
            </Text>
          </Animated.View>
        </View>
      </LayoutAnimationConfig>
    </Pressable>
  );
}
