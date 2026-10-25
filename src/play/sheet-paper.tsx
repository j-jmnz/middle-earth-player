// The table chrome's shared pieces: the text and pill buttons, the button that must be tapped twice, the choice tile, the
// engine's numbers with their icons, the sentence under a disabled action, and the parchment frame (docs/design-system.md,
// Table). Every press shows its pressed fill in the same frame. Nothing here holds a number the engine did not compute.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, Text, View, type DimensionValue } from "react-native";
import Animated, { Easing, ReduceMotion, SlideInDown, SlideInRight, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconValue } from "./game-icon.tsx";
import type { SheetStat } from "./sheet-types.ts";
import { tableTokens as t } from "./tokens.ts";

const rise = SlideInDown.duration(220).reduceMotion(ReduceMotion.System);
const slide = SlideInRight.duration(220).reduceMotion(ReduceMotion.System);
const SHEET_RADIUS = 28;
// How long an armed button waits for its second tap.
export const ARM_MS = 3000;

/**
 * The parchment a sheet sits on. From the bottom edge (`edge` "bottom", the default): its fill, corners and bottom inset are
 * plain styles from the tokens and useSafeAreaInsets, not NativeWind classes (sheets that carried pb-safe in their classes
 * lost their parchment on the phone). From the right edge (`edge` "right", the table in landscape): full height, the left
 * corners rounded, the right inset kept clear of the notch.
 */
export function SheetFrame({
  children,
  testID,
  maxHeight,
  paddingTop = 12,
  animated = true,
  edge = "bottom",
}: {
  children: ReactNode;
  testID?: string;
  maxHeight?: DimensionValue;
  paddingTop?: number;
  animated?: boolean;
  edge?: "bottom" | "right";
}) {
  const insets = useSafeAreaInsets();
  const right = edge === "right";
  const style = right
    ? {
        backgroundColor: t.paper,
        borderTopLeftRadius: SHEET_RADIUS,
        borderBottomLeftRadius: SHEET_RADIUS,
        paddingLeft: 20,
        paddingRight: Math.max(insets.right, 16),
        paddingTop,
        paddingBottom: Math.max(insets.bottom, 12),
        flex: 1,
      }
    : {
        backgroundColor: t.paper,
        borderTopLeftRadius: SHEET_RADIUS,
        borderTopRightRadius: SHEET_RADIUS,
        paddingHorizontal: 24,
        paddingTop,
        paddingBottom: Math.max(insets.bottom, 12),
        ...(maxHeight != null ? { maxHeight } : {}),
      };
  return animated ? (
    <Animated.View entering={right ? slide : rise} testID={testID} collapsable={false} style={style}>
      {children}
    </Animated.View>
  ) : (
    <View testID={testID} collapsable={false} style={style}>
      {children}
    </View>
  );
}

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
  tone?: "bone" | "gold" | "ink" | "muted";
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const color = disabled ? (tone === "ink" ? "text-inkMuted" : "text-faint") : tone === "gold" ? "text-gold" : tone === "ink" ? "text-inkLabel" : tone === "muted" ? "text-muted" : "text-bone";
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
export function ChromePrimary({ label, onPress, testID, disabled = false, surface = "night", compact = false }: { label: string; onPress: () => void; testID: string; disabled?: boolean; surface?: "night" | "paper"; compact?: boolean }) {
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
      className={`${compact ? "min-h-12" : "min-h-14"} items-center justify-center rounded-pill px-5`}
      style={({ pressed }) =>
        disabled
          ? paper
            ? { backgroundColor: "transparent", borderWidth: 1, borderColor: t.inkLine }
            : { backgroundColor: t.raised }
          : { backgroundColor: pressed ? pressedFill : fill, opacity: pressed && paper ? 0.85 : 1 }
      }
    >
      <Text numberOfLines={1} adjustsFontSizeToFit className={`font-display text-body uppercase tracking-widest ${text}`}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * A button for an action that cannot be taken back. With `arm` (it sends an intent with nothing picked first: Pass, Keep,
 * Leave undefended), the first tap only arms it: the label asks for a second tap and a bar runs down for three seconds; the
 * second tap confirms, and the bar running out puts it back. Without `arm` (it confirms a pick the player made on the
 * table), one tap confirms. Reduced motion keeps the bar still.
 */
export function ConfirmButton({
  label,
  onConfirm,
  testID,
  arm,
  primary = false,
  surface = "night",
  disabled = false,
}: {
  label: string;
  onConfirm: () => void;
  testID: string;
  arm: boolean;
  primary?: boolean;
  surface?: "night" | "paper";
  disabled?: boolean;
}) {
  // The label the button was armed for: a new label is a new action, so it starts unarmed.
  const [armedFor, setArmedFor] = useState<string | null>(null);
  const armed = armedFor === label;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const left = useSharedValue(1);
  const reduceMotion = useReducedMotion();
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const press = () => {
    if (timer.current) clearTimeout(timer.current);
    if (!arm || armed) {
      setArmedFor(null);
      onConfirm();
      return;
    }
    setArmedFor(label);
    left.set(1);
    if (!reduceMotion) left.set(withTiming(0, { duration: ARM_MS, easing: Easing.linear }));
    timer.current = setTimeout(() => setArmedFor(null), ARM_MS);
  };
  const bar = useAnimatedStyle(() => ({ width: `${Math.round(left.get() * 100)}%` }));
  const shown = armed ? `Tap again: ${label}` : label;
  const paper = surface === "paper";
  return (
    <View accessibilityHint={arm ? "Tap twice to confirm" : undefined}>
      {primary ? (
        <ChromePrimary label={shown} testID={testID} surface={surface} disabled={disabled} onPress={press} compact />
      ) : (
        <ChromeButton label={shown} testID={testID} tone={paper ? "ink" : armed ? "gold" : "bone"} disabled={disabled} onPress={press} />
      )}
      {armed ? <Animated.View testID={`${testID}-armed`} style={[{ height: 2, alignSelf: "center", backgroundColor: paper ? t.inkLabel : t.gold, marginTop: 2 }, bar]} /> : null}
    </View>
  );
}

/** The engine's numbers with the game's icons beside them. Each reads as "Willpower 2" to a screen reader. */
export function Stats({ stats, testID, surface = "paper", size = "body" }: { stats: readonly SheetStat[]; testID?: string; surface?: "night" | "paper"; size?: "body" | "title" }) {
  if (stats.length === 0) return null;
  const ink = surface === "paper";
  const textClass = `font-display ${size === "title" ? "text-title" : "text-body"} ${ink ? "text-ink" : "text-bone"}`;
  return (
    <View testID={testID} className="flex-row flex-wrap items-center gap-3">
      {stats.map((stat) => (
        <IconValue key={stat.word} name={stat.icon} value={String(stat.value)} word={stat.word} tint={ink ? "ink" : "bone"} size={size === "title" ? 20 : 16} textClass={textClass} />
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
      className="mb-2 min-h-12 justify-center rounded-tile px-4 py-2"
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
export function Why({ children, surface = "paper" }: { children: string; surface?: "night" | "paper" }) {
  return (
    <Text testID="sheet-why" className={`mt-1 text-center text-label ${surface === "paper" ? "text-inkMuted" : "text-muted"}`}>
      {children}
    </Text>
  );
}
