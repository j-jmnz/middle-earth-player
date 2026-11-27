// The table's top bar pieces: the threat rings, and the mark beside a log line (the phase rail is phase-rail.tsx). These are React Native
// text with testIDs, so tests can read them; card pictures stay on the canvas (docs/design-system-table.md). Phase
// changes animate with Reanimated, never gate a rule, and snap under reduced motion. Nothing here holds a number the engine
// did not compute.
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";

// Split by platform (Skia on a phone, CSS on the web), so imported without its extension.
import { ArcRing } from "../../ui/arc-ring";
import { useFocusRing } from "../../ui/focus-ring.ts";
import { GameIcon } from "../../ui/game-icon.tsx";
import type { IconName } from "../../ui/icon-map.ts";
import type { LogMark } from "../store/log.ts";
import { layoutAnim, springConfig, timing, useMotionScale } from "../../ui/motion-run.ts";
import { MOTION, SHAPE } from "../../ui/motion-tokens.ts";
import { HEADING_HINT, headingArcs, headingDelta, headingDeltaWords, headingLook, headingWords, type HeadingStep } from "../dream-chaser/heading.ts";
import { dialSpeech, type DialRole } from "../store/peek.ts";
import type { SeatThreat } from "../store/selectors.ts";
import { threatDelta, threatDeltaWords, threatLevel, threatMeter, threatSound, type ThreatLevel } from "../readouts/threat-level.ts";
import { playSound } from "../../ui/sound/sound.ts";
import { withAlphaHex, type TableToken, type TableTokens } from "../../ui/tokens.ts";
import { badgeFoot, CAPTION_LINE, CAPTION_OVER, CAPTION_PAD, captionOf, DIAL_PAD, DIAL_SIZE, HEADING_BADGE_OVER, HEADING_LABEL_W } from "./top-bar-layout.ts";
import { touch, useUiScale } from "../../ui/ui-scale.ts";
import { useTableTokens } from "../../ui/use-table-tokens.ts";
import { Text } from "../../ui/text.tsx";

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

const LEVELS: readonly ThreatLevel[] = ["calm", "near", "critical"];

// The dial's level and its colors (threat-level.ts). A dial that counts toward the elimination level or a limit that loses warms as it nears it; a goal dial (a way out) never warms; a dial that
// warns by its own rule (a hand of 1 or 0 on The Voice of Saruman) takes the worse of that level and its own. `own` is the level the number alone says.
function dialLook(t: TableTokens, dial: { threat: number; eliminated: boolean; elimination: boolean; goal: boolean; limit: number | undefined; warn: { level: "near" | "critical" } | undefined }) {
  const own: ThreatLevel = dial.elimination && !dial.goal ? threatLevel(dial.threat, dial.limit) : "calm";
  const level = dial.warn && LEVELS.indexOf(dial.warn.level) > LEVELS.indexOf(own) ? dial.warn.level : own;
  const look = dial.eliminated
    ? { edge: t.hairline, fill: t.night, meter: t.hairline }
    : dial.goal
      ? { edge: t.accent, fill: t.night, meter: t.accent }
      : dial.warn || dial.elimination
        ? dialOf(t)[level]
        : { edge: t.accent, fill: t.night, meter: t.accent };
  // The icon beside the number wears the ring's own meaning: a goal or a plain count in the accent (Rescued Villagers), a seat that is out muted, the danger tint where the dial counts toward a loss, on the solid threat red once critical.
  const tint: TableToken = dial.eliminated ? "muted" : dial.goal || !(dial.warn || dial.elimination) ? "accent" : level === "critical" ? "onThreat" : "danger";
  return { own, level, look, tint };
}

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
  captioned = false,
  short,
  accessibilityName,
  spokenWord,
  role = null,
  hint = null,
  elimination = true,
  ticks = [],
  ring = null,
  ringMark = "oneRing",
  limit,
  eliminates,
  filled,
  limitWords,
  goal,
  warn,
  note,
  notch,
  word,
  current,
  voiced,
  onPress,
}: {
  threat: SeatThreat;
  label: string;
  testID?: string;
  icon?: IconName | null;
  compact?: boolean;
  // A compact dial moves its name from beside the ring to a caption over the ring's foot while the bar's dials would scroll with the names beside them (the scenario dials: `captioned` in table/top-bar.tsx; `dialZones`).
  captioned?: boolean;
  // The caption's name when the label is too long for it (`captionOf`, play/chrome/top-bar-layout.ts).
  short?: string;
  // What a screen reader says for a short label ("P1" reads "Player 1 threat").
  accessibilityName?: string;
  // A seat's threat dial speaks its number first, as it is drawn ("Threat 20, P1, acting"; peek.ts, dialSpeech): the word before the number.
  // Other dials say their name and the number.
  spokenWord?: string;
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
  // The number at which the players lose, when it is not the elimination level (the pursuit dial, 30): the meter fills toward it, the dial warms near it, and the reader hears it. Needs `elimination`.
  limit?: number;
  // The limit is the elimination level of a Dire quest (99, mec113.dire): the reader hears "near elimination", not "near the limit".
  eliminates?: boolean;
  // The number the ring fills with when it is not the disc's: Saruman's gate shows his hit points left on the disc and fills the ring with the damage toward his hit points (`limit`).
  filled?: number;
  // What a screen reader hears of the limit ("the players lose at 30" when absent): the Defense dial's limit advances the stage instead (fortress.ts).
  limitWords?: string;
  // The limit is the players' way out, not a loss (the Defense dial): the ring fills toward it in the accent, and the dial never warms or says "near the limit".
  goal?: boolean;
  // A dial that warns by its own rule (a hand count of 1 or 0 on The Voice of Saruman, 143080:B:3): its level warms the dial as the elimination dial does, and these words are heard in place of "near elimination".
  warn?: { level: "near" | "critical"; words: string };
  // What a screen reader hears after the number and the limit: what the number is (Saruman's hit points left, the win gate).
  note?: string;
  // A threat value the ring marks with a short radial bar (the starting level stage 2B of The Passing of the Grey Company keeps the threat above), distinct from the engagement-cost dots.
  notch?: number;
  // The disc says this word in place of the number (the Day and Night dial: "Day"); the number only makes the dial pop when it changes, and no change badge is drawn.
  word?: string;
  // The dial of the stage the quest is at among several in play together (The Battle of Five Armies): an accent ring round it, so the mark needs no word. Its words are in `note`.
  current?: boolean;
  // A seat's threat dial: a change plays the threat's sound (threatSound). The other dials are silent.
  voiced?: boolean;
  // A tap opens the threat panel (each enemy's cost against the threat), or peeks at the seat (a dial that is not shown).
  onPress?: () => void;
}) {
  const s = useUiScale();
  const id = testID ?? `threat-${threat.seat}`;
  if (compact) return <ThreatDial threat={threat} label={label} id={id} icon={icon} name={accessibilityName ?? label} spokenWord={spokenWord} role={role} hint={hint} elimination={elimination} ticks={ticks} ring={ring} ringMark={ringMark} limit={limit} eliminates={eliminates} filled={filled} limitWords={limitWords} goal={goal} warn={warn} note={note} notch={notch} word={word} current={current} voiced={voiced} captioned={captioned} short={short} onPress={onPress} />;
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
  spokenWord,
  role,
  hint,
  elimination,
  ticks,
  ring,
  ringMark,
  limit,
  eliminates,
  filled,
  limitWords,
  goal,
  warn,
  note,
  notch,
  word,
  current,
  voiced,
  captioned,
  short,
  onPress,
}: {
  threat: SeatThreat;
  label: string;
  id: string;
  icon: IconName | null;
  name: string;
  spokenWord?: string;
  role: DialRole;
  hint: string | null;
  elimination: boolean;
  ticks: readonly number[];
  ring: string | null;
  ringMark: "oneRing" | "hero";
  limit?: number;
  eliminates?: boolean;
  filled?: number;
  limitWords?: string;
  goal?: boolean;
  warn?: { level: "near" | "critical"; words: string };
  note?: string;
  notch?: number;
  word?: string;
  current?: boolean;
  // A seat's threat dial: a change plays the threat's sound (threatSound). The other dials are silent.
  voiced?: boolean;
  captioned?: boolean;
  short?: string;
  onPress?: () => void;
}) {
  const speed = useMotionScale();
  const t = useTableTokens();
  const s = useUiScale();
  const focus = useFocusRing();
  const badge = useMemo(() => ({ in: layoutAnim(FadeIn, MOTION.threatBadgeIn, speed), out: layoutAnim(FadeOut, MOTION.threatBadgeOut, speed) }), [speed]);
  const { own, level, look, tint } = dialLook(t, { threat: threat.threat, eliminated: threat.eliminated, elimination, goal: goal === true, limit, warn });
  // The change since the number last moved, shown beside the dial for DELTA_MS. A new change replaces it.
  const seen = useRef(threat.threat);
  const [change, setChange] = useState<{ before: number; after: number; at: number } | null>(null);
  const scale = useSharedValue(1);
  const voice = useEffectEvent((before: number, after: number) => {
    const sound = voiced === true ? threatSound(before, after, limit) : null;
    if (sound) playSound(sound);
  });
  useEffect(() => {
    const before = seen.current;
    seen.current = threat.threat;
    if (before === threat.threat) return;
    setChange({ before, after: threat.threat, at: Date.now() });
    voice(before, threat.threat);
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
  // A seat that left the game wears the word "Out" on its dimmed dial, where a sighted player reads its number (the spoken label says "eliminated").
  const shown = word ?? (threat.eliminated ? "Out" : undefined);
  // A seat that is out wears "Out" and no change: its threat no longer counts.
  const moved = change != null && word == null && !threat.eliminated;
  const delta = moved ? threatDelta(change.before, change.after) : null;
  const deltaWords = moved ? threatDeltaWords(name, change.before, change.after) : null;
  const critical = level === "critical" && !threat.eliminated;
  // The words for a dial near its limit: its own warning first, then what the number alone says.
  const losesAtLimit = limit != null && eliminates !== true;
  const nearWords = own === "critical" ? (losesAtLimit ? ", near the limit" : ", near elimination") : "";
  const levelWords = warn ? `, ${warn.words}${nearWords}` : critical ? nearWords : "";
  // The glow, the track and the disc wash are threat red, or the accent on a dial that counts toward a goal.
  const hue = goal ? t.accent : t.threat;
  const engaging = ticks.filter((cost) => cost <= threat.threat).length;
  const tickWords = ticks.length === 0 ? "" : ticks.length === 1 ? `, the enemy in staging ${engaging === 1 ? "engages" : "does not engage"} at this threat` : `, ${engaging} of the ${ticks.length} enemies in staging engage at this threat`;
  // The dial is one control with one name (the change badge's words included), so Android gives it one focus stop.
  const dialWords = `${spokenWord ? dialSpeech(spokenWord, threat.threat, label, role) : `${name} ${word ?? threat.threat}`}${threat.eliminated ? ", eliminated" : levelWords}${note ? `, ${note}` : ""}${limit != null ? `, ${limitWords ?? `the players lose at ${limit}`}` : ""}${tickWords}${ring ? `. ${ring}` : ""}${deltaWords ? `. ${deltaWords}` : ""}`;
  return (
    <Pressable
      {...focus.props}
      disabled={!onPress}
      onPress={onPress}
      accessible
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={dialWords}
      accessibilityHint={onPress ? (hint ?? "Shows each enemy's engagement cost against your threat") : undefined}
      style={({ pressed }) => ({ minHeight: touch(s, 44), flexDirection: "row", alignItems: "center", gap: 6 * s, paddingHorizontal: 4 * s, borderRadius: 999, backgroundColor: pressed ? withAlphaHex(t.bone, 0.12) : "transparent", ...focus.style })}
    >
      <Animated.View style={pop}>
        <View testID={id} style={{ width: DIAL * s, height: DIAL * s, borderRadius: (DIAL / 2) * s, boxShadow: threat.eliminated ? undefined : `0 0 22px ${withAlphaHex(hue, critical ? 0.6 : 0.4)}` }}>
          {/* The threat's share of 50, the elimination level, as an arc round the dial (rr.threat-elimination-level). */}
          <ArcRing size={DIAL * s} stroke={4 * s} parts={(elimination || limit != null) && !threat.eliminated ? [{ key: "threat", share: threatMeter(filled ?? threat.threat, limit), color: look.meter }] : []} track={withAlphaHex(hue, 0.16)}>
            <View
              className="items-center justify-center"
              style={{
                width: (DIAL - 8) * s,
                height: (DIAL - 8) * s,
                borderRadius: ((DIAL - 8) / 2) * s,
                backgroundColor: look.fill,
                // A dial that warns by its own rule (a last card in hand) wears the level's edge on its disc, apart from the ring's own meter.
                ...(warn && !threat.eliminated ? { borderWidth: 2 * s, borderColor: look.edge } : {}),
                backgroundImage: critical ? undefined : `radial-gradient(circle, ${withAlphaHex(hue, 0.28)}, ${withAlphaHex(t.night, 0.92)})`,
              }}
            >
              {/* The disc is 38·s wide and counts on the word fitting (Day, Night): one line, shrunk to the disc at the phone's larger text sizes (docs/design-system.md, Type). */}
              <Text testID={`${id}-value`} className="font-display" numberOfLines={shown == null ? undefined : 1} adjustsFontSizeToFit={shown != null} minimumFontScale={0.6} style={{ fontSize: (shown == null ? 20 : 12) * s, lineHeight: (shown == null ? 24 : 16) * s, color: critical ? t.onThreat : t.depth === "light" ? t.bone : t.onThreat }}>
                {shown ?? String(threat.threat)}
              </Text>
              {icon && icon !== "threat" ? <GameIcon name={icon} size={9 * s} tint={tint} /> : null}
            </View>
          </ArcRing>
          {/* A tick on the ring at each staging enemy's engagement cost: bone where the threat has reached it, faint where not yet. */}
          {elimination && !threat.eliminated
            ? ticks.map((cost, index) => {
                const angle = threatMeter(cost, limit) * 2 * Math.PI - Math.PI / 2;
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
          {/* A notch on the ring at a level the threat is kept above (stage 2B's starting level): a short radial bar across the arc, apart from the engagement ticks' dots. */}
          {notch != null && !threat.eliminated ? (
            <View
              testID={`${id}-notch`}
              pointerEvents="none"
              style={{ position: "absolute", left: (DIAL / 2) * s - 1 * s, top: -2.5 * s, width: 2 * s, height: 9 * s, borderRadius: 1 * s, backgroundColor: t.bone, transformOrigin: `${1 * s}px ${(DIAL / 2 + 2.5) * s}px`, transform: [{ rotate: `${threatMeter(notch, limit) * 360}deg` }] }}
            />
          ) : null}
        </View>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 999, borderWidth: 2 * s, borderColor: t.accent }, ringStyle]} />
        {/* The current stage of several in play together: an accent ring just outside the dial, as the peeked seat's is bone. */}
        {current === true ? <View testID={`${id}-current`} pointerEvents="none" style={{ position: "absolute", top: -2 * s, left: -3 * s, right: -3 * s, bottom: -2 * s, borderRadius: 999, borderWidth: 1.5 * s, borderColor: t.accent }} /> : null}
        {/* Peeking at this seat: a bone ring just outside the dial and an eye on its corner, clear of the label and its Ring mark. */}
        {role === "viewing" ? (
          <>
            <View testID={`${id}-viewing`} pointerEvents="none" style={{ position: "absolute", top: -2 * s, left: -3 * s, right: -3 * s, bottom: -2 * s, borderRadius: 999, borderWidth: 1.5 * s, borderColor: t.bone }} />
            <EyeMark testID={`${id}-eye`} s={s} />
          </>
        ) : null}
      </Animated.View>
      {captioned === true && !ring ? null : (
      <View className="items-start gap-0.5">
        <View className="flex-row items-center gap-1">
          {/* A seat's label (P1) and Life or Burden stand beside their dials; the lone threat dial is a number and is named "Threat" to a screen reader. */}
          {(label === "Threat" && icon === "threat") || captioned === true ? null : <Text className={`text-label ${role === "acting" ? "text-accent" : role === "viewing" ? "text-bone" : "text-muted"}`}>{label}</Text>}
          {ring ? (
            <View testID={`${id}-ring`}>
              <GameIcon name={ringMark} size={12 * s} tint={ringMark === "oneRing" ? "accent" : "bone"} />
            </View>
          ) : null}
        </View>
      </View>
      )}
      {/* The caption: the name under the ring, over its foot, where the row has no room for it beside the ring. It hangs from the row's foot as the change badge does (inside the bar), takes no room in the row, never takes a tap, and gives way to the change badge, which stands in its place. A seat's caption is its letter ("P1") in the accent while the seat is the one asked. */}
      {captioned === true && !delta ? (
        <View testID={`${id}-caption`} pointerEvents="none" style={{ position: "absolute", zIndex: 1, bottom: -badgeFoot(s), left: (DIAL_PAD - CAPTION_OVER) * s, width: (DIAL + 2 * CAPTION_OVER) * s, alignItems: "center" }}>
          <View style={{ maxWidth: "100%", borderRadius: 999, paddingHorizontal: CAPTION_PAD * s, backgroundColor: withAlphaHex(t.night, 0.88) }}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} className={`text-micro ${role === "acting" ? "text-accent" : "text-bone"}`} style={{ lineHeight: CAPTION_LINE * s }}>
              {captionOf(label, short)}
            </Text>
          </View>
        </View>
      ) : null}
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
  const ring = useFocusRing();
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
      {...ring.props}
      disabled={!onPress}
      onPress={onPress}
      accessible
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={words}
      accessibilityHint={onPress ? HEADING_HINT : undefined}
      style={({ pressed }) => ({ minHeight: touch(s, 44), flexDirection: "row", alignItems: "center", gap: 6 * s, paddingHorizontal: 4 * s, borderRadius: 999, backgroundColor: pressed ? withAlphaHex(t.bone, 0.12) : "transparent", ...ring.style })}
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

/** A log or banner line's mark: the game icon for threat, willpower, attack and defense, the token art for damage, progress, resources. */
export function LineMark({ mark, tint = "ink", size }: { mark: LogMark; tint?: "ink" | "bone"; size?: number }) {
  const s = useUiScale();
  // The default is Medium's 16 times the UI scale; a caller that passes a size has scaled it.
  if (size == null) size = 16 * s;
  if (!mark) return <View style={{ width: size }} />;
  if (mark === "threat" || mark === "willpower" || mark === "attack" || mark === "defense") return <GameIcon name={mark} size={size} tint={tint} />;
  return <GameIcon name={mark} size={size} />;
}
