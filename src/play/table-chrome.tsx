// The table's top bar pieces: the threat rings, and the mark beside a log line (the phase rail is phase-rail.tsx). These are React Native
// text with testIDs, so Maestro can read them; card pictures stay on the canvas (docs/design-system-table.md). Phase
// changes animate with Reanimated, never gate a rule, and snap under reduced motion. Nothing here holds a number the engine
// did not compute.
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";

// Split by platform (Skia on a phone, CSS on the web), so imported without its extension.
import { ArcRing } from "./arc-ring";
import { GameIcon } from "./game-icon.tsx";
import type { IconName } from "./icon-map.ts";
import type { LogMark } from "./log.ts";
import { layoutAnim, springConfig, timing, useMotionScale } from "./motion-run.ts";
import { MOTION, SHAPE } from "./motion-tokens.ts";
import { HEADING_HINT, headingArcs, headingDelta, headingDeltaWords, headingLook, headingWords, type HeadingStep } from "./heading.ts";
import { dialName, type DialRole } from "./peek.ts";
import type { SeatThreat } from "./selectors.ts";
import { threatDelta, threatDeltaWords, threatLevel, threatMeter, type ThreatLevel } from "./threat-level.ts";
import { withAlphaHex, type TableTokens } from "./tokens.ts";
import { badgeFoot, DIAL_SIZE, HEADING_BADGE_OVER, HEADING_LABEL_W } from "./top-bar-layout.ts";
import { touch, useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

// How long the change badge stays beside the dial; the banner and the log say it too.
const DELTA_MS = 3000;
// The dial's diameter at Medium: a ring of threat red round a dark disc (docs/design-system-table.md).
const DIAL = DIAL_SIZE;

// The dial's edge and fill at each level (threat-level.ts): threat red, tinted near elimination, solid when critical.
const dialOf = (t: TableTokens): Record<ThreatLevel, { edge: string; fill: string; meter: string }> => ({
  calm: { edge: t.threat, fill: t.night, meter: t.threat },
  near: { edge: t.danger, fill: t.night, meter: t.danger },
  critical: { edge: t.threatEdge, fill: t.threat, meter: t.onThreat },
});

/**
 * The threat dial of the top bar (`compact`): a round dial, the number alone in Marcellus SC on a dark disc, ringed by
 * an arc of threat red that fills toward 50, the elimination level, with a tick at each staging enemy's engagement cost. It warms near elimination,
 * pops when the number changes, and shows the change ("−6" in accent when it fell, "+2" in threat red when it rose) for three
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
  role = null,
  hint = null,
  elimination = true,
  ticks = [],
  ring = null,
  ringMark = "oneRing",
  onPress,
}: {
  threat: SeatThreat;
  label: string;
  testID?: string;
  icon?: IconName | null;
  compact?: boolean;
  // What a screen reader says for a short label ("P1" reads "Player 1 threat").
  accessibilityName?: string;
  // How the dial reads in two-handed play (peek.ts, `seatDial`). "acting", the seat the engine is asking: an accent label, and the dial pulses
  // when the engine turns to it. "viewing", the seat the player is peeking at, which is not the acting one: a bone ring round the dial
  // and a small eye mark. Both are in the screen reader's name. null: neither, and every dial of a solo game.
  role?: DialRole;
  // What a tap does when it is not the threat panel ("Shows Player 2's cards"); null keeps the panel's hint.
  hint?: string | null;
  elimination?: boolean;
  // The engagement costs of the enemies in staging, marked on the meter (rr.engagement-check): those the threat has reached
  // engage at the checks.
  ticks?: readonly number[];
  // The seat that holds the Ring-bearer facedown: a small Ring mark beside its label, and these words in its accessibility label.
  ring?: string | null;
  // The mark beside the label when `ring` is set: the One Ring (the Ring-bearer facedown), a hero (the prisoner).
  ringMark?: "oneRing" | "hero";
  // A tap opens the threat panel (each enemy's cost against the threat), or peeks at the seat (a dial that is not shown).
  onPress?: () => void;
}) {
  const s = useUiScale();
  const id = testID ?? `threat-${threat.seat}`;
  if (compact) return <ThreatDial threat={threat} label={label} id={id} icon={icon} name={accessibilityName ?? label} role={role} hint={hint} elimination={elimination} ticks={ticks} ring={ring} ringMark={ringMark} onPress={onPress} />;
  return (
    <View testID={id} accessible accessibilityLabel={`${label} ${threat.threat}`} className="items-center">
      <View className="h-12 w-12 items-center justify-center rounded-control">
        <Text testID={`${id}-value`} className="font-display text-title text-bone">
          {String(threat.threat)}
        </Text>
      </View>
      <View className="mt-0.5 flex-row items-center gap-1">
        {icon ? <GameIcon name={icon} size={12 * s} tint="muted" /> : null}
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
  role,
  hint,
  elimination,
  ticks,
  ring,
  ringMark,
  onPress,
}: {
  threat: SeatThreat;
  label: string;
  id: string;
  icon: IconName | null;
  name: string;
  role: DialRole;
  hint: string | null;
  elimination: boolean;
  ticks: readonly number[];
  ring: string | null;
  ringMark: "oneRing" | "hero";
  onPress?: () => void;
}) {
  const speed = useMotionScale();
  const t = useTableTokens();
  const s = useUiScale();
  const badge = useMemo(() => ({ in: layoutAnim(FadeIn, MOTION.threatBadgeIn, speed), out: layoutAnim(FadeOut, MOTION.threatBadgeOut, speed) }), [speed]);
  const level = elimination ? threatLevel(threat.threat) : "calm";
  const look = threat.eliminated ? { edge: t.hairline, fill: t.night, meter: t.hairline } : elimination ? dialOf(t)[level] : { edge: t.accent, fill: t.night, meter: t.accent };
  // The change since the number last moved, shown beside the dial for DELTA_MS. A new change replaces it.
  const seen = useRef(threat.threat);
  const [change, setChange] = useState<{ before: number; after: number; at: number } | null>(null);
  const scale = useSharedValue(1);
  useEffect(() => {
    const before = seen.current;
    seen.current = threat.threat;
    if (before === threat.threat) return;
    setChange({ before, after: threat.threat, at: Date.now() });
    if (speed > 0) scale.set(withSequence(withTiming(SHAPE.dialPop, timing(MOTION.dialPopRise, speed)), withSpring(1, springConfig(MOTION.dialPopSettle, speed))));
  }, [threat.threat, speed, scale]);
  // The seat that is asked turns active in two-handed play: its dial pulses once in an accent ring (1 to 1.12 and back).
  const active = role === "acting";
  const wasActive = useRef(active);
  const pulse = useSharedValue(0);
  useEffect(() => {
    const was = wasActive.current;
    wasActive.current = active;
    if (!active || was || speed === 0) return;
    pulse.set(withSequence(withTiming(1, timing(MOTION.seatPulseHalf, speed)), withTiming(0, timing(MOTION.seatPulseHalf, speed))));
  }, [active, speed, pulse]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: pulse.get(), transform: [{ scale: 1 + (SHAPE.seatPulse - 1) * pulse.get() }] }));
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
  const dialWords = `${role ? `${dialName(name, role)},` : name} ${threat.threat}${threat.eliminated ? ", eliminated" : critical ? ", near elimination" : ""}${tickWords}${ring ? `. ${ring}` : ""}${deltaWords ? `. ${deltaWords}` : ""}`;
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessible
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={dialWords}
      accessibilityHint={onPress ? (hint ?? "Shows each enemy's engagement cost against your threat") : undefined}
      style={({ pressed }) => ({ minHeight: touch(s, 44), flexDirection: "row", alignItems: "center", gap: 6 * s, paddingHorizontal: 4 * s, borderRadius: 999, backgroundColor: pressed ? withAlphaHex(t.bone, 0.12) : "transparent" })}
    >
      <Animated.View style={pop}>
        <View testID={id} style={{ width: DIAL * s, height: DIAL * s, borderRadius: (DIAL / 2) * s, boxShadow: threat.eliminated ? undefined : `0 0 22px ${withAlphaHex(t.threat, critical ? 0.6 : 0.4)}` }}>
          {/* The threat's share of 50, the elimination level, as an arc round the dial (rr.threat-elimination-level). */}
          <ArcRing size={DIAL * s} stroke={4 * s} parts={elimination && !threat.eliminated ? [{ key: "threat", share: threatMeter(threat.threat), color: look.meter }] : []} track={withAlphaHex(t.threat, 0.16)}>
            <View
              className="items-center justify-center"
              style={{
                width: (DIAL - 8) * s,
                height: (DIAL - 8) * s,
                borderRadius: ((DIAL - 8) / 2) * s,
                backgroundColor: look.fill,
                backgroundImage: critical ? undefined : `radial-gradient(circle, ${withAlphaHex(t.threat, 0.28)}, ${withAlphaHex(t.night, 0.92)})`,
              }}
            >
              <Text testID={`${id}-value`} className="font-display" style={{ fontSize: 20 * s, lineHeight: 24 * s, color: critical ? t.onThreat : t.depth === "light" ? t.bone : t.onThreat }}>
                {String(threat.threat)}
              </Text>
              {icon && icon !== "threat" ? <GameIcon name={icon} size={9 * s} tint="danger" /> : null}
            </View>
          </ArcRing>
          {/* A tick on the ring at each staging enemy's engagement cost: bone where the threat has reached it, faint where not yet. */}
          {elimination && !threat.eliminated
            ? ticks.map((cost, index) => {
                const angle = threatMeter(cost) * 2 * Math.PI - Math.PI / 2;
                const r = (DIAL / 2 - 2) * s;
                return (
                  <View
                    key={`${cost}:${index}`}
                    pointerEvents="none"
                    style={{ position: "absolute", left: (DIAL / 2) * s + r * Math.cos(angle) - 1.5 * s, top: (DIAL / 2) * s + r * Math.sin(angle) - 1.5 * s, width: 3 * s, height: 3 * s, borderRadius: 1.5 * s, backgroundColor: cost <= threat.threat ? t.bone : t.faint }}
                  />
                );
              })
            : null}
        </View>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 999, borderWidth: 2 * s, borderColor: t.accent }, ringStyle]} />
        {/* Peeking at this seat: a bone ring just outside the dial and an eye on its corner, clear of the label and its Ring mark. */}
        {role === "viewing" ? (
          <>
            <View testID={`${id}-viewing`} pointerEvents="none" style={{ position: "absolute", top: -2 * s, left: -3 * s, right: -3 * s, bottom: -2 * s, borderRadius: 999, borderWidth: 1.5 * s, borderColor: t.bone }} />
            <EyeMark testID={`${id}-eye`} s={s} />
          </>
        ) : null}
      </Animated.View>
      <View className="items-start gap-0.5">
        <View className="flex-row items-center gap-1">
          {/* A seat's label (P1) and Life or Burden stand beside their dials; the lone threat dial is a number and is named "Threat" to a screen reader. */}
          {label === "Threat" && icon === "threat" ? null : <Text className={`text-label ${role === "acting" ? "text-accent" : role === "viewing" ? "text-bone" : "text-muted"}`}>{label}</Text>}
          {ring ? (
            <View testID={`${id}-ring`}>
              <GameIcon name={ringMark} size={12 * s} tint={ringMark === "oneRing" ? "accent" : "bone"} />
            </View>
          ) : null}
        </View>
      </View>
      {/* The change badge floats over the disc's foot and takes no room, so the dial's row never changes height when it comes and goes; it ends inside the bar's foot (badgeFoot). */}
      {delta ? (
        <View pointerEvents="none" style={{ position: "absolute", zIndex: 1, bottom: -badgeFoot(s), left: 4 * s, width: DIAL * s, alignItems: "center" }}>
          <Animated.View
            key={change?.at}
            entering={badge.in}
            exiting={badge.out}
            style={{ borderRadius: 999, paddingHorizontal: 6 * s, backgroundColor: withAlphaHex(delta.lowered ? t.accent : t.threat, 0.22) }}
          >
            <Text testID={`${id}-delta`} numberOfLines={1} className="font-display text-label text-bone">
              {delta.text}
            </Text>
          </Animated.View>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * The Heading dial of the top bar (dcce.heading), while the Heading card is in play: the Life dial's frame (46 pt, no number), the current step's icon in the disc, and a ring of four
 * quarter arcs lit clockwise from the top (Sun four, Cloud three, Rain two, Storm one). Sun is the accent, Cloud and Rain bone, Storm threat red on a filled disc; the icon's shape and the
 * arcs carry the step without the colour. A shift pops the dial as the threat dial pops and says the change for three seconds ("Toward Sun", "Toward Storm"); reduced motion keeps it still and
 * shows the badge. A tap opens the Heading card's preview and never changes the dial. The engine owns the step. `compact` (the bar scrolls) drops the "Heading" word, which the spoken label keeps,
 * and lays the badge under the disc; otherwise the label column is as wide as its widest word, so the dial's width never moves.
 */
export function HeadingDial({ step, compact = false, onPress }: { step: HeadingStep; compact?: boolean; onPress?: () => void }) {
  const speed = useMotionScale();
  const t = useTableTokens();
  const s = useUiScale();
  const badge = useMemo(() => ({ in: layoutAnim(FadeIn, MOTION.threatBadgeIn, speed), out: layoutAnim(FadeOut, MOTION.threatBadgeOut, speed) }), [speed]);
  const look = headingLook(step);
  const color = t[look.tone];
  const seen = useRef(step);
  const [change, setChange] = useState<{ before: HeadingStep; after: HeadingStep; at: number } | null>(null);
  const scale = useSharedValue(1);
  useEffect(() => {
    const before = seen.current;
    seen.current = step;
    if (before === step) return;
    setChange({ before, after: step, at: Date.now() });
    if (speed > 0) scale.set(withSequence(withTiming(SHAPE.dialPop, timing(MOTION.dialPopRise, speed)), withSpring(1, springConfig(MOTION.dialPopSettle, speed))));
  }, [step, speed, scale]);
  useEffect(() => {
    if (!change) return;
    const timer = setTimeout(() => setChange(null), DELTA_MS);
    return () => clearTimeout(timer);
  }, [change]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const delta = change ? headingDelta(change.before, change.after) : null;
  const deltaWords = change ? headingDeltaWords(change.before, change.after) : null;
  const words = `${headingWords(step)}${deltaWords ? `. ${deltaWords}` : ""}`;
  const badgeOf = delta ? (
    <Animated.View key={change?.at} entering={badge.in} exiting={badge.out} style={{ borderRadius: 999, paddingHorizontal: (compact ? 4 : 6) * s, backgroundColor: withAlphaHex(delta.towardSun ? t.accent : t.threat, 0.22) }}>
      <Text testID="heading-delta" numberOfLines={1} className="font-display text-label text-bone">
        {delta.text}
      </Text>
    </Animated.View>
  ) : null;
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessible
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={words}
      accessibilityHint={onPress ? HEADING_HINT : undefined}
      style={({ pressed }) => ({ minHeight: touch(s, 44), flexDirection: "row", alignItems: "center", gap: 6 * s, paddingHorizontal: 4 * s, borderRadius: 999, backgroundColor: pressed ? withAlphaHex(t.bone, 0.12) : "transparent" })}
    >
      <Animated.View style={pop}>
        <View testID="heading" style={{ width: DIAL * s, height: DIAL * s, borderRadius: (DIAL / 2) * s }}>
          <ArcRing size={DIAL * s} stroke={4 * s} parts={headingArcs(step, color)} track={withAlphaHex(t.bone, 0.16)}>
            <View className="items-center justify-center" style={{ width: (DIAL - 8) * s, height: (DIAL - 8) * s, borderRadius: ((DIAL - 8) / 2) * s, backgroundColor: look.filled ? t.threat : t.night }}>
              <GameIcon name={look.icon} size={22 * s} tint={look.filled ? "onThreat" : look.tone} />
            </View>
          </ArcRing>
        </View>
        {/* The step's word, clear text a flow reads (as rail-current is); the icon and the arcs are what the player sees. */}
        <Text testID="heading-value" numberOfLines={1} pointerEvents="none" className="text-micro" style={{ position: "absolute", color: "transparent", lineHeight: 14 * s }}>
          {look.word}
        </Text>
      </Animated.View>
      {compact ? (
        // The badge lies over the disc's foot, centred, and reaches into the gap either side (HEADING_BADGE_OVER); it takes no touch.
        delta ? (
          <View pointerEvents="none" style={{ position: "absolute", zIndex: 1, bottom: -badgeFoot(s), left: (4 - HEADING_BADGE_OVER) * s, width: (DIAL + 2 * HEADING_BADGE_OVER) * s, alignItems: "center" }}>
            {badgeOf}
          </View>
        ) : null
      ) : (
        <View style={{ minWidth: HEADING_LABEL_W * s }}>
          <Text className="text-label text-muted">{look.label}</Text>
        </View>
      )}
      {/* Under the label, over what lies below, ending inside the bar's foot (badgeFoot); it takes no room, so the dial's row keeps its height. */}
      {!compact && delta ? (
        <View pointerEvents="none" style={{ position: "absolute", zIndex: 1, bottom: -badgeFoot(s), left: (4 + DIAL + 6) * s }}>
          {badgeOf}
        </View>
      ) : null}
    </Pressable>
  );
}

/** The mark of the seat being peeked at, drawn from views so it is crisp at any size: an almond outline with its pupil, on a night dot. */
function EyeMark({ testID, s }: { testID: string; s: number }) {
  const t = useTableTokens();
  return (
    <View testID={testID} pointerEvents="none" style={{ position: "absolute", top: -2 * s, right: -3 * s, width: 16 * s, height: 16 * s, borderRadius: 8 * s, backgroundColor: t.night, borderWidth: 1, borderColor: t.bone, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 11 * s, height: 6.5 * s, borderRadius: 6 * s, borderWidth: 1.25 * s, borderColor: t.bone, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 3 * s, height: 3 * s, borderRadius: 2 * s, backgroundColor: t.bone }} />
      </View>
    </View>
  );
}

/** A log or banner line's mark: the game icon for threat, willpower and attack, the token art for damage, progress, resources. */
export function LineMark({ mark, tint = "ink", size }: { mark: LogMark; tint?: "ink" | "bone"; size?: number }) {
  const s = useUiScale();
  // The default is Medium's 16 times the UI scale; a caller that passes a size has scaled it.
  if (size == null) size = 16 * s;
  if (!mark) return <View style={{ width: size }} />;
  if (mark === "threat" || mark === "willpower" || mark === "attack") return <GameIcon name={mark} size={size} tint={tint} />;
  return <GameIcon name={mark} size={size} />;
}
