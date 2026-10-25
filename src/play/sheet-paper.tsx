// The paper sheet's shared pieces: the text and pill buttons, the choice tile, the engine's numbers with their icons, the
// sentence under a disabled action, and the parchment frame itself (docs/design-system.md, Table). Every press shows its
// pressed fill in the same frame. Nothing here holds a number the engine did not compute.
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { ReduceMotion, SlideInDown } from "react-native-reanimated";

import { IconValue } from "./game-icon.tsx";
import type { Sheet, SheetNames, SheetStat } from "./sheet-types.ts";
import type { PlayerIntent, ScenarioState } from "./store.ts";
import { tableTokens as t } from "./tokens.ts";

const rise = SlideInDown.duration(220).reduceMotion(ReduceMotion.System);

/** A text button on night or paper: 44 pt target, the pressed fill in the same frame. */
export function ChromeButton({
  label,
  onPress,
  testID,
  tone = "bone",
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  tone?: "bone" | "gold" | "ink";
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const color = disabled ? (tone === "ink" ? "text-inkMuted" : "text-faint") : tone === "gold" ? "text-gold" : tone === "ink" ? "text-inkLabel" : "text-bone";
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="min-h-11 min-w-11 items-center justify-center rounded-tile px-3"
      style={({ pressed }) => (pressed && !disabled ? { backgroundColor: tone === "ink" ? t.paperPressed : t.pressed } : undefined)}
    >
      <Text className={`text-body font-medium ${color}`}>{label}</Text>
    </Pressable>
  );
}

/**
 * The one filled action: a gold pill on night, an ink pill on paper. Disabled on night is a raised pill with faint text;
 * disabled on paper is an inkLine outline with inkMuted text (docs/design-system.md). A disabled action has a sentence
 * near it saying why.
 */
export function ChromePrimary({ label, onPress, testID, disabled = false, surface = "night" }: { label: string; onPress: () => void; testID: string; disabled?: boolean; surface?: "night" | "paper" }) {
  const paper = surface === "paper";
  const fill = paper ? t.ink : t.gold;
  const pressedFill = paper ? t.ink : t.goldDeep;
  const text = disabled ? (paper ? "text-inkMuted" : "text-faint") : paper ? "text-paper" : "text-onGold";
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="min-h-14 items-center justify-center rounded-pill px-6"
      style={({ pressed }) =>
        disabled
          ? paper
            ? { backgroundColor: "transparent", borderWidth: 1, borderColor: t.inkLine }
            : { backgroundColor: t.raised }
          : { backgroundColor: pressed ? pressedFill : fill, opacity: pressed && paper ? 0.85 : 1 }
      }
    >
      <Text className={`font-display text-body uppercase tracking-widest ${text}`}>{label}</Text>
    </Pressable>
  );
}

/** The engine's numbers with the game's icons beside them, ink on paper. Each reads as "Willpower 2" to a screen reader. */
export function Stats({ stats, testID }: { stats: readonly SheetStat[]; testID?: string }) {
  if (stats.length === 0) return null;
  return (
    <View testID={testID} className="flex-row flex-wrap items-center gap-3">
      {stats.map((stat) => (
        <IconValue key={stat.word} name={stat.icon} value={String(stat.value)} word={stat.word} tint="ink" textClass="font-display text-body text-ink" />
      ))}
    </View>
  );
}

export function Tile({
  label,
  selected,
  onPress,
  testID,
  detail,
  stats = [],
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
  detail?: string | null;
  stats?: readonly SheetStat[];
}) {
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={[label, ...stats.map((stat) => `${stat.word} ${stat.value}`), detail ?? ""].filter((part) => part.length > 0).join(". ")}
      onPress={onPress}
      className="mb-2 min-h-14 justify-center rounded-tile px-4 py-2"
      style={({ pressed }) => ({
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? t.ink : t.inkLine,
        backgroundColor: pressed ? t.paperPressed : "transparent",
      })}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className={`shrink text-body text-ink ${selected ? "font-semibold" : ""}`}>{label}</Text>
        <Stats stats={stats} />
      </View>
      {detail ? <Text className="mt-0.5 text-label text-inkMuted">{detail}</Text> : null}
    </Pressable>
  );
}

/** One sentence under a disabled action saying what it waits for. */
export function Why({ children }: { children: string }) {
  return (
    <Text testID="sheet-why" className="mt-1 text-center text-label text-inkMuted">
      {children}
    </Text>
  );
}

/**
 * Parchment over the rail: grabber, the step in an eyebrow, the moment as a title, the engine's numbers in a muted line,
 * and the seats' threat, which stays in sight while a sheet is up. Only the tiles scroll; the reducer's refusal, the primary
 * and the alternative stay pinned at the bottom, in thumb reach.
 */
export function Paper({
  step,
  title,
  note,
  threat,
  refusal,
  children,
  actions,
  onCollapse,
  stats = [],
}: {
  step: string;
  title: string;
  note: string | null;
  stats?: readonly SheetStat[];
  threat: string;
  refusal: string | null;
  children?: ReactNode;
  actions: ReactNode;
  onCollapse: () => void;
}) {
  return (
    <Animated.View entering={rise} testID="sheet" className="rounded-t-sheet bg-paper px-6 pb-safe pt-3" style={{ maxHeight: "78%" }}>
      <View className="mb-2 h-1 w-10 self-center rounded-pill bg-inkLine" />
      <View className="items-center">
        <Text testID="sheet-step" className="font-display text-eyebrow uppercase text-inkLabel">
          {step}
        </Text>
        <Text testID="sheet-title" accessibilityRole="header" className="mt-1 text-center font-display text-title text-ink">
          {title}
        </Text>
        {stats.length > 0 ? (
          <View className="mt-1">
            <Stats stats={stats} testID="sheet-stats" />
          </View>
        ) : null}
        {note ? (
          <Text testID="sheet-note" className="mt-1 text-center text-body text-inkMuted">
            {note}
          </Text>
        ) : null}
        <Text testID="sheet-threat" className="mt-1 font-display text-label text-inkLabel">
          {threat}
        </Text>
      </View>
      {children ? (
        <ScrollView className="mt-3" contentContainerClassName="pb-1" style={{ flexShrink: 1 }}>
          {children}
        </ScrollView>
      ) : null}
      <View className="mt-2 gap-1">
        {refusal ? (
          <Text testID="sheet-refusal" className="text-center text-body text-danger">
            {refusal}
          </Text>
        ) : null}
        {actions}
        <View className="items-center">
          <ChromeButton label="Look at the table" testID="sheet-collapse" tone="ink" onPress={onCollapse} />
        </View>
      </View>
    </Animated.View>
  );
}

export type SheetProps = {
  game: ScenarioState;
  names: SheetNames;
  // The seats' threat in words, kept in sight while the sheet is up.
  threat: string;
  // Why the reducer refused the last intent, shown above the primary so no sheet hides it.
  refusal: string | null;
  onIntent: (intent: PlayerIntent) => void;
  onNext: (sheet: Sheet) => void;
  onOutcome: () => void;
  onInspect: (cardId: string) => void;
  onCollapse: () => void;
};

export function paperProps(props: SheetProps, sheet: { step: string; title: string; note: string | null; stats?: readonly SheetStat[] }) {
  return { step: sheet.step, title: sheet.title, note: sheet.note, stats: sheet.stats ?? [], threat: props.threat, refusal: props.refusal, onCollapse: props.onCollapse };
}
