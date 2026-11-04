// The phase rail in the top bar's middle (docs/design-system-table.md; phase 20): the phase in Marcellus SC over the round's seven
// phases as ticks, with the previous and next phase inline at the phase's sides when there is room. A tap opens the phase carousel
// (phase-carousel.tsx), which names the round; the rail itself sends no intent. A phase change brightens the phase's glow
// (MOTION.railFlash), which snaps under reduced motion and never gates a rule. The neighbor names do not move: they change in place.
// The round and the step are not drawn: the rail's screen reader label names them, and the carousel names the round (user request, 2026-10-31).
import { useEffect, useRef } from "react";
import { Platform, Pressable, View } from "react-native";
import Animated, { LayoutAnimationConfig, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

import { STOP_AHEAD_WORDS } from "./carousel.ts";
import { timing, useMotionScale } from "../../ui/motion-run.ts";
import { MOTION } from "../../ui/motion-tokens.ts";
import { withAlphaHex } from "../../ui/tokens.ts";
import { CONTROL_RADIUS } from "../../ui/radius.ts";
import { touch, useUiScale } from "../../ui/ui-scale.ts";
import { useTableTokens } from "../../ui/use-table-tokens.ts";
import { ROUND_PHASES, type Rail } from "./rail.ts";
import { NEIGHBOR_GAP, STOP_MARK, TICK, TICK_GAP } from "../chrome/top-bar-layout.ts";
import { Text } from "../../ui/text.tsx";


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
 * The rail (docs/design-system-table.md): the phase in Marcellus SC, tracked wide with a silver glow; under it the round's seven
 * phases as ticks, the past ones dim green, the current one lit and glowing, the ones to come dark. Setup and the mulligan have no
 * phase, so the step stands in its place. `wide` puts the previous and next phase inline at the phase's sides. `stopAhead` puts an
 * accent S after the phase. No pill and no edge: a tap anywhere on it calls `onPress` (the carousel opens or closes), and a phase change flashes the phase's glow.
 */
export function PhaseRail({
  rail,
  wide,
  stopAhead = false,
  open = false,
  onPress,
}: {
  rail: Rail;
  wide: boolean;
  stopAhead?: boolean;
  open?: boolean;
  onPress?: () => void;
}) {
  const scale = useMotionScale();
  const t = useTableTokens();
  const s = useUiScale();
  const flash = useSharedValue(0);
  const lastPhase = useRef(rail.phase);
  useEffect(() => {
    if (lastPhase.current === rail.phase) return;
    lastPhase.current = rail.phase;
    if (scale > 0) flash.set(withSequence(withTiming(1, timing(MOTION.railFlashIn, scale)), withTiming(0, timing(MOTION.railFlashOut, scale))));
  }, [rail.phase, scale, flash]);
  const glow = useAnimatedStyle(() => ({ opacity: 0.55 + 0.45 * flash.get() }));
  const round = rail.round > 0 ? `Round ${rail.round}` : "";
  // The headline is the phase; Setup and the mulligan have none, so their step takes its place.
  const head = rail.phase || rail.current;
  const at = ROUND_PHASES.findIndex((phase) => phase.toLowerCase() === rail.phase.toLowerCase());
  const label = [round, rail.phase, rail.current, stopAhead ? STOP_AHEAD_WORDS : ""].filter(Boolean).join(". ");
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
        borderRadius: CONTROL_RADIUS,
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
          {head ? (
            // iOS tracks after the last letter too; Android splits the tracking round each letter.
            <View style={{ paddingLeft: (STOP_MARK + (Platform.OS === "ios" ? 4 : 0)) * s, paddingRight: STOP_MARK * s }}>
              <Animated.View pointerEvents="none" style={[{ position: "absolute", left: -8 * s, right: -8 * s, top: 2 * s, bottom: 2 * s, borderRadius: CONTROL_RADIUS, backgroundImage: `radial-gradient(50% 50% at 50% 50%, ${withAlphaHex(t.glow, 0.22)}, ${withAlphaHex(t.glow, 0)})` }, glow]} />
              <Text
                testID={rail.phase ? "rail-phase" : "rail-current"}
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
                {head}
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
        {/* The round's seven phases: past, current, to come. Each line centers itself: the rail's own centering did not reach these on
            Android (user screenshot, 2026-10-29: the ticks and the round stood at the rail's left under a centered phase). */}
        <View testID="rail-ticks" importantForAccessibility="no-hide-descendants" style={{ alignSelf: "center", flexDirection: "row", gap: TICK_GAP * s, marginTop: 3 * s }}>
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
      </LayoutAnimationConfig>
    </Pressable>
  );
}
