// The table's top bar pieces: the phase rail and the threat rings, and the mark beside a log line. These are React Native
// text with testIDs, so Maestro can read them; card pictures stay on the canvas (docs/design-system.md, Table). Phase
// changes animate with Reanimated, never gate a rule, and snap under reduced motion. Nothing here holds a number the engine
// did not compute.
import { Text, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";

import { GameIcon } from "./game-icon.tsx";
import type { IconName } from "./icon-map.ts";
import type { LogMark } from "./log.ts";
import type { Rail } from "./rail.ts";
import type { SeatThreat } from "./selectors.ts";
import { tableTokens as t } from "./tokens.ts";

export { ChromeButton, ChromePrimary } from "./sheet-paper.tsx";

const fade = FadeIn.duration(180).reduceMotion(ReduceMotion.System);

/**
 * Previous step, the current step in gold caps, the next step: one centered line. Text, not a control. `narrow` (a small
 * phone in landscape) keeps the current step alone, which may shrink a little to fit.
 */
export function PhaseRail({ rail, narrow = false }: { rail: Rail; narrow?: boolean }) {
  return (
    <View testID="rail" accessible accessibilityLabel={`Round ${rail.round}. ${rail.current}`} className="min-w-0 flex-1 flex-row items-center justify-center px-2">
      {narrow ? null : (
        <Text testID="rail-previous" numberOfLines={1} className="flex-1 text-right text-label text-muted">
          {rail.previous}
        </Text>
      )}
      <Animated.View key={rail.current} entering={fade} style={{ marginHorizontal: 12, flexShrink: 1 }}>
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
    </View>
  );
}

/** The seats' threat in one line, for a panel's header: "Threat 28", or "Player 1 28 · Player 2 31". */
export function threatLine(threats: readonly SeatThreat[], life: number | null): string {
  const seats = threats.length > 1 ? threats.map((row) => `Player ${row.seat + 1} ${row.threat}`).join(" · ") : `Threat ${threats[0]?.threat ?? 0}`;
  return life != null ? `${seats} · Life ${life}` : seats;
}

/**
 * A threat number in a ring, Marcellus, with its label under it, or beside it when `compact` (the top bar of the landscape
 * table). The reducer is the only writer of the number.
 */
export function ThreatRing({
  threat,
  label,
  testID,
  icon = "threat",
  compact = false,
  accessibilityName,
  active = false,
}: {
  threat: SeatThreat;
  label: string;
  testID?: string;
  icon?: IconName | null;
  compact?: boolean;
  // What a screen reader says for a short label ("P1" reads "Player 1 threat").
  accessibilityName?: string;
  // The seat the table shows in two-handed play: its ring is filled.
  active?: boolean;
}) {
  const id = testID ?? `threat-${threat.seat}`;
  if (compact) {
    return (
      <View testID={id} accessible accessibilityLabel={`${accessibilityName ?? label} ${threat.threat}`} className="min-h-11 flex-row items-center gap-1.5 px-1">
        <View className={`h-9 w-9 items-center justify-center rounded-pill ${active ? "bg-goldLine" : ""}`} style={{ borderWidth: 2, borderColor: threat.eliminated ? t.hairline : t.gold }}>
          <Text testID={`${id}-value`} className="font-display text-body text-bone">
            {String(threat.threat)}
          </Text>
        </View>
        <View className="items-start">
          {icon ? <GameIcon name={icon} size={12} tint="muted" /> : null}
          <Text className="text-label text-muted">{label}</Text>
        </View>
      </View>
    );
  }
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

/** A log or banner line's mark: the game icon for threat, willpower and attack, the token art for damage, progress, resources. */
export function LineMark({ mark, tint = "ink", size = 16 }: { mark: LogMark; tint?: "ink" | "bone"; size?: number }) {
  if (!mark) return <View style={{ width: size }} />;
  if (mark === "threat" || mark === "willpower" || mark === "attack") return <GameIcon name={mark} size={size} tint={tint} />;
  return <GameIcon name={mark} size={size} />;
}
