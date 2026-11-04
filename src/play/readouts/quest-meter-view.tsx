// The quest meter in the command column's head (docs/design-system-table.md, Quest scale): the threat in the staging area and the willpower
// committed as two bars from one baseline, their heights in proportion to the larger of the two, with how far ahead or short the quest is
// between them ("+2" in green, "−1" in red, or Even) and a line across the willpower bar at the threat's height. The bars rise and fall to
// each new value (`meterFill`); reduced motion snaps them. It moves live as characters are committed (quest-scale.ts); the numbers are the
// engine's. It is mounted only in the Quest phase (command-head-view.tsx), its bars starting at their values. A screen reader
// hears one line: the threat in staging, the willpower committed and how far ahead or short it is, so it is never read as the player's own threat.
// A tap on it lists the cards that make up the threat (`onPress`; threat-sources.ts); the pressed meter dims.
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";

import { MOTION } from "../../ui/motion-tokens.ts";
import { timing, useMotionScale } from "../../ui/motion-run.ts";
import { meterFractions, scaleLabel, scaleMarker, stagingWord, type QuestScale } from "./quest-scale.ts";
import { Text } from "../../ui/text.tsx";
import { withAlphaHex } from "../../ui/tokens.ts";
import { useUiScale } from "../../ui/ui-scale.ts";
import { useTableTokens } from "../../ui/use-table-tokens.ts";

// A bar's fill (0..1) that eases to each new value, or snaps under reduced motion; its animation is cancelled when the meter leaves.
function useFill(target: number): SharedValue<number> {
  const speed = useMotionScale();
  const fill = useSharedValue(target);
  useEffect(() => {
    if (speed === 0) fill.set(target);
    else fill.set(withTiming(target, timing(MOTION.meterFill, speed)));
  }, [target, speed, fill]);
  useEffect(() => () => cancelAnimation(fill), [fill]);
  return fill;
}

function markerColor(tone: "ok" | "danger" | "muted", t: ReturnType<typeof useTableTokens>): string {
  if (tone === "ok") return t.ok;
  return tone === "danger" ? t.danger : t.muted;
}

const NUMBER = 24;
const CAPTION = 14;

/** The full meter: two vertical bars in `height` points. */
function FullMeter({ scale, height }: { scale: QuestScale; height: number }) {
  const t = useTableTokens();
  const s = useUiScale();
  const marker = scaleMarker(scale.delta);
  const even = marker.word === "Even";
  const share = meterFractions(scale);
  const threatFill = useFill(share.threat);
  const willFill = useFill(share.willpower);
  const lineFill = useFill(share.line);
  const threatStyle = useAnimatedStyle(() => ({ height: `${threatFill.get() * 100}%` }));
  const willStyle = useAnimatedStyle(() => ({ height: `${willFill.get() * 100}%` }));
  const lineStyle = useAnimatedStyle(() => ({ bottom: `${lineFill.get() * 100}%` }));
  const track = { width: 40 * s, borderRadius: 8 * s, backgroundColor: withAlphaHex(t.bone, 0.08), overflow: "hidden" as const };
  const bar = { position: "absolute" as const, left: 0, right: 0, bottom: 0 };
  return (
    <View className="flex-row justify-center" style={{ height, gap: 12 * s }}>
      <View testID="quest-meter-threat" className="items-center" style={{ width: 64 * s }}>
        <Text className="font-display" style={{ height: NUMBER * s, fontSize: 20 * s, lineHeight: NUMBER * s, color: t.bone }}>
          {String(scale.threat)}
        </Text>
        <View className="min-h-0 flex-1" style={track}>
          <Animated.View style={[bar, threatStyle, { backgroundColor: t.threat, backgroundImage: `linear-gradient(0deg, ${t.threatEdge}, ${t.threat})` }]} />
        </View>
        <Text className="text-micro" numberOfLines={1} style={{ height: CAPTION * s, color: t.muted }}>
          {stagingWord(scale)}
        </Text>
      </View>
      {/* How far apart they are, level with the middle of the bars. */}
      <View className="items-center" style={{ width: 44 * s }}>
        <View style={{ height: NUMBER * s }} />
        <View className="min-h-0 flex-1 items-center justify-center">
          <Text testID="quest-meter-marker" className="font-display" style={{ fontSize: (even ? 15 : 22) * s, lineHeight: (even ? 18 : 26) * s, color: markerColor(marker.tone, t) }}>
            {even ? marker.word : marker.value}
          </Text>
        </View>
        <View style={{ height: CAPTION * s }} />
      </View>
      <View testID="quest-meter-willpower" className="items-center" style={{ width: 64 * s }}>
        <Text className="font-display" style={{ height: NUMBER * s, fontSize: 20 * s, lineHeight: NUMBER * s, color: t.bone }}>
          {String(scale.willpower)}
        </Text>
        <View className="min-h-0 flex-1 items-center" style={{ width: 40 * s }}>
          <View style={[track, { flex: 1 }]}>
            <Animated.View style={[bar, willStyle, { backgroundColor: t.accent, backgroundImage: `linear-gradient(0deg, ${t.accentDeep}, ${t.accent})` }]} />
          </View>
          {/* The threat's height across the willpower bar, so the gap reads at a glance. */}
          <Animated.View style={[{ position: "absolute", left: -6 * s, right: -6 * s, height: 2 * s, borderRadius: s, backgroundColor: t.bone }, lineStyle]} />
        </View>
        <Text className="text-micro" numberOfLines={1} style={{ height: CAPTION * s, color: t.muted }}>
          willpower
        </Text>
      </View>
    </View>
  );
}

function CompactRow({ fill, color, edge, word, value, trailing, trailingColor }: { fill: SharedValue<number>; color: string; edge: string; word: string; value: string; trailing: string | null; trailingColor: string }) {
  const t = useTableTokens();
  const s = useUiScale();
  const style = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));
  return (
    <View className="flex-1 flex-row items-center" style={{ gap: 6 * s, maxHeight: 24 * s }}>
      <Text className="text-micro" numberOfLines={1} style={{ width: 62 * s, color: t.muted }}>
        {word}
      </Text>
      <View className="flex-1" style={{ height: 8 * s, borderRadius: 4 * s, backgroundColor: withAlphaHex(t.bone, 0.08), overflow: "hidden" }}>
        <Animated.View style={[{ height: "100%", backgroundColor: color, backgroundImage: `linear-gradient(90deg, ${edge}, ${color})` }, style]} />
      </View>
      <Text className="font-display" style={{ width: 24 * s, textAlign: "right", fontSize: 16 * s, lineHeight: 20 * s, color: t.bone }}>
        {value}
      </Text>
      <Text className="font-display" numberOfLines={1} style={{ width: 40 * s, fontSize: 16 * s, lineHeight: 20 * s, color: trailingColor }}>
        {trailing ?? ""}
      </Text>
    </View>
  );
}

/** The compact meter: the same two values as short horizontal bars with their numbers, in `height` points. */
function CompactMeter({ scale, height }: { scale: QuestScale; height: number }) {
  const t = useTableTokens();
  const marker = scaleMarker(scale.delta);
  const share = meterFractions(scale);
  const threatFill = useFill(share.threat);
  const willFill = useFill(share.willpower);
  const even = marker.word === "Even";
  return (
    <View style={{ height }}>
      <CompactRow fill={threatFill} color={t.threat} edge={t.threatEdge} word={stagingWord(scale)} value={String(scale.threat)} trailing={null} trailingColor={t.muted} />
      <CompactRow fill={willFill} color={t.accent} edge={t.accentDeep} word="willpower" value={String(scale.willpower)} trailing={even ? "Even" : marker.value} trailingColor={markerColor(marker.tone, t)} />
    </View>
  );
}

export function QuestMeterView({ scale, compact, height, onPress }: { scale: QuestScale; compact: boolean; height: number; onPress?: () => void }) {
  return (
    <Pressable
      testID="quest-meter"
      disabled={!onPress}
      onPress={onPress}
      accessible
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={scaleLabel(scale)}
      accessibilityHint={onPress ? "Shows the cards that make up the threat" : undefined}
      style={({ pressed }) => ({ height, opacity: pressed ? 0.7 : 1 })}
    >
      {compact ? <CompactMeter scale={scale} height={height} /> : <FullMeter scale={scale} height={height} />}
    </Pressable>
  );
}
