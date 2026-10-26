// The table's top bar pieces: the phase rail and the threat rings, and the mark beside a log line. These are React Native
// text with testIDs, so Maestro can read them; card pictures stay on the canvas (docs/design-system.md, Table). Phase
// changes animate with Reanimated, never gate a rule, and snap under reduced motion. Nothing here holds a number the engine
// did not compute.
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";

import { GameIcon } from "./game-icon.tsx";
import type { IconName } from "./icon-map.ts";
import type { LogMark } from "./log.ts";
import type { Rail } from "./rail.ts";
import type { SeatThreat } from "./selectors.ts";
import { threatDelta, threatDeltaWords, threatLevel, threatMeter, type ThreatLevel } from "./threat-level.ts";
import { tableTokens as t } from "./tokens.ts";

export { ChromeButton, ChromePrimary } from "./sheet-paper.tsx";

const fade = FadeIn.duration(180).reduceMotion(ReduceMotion.System);
const badgeIn = FadeIn.duration(160).reduceMotion(ReduceMotion.System);
const badgeOut = FadeOut.duration(400).reduceMotion(ReduceMotion.System);
// How long the change badge stays beside the dial; the banner and the log say it too.
const DELTA_MS = 3000;

// A token at some opacity, so the palette drift test covers the dial's tint too.
function withAlphaHex(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}

// The dial's edge and fill at each level (threat-level.ts): threat red, tinted near elimination, solid when critical.
const DIAL: Record<ThreatLevel, { edge: string; fill: string; meter: string }> = {
  calm: { edge: t.threat, fill: t.night, meter: t.threat },
  near: { edge: t.danger, fill: withAlphaHex(t.threat, 0.35), meter: t.danger },
  critical: { edge: t.danger, fill: t.threat, meter: t.bone },
};

/**
 * Previous step, the current step in gold caps, the next step: one centered line; a tap opens the turn reference. `narrow` (a small
 * phone in landscape) keeps the current step alone, which may shrink a little to fit.
 */
export function PhaseRail({ rail, narrow = false, onPress }: { rail: Rail; narrow?: boolean; onPress?: () => void }) {
  // A tap opens the turn reference (reference.ts): the round as the Rules Reference charts it, and the stops.
  return (
    <Pressable
      testID="rail"
      accessible
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`Round ${rail.round}. ${rail.current}`}
      accessibilityHint={onPress ? "Opens the turn reference" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({ minWidth: 0, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 8, minHeight: 44, borderRadius: 999, backgroundColor: pressed ? withAlphaHex(t.bone, 0.12) : "transparent" })}
    >
      {narrow ? null : (
        <Text testID="rail-previous" numberOfLines={1} className="flex-1 text-right text-label text-muted">
          {rail.previous}
        </Text>
      )}
      {/* Until the phase carousel (phase 20) the round is "R3" before the step; the label says it in words. */}
      {narrow ? null : (
        <Text testID="rail-round" className="ml-2 text-label text-muted">
          {`R${rail.round}`}
        </Text>
      )}
      {/* With the turn reference behind it, the current step sits in a hairline pill: it reads as something to tap. */}
      <Animated.View
        key={rail.current}
        entering={fade}
        style={{ marginHorizontal: 12, flexShrink: 1, ...(onPress ? { borderWidth: 1, borderColor: t.hairline, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 } : {}) }}
      >
        <Text
          testID="rail-current"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          className="font-display text-body uppercase text-gold"
          style={{ textShadowColor: t.gold, textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 } }}
        >
          {rail.current}
        </Text>
      </Animated.View>
      {narrow ? null : (
        <Text testID="rail-next" numberOfLines={1} className="flex-1 text-label text-muted">
          {rail.next}
        </Text>
      )}
    </Pressable>
  );
}

/** The seats' threat in one line, for a panel's header: "Threat 28", or "Player 1 28 · Player 2 31". */
export function threatLine(threats: readonly SeatThreat[], life: number | null): string {
  const seats = threats.length > 1 ? threats.map((row) => `Player ${row.seat + 1} ${row.threat}`).join(" · ") : `Threat ${threats[0]?.threat ?? 0}`;
  return life != null ? `${seats} · Life ${life}` : seats;
}

/**
 * The threat dial of the top bar (`compact`): the threat icon and the number large in Marcellus on a threat-red pill, with a
 * meter along its foot that fills toward 50, the elimination level, and its label beside it. It warms near elimination,
 * pops when the number changes, and shows the change ("−6" in gold when it fell, "+2" in threat red when it rose) for three
 * seconds; reduced motion keeps it still. `elimination` false (Life) drops the meter and the levels. Elsewhere, a ring with
 * its label under it. The reducer is the only writer of the number.
 */
export function ThreatRing({
  threat,
  label,
  testID,
  icon = "threat",
  compact = false,
  accessibilityName,
  active = false,
  elimination = true,
  ticks = [],
  onPress,
}: {
  threat: SeatThreat;
  label: string;
  testID?: string;
  icon?: IconName | null;
  compact?: boolean;
  // What a screen reader says for a short label ("P1" reads "Player 1 threat").
  accessibilityName?: string;
  // The seat the table shows in two-handed play: its label is gold.
  active?: boolean;
  elimination?: boolean;
  // The engagement costs of the enemies in staging, marked on the meter (rr.engagement-check): those the threat has reached
  // engage at the checks.
  ticks?: readonly number[];
  // A tap opens the threat panel (each enemy's cost against the threat).
  onPress?: () => void;
}) {
  const id = testID ?? `threat-${threat.seat}`;
  if (compact) return <ThreatDial threat={threat} label={label} id={id} icon={icon} name={accessibilityName ?? label} active={active} elimination={elimination} ticks={ticks} onPress={onPress} />;
  return (
    <View testID={id} accessible accessibilityLabel={`${label} ${threat.threat}`} className="items-center">
      <View className="h-12 w-12 items-center justify-center rounded-pill" style={{ borderWidth: 2, borderColor: threat.eliminated ? t.hairline : t.gold }}>
        <Text testID={`${id}-value`} className="font-display text-title text-bone">
          {String(threat.threat)}
        </Text>
      </View>
      <View className="mt-0.5 flex-row items-center gap-1">
        {icon ? <GameIcon name={icon} size={12} tint="muted" /> : null}
        <Text className="text-label text-muted">{label}</Text>
      </View>
    </View>
  );
}

function ThreatDial({
  threat,
  label,
  id,
  icon,
  name,
  active,
  elimination,
  ticks,
  onPress,
}: {
  threat: SeatThreat;
  label: string;
  id: string;
  icon: IconName | null;
  name: string;
  active: boolean;
  elimination: boolean;
  ticks: readonly number[];
  onPress?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const level = elimination ? threatLevel(threat.threat) : "calm";
  const look = threat.eliminated ? { edge: t.hairline, fill: t.night, meter: t.hairline } : elimination ? DIAL[level] : { edge: t.gold, fill: t.night, meter: t.gold };
  // The change since the number last moved, shown beside the dial for DELTA_MS. A new change replaces it.
  const seen = useRef(threat.threat);
  const [change, setChange] = useState<{ before: number; after: number; at: number } | null>(null);
  const scale = useSharedValue(1);
  useEffect(() => {
    const before = seen.current;
    seen.current = threat.threat;
    if (before === threat.threat) return;
    setChange({ before, after: threat.threat, at: Date.now() });
    if (!reduceMotion) scale.set(withSequence(withTiming(1.22, { duration: 140 }), withSpring(1, { damping: 9, stiffness: 220 })));
  }, [threat.threat, reduceMotion, scale]);
  useEffect(() => {
    if (!change) return;
    const timer = setTimeout(() => setChange(null), DELTA_MS);
    return () => clearTimeout(timer);
  }, [change]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const delta = change ? threatDelta(change.before, change.after) : null;
  const deltaWords = change ? threatDeltaWords(name, change.before, change.after) : null;
  const critical = level === "critical" && !threat.eliminated;
  const engaging = ticks.filter((cost) => cost <= threat.threat).length;
  const tickWords = ticks.length === 0 ? "" : ticks.length === 1 ? `, the enemy in staging ${engaging === 1 ? "engages" : "does not engage"} at this threat` : `, ${engaging} of the ${ticks.length} enemies in staging engage at this threat`;
  // The dial is one control with one name (the change badge's words included), so Android gives it one focus stop.
  const dialWords = `${name} ${threat.threat}${threat.eliminated ? ", eliminated" : critical ? ", near elimination" : ""}${tickWords}${deltaWords ? `. ${deltaWords}` : ""}`;
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessible
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={dialWords}
      accessibilityHint={onPress ? "Shows each enemy's engagement cost against your threat" : undefined}
      style={({ pressed }) => ({ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4, borderRadius: 999, backgroundColor: pressed ? withAlphaHex(t.bone, 0.12) : "transparent" })}
    >
      <Animated.View style={pop}>
        <View
          testID={id}
          className="h-10 flex-row items-center gap-1 overflow-hidden rounded-pill px-2.5 pb-1"
          style={{ minWidth: 64, borderWidth: 2, borderColor: look.edge, backgroundColor: look.fill }}
        >
          {icon ? <GameIcon name={icon} size={18} tint={critical ? "bone" : "danger"} /> : null}
          <Text testID={`${id}-value`} className="font-display text-title text-bone">
            {String(threat.threat)}
          </Text>
          {elimination && !threat.eliminated ? (
            <View className="absolute overflow-hidden" style={{ left: 12, right: 12, bottom: 3, height: 3, borderRadius: 2, backgroundColor: withAlphaHex(t.bone, 0.16) }}>
              <View style={{ height: 3, width: `${Math.round(threatMeter(threat.threat) * 100)}%`, backgroundColor: look.meter }} />
              {/* A tick at each staging enemy's engagement cost: bone where the threat has reached it, faint where not yet. */}
              {ticks.map((cost, index) => (
                <View key={`${cost}:${index}`} style={{ position: "absolute", left: `${Math.round(threatMeter(cost) * 100)}%`, top: 0, width: 2, height: 3, backgroundColor: cost <= threat.threat ? t.bone : t.faint }} />
              ))}
            </View>
          ) : null}
        </View>
      </Animated.View>
      <View className="items-start gap-0.5">
        <Text className={`text-label ${active ? "text-gold" : "text-muted"}`}>{label}</Text>
        {delta ? (
          <Animated.View
            key={change?.at}
            entering={badgeIn}
            exiting={badgeOut}
            style={{ borderRadius: 999, paddingHorizontal: 6, borderWidth: 1, borderColor: delta.lowered ? t.gold : t.danger, backgroundColor: withAlphaHex(delta.lowered ? t.gold : t.threat, 0.22) }}
          >
            <Text testID={`${id}-delta`} className="font-display text-label text-bone">
              {delta.text}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </Pressable>
  );
}

/** A log or banner line's mark: the game icon for threat, willpower and attack, the token art for damage, progress, resources. */
export function LineMark({ mark, tint = "ink", size = 16 }: { mark: LogMark; tint?: "ink" | "bone"; size?: number }) {
  if (!mark) return <View style={{ width: size }} />;
  if (mark === "threat" || mark === "willpower" || mark === "attack") return <GameIcon name={mark} size={size} tint={tint} />;
  return <GameIcon name={mark} size={size} />;
}
