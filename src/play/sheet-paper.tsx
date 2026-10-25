// The table chrome's shared pieces: the text and pill buttons, the choice tile, the engine's numbers with their icons, the
// sentence under a disabled action, and the parchment frame (docs/design-system.md, Table). The dock's buttons, which arm
// before they send, are dock-buttons.tsx. Every press shows its pressed fill in the same frame. Nothing here holds a number
// the engine did not compute.
import type { ReactNode } from "react";
import { Pressable, Text, View, type DimensionValue } from "react-native";
import Animated, { ReduceMotion, SlideInDown, SlideInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconValue } from "./game-icon.tsx";
import type { SheetStat } from "./sheet-types.ts";
import { tableTokens as t } from "./tokens.ts";

const rise = SlideInDown.duration(220).reduceMotion(ReduceMotion.System);
const slide = SlideInRight.duration(220).reduceMotion(ReduceMotion.System);
const SHEET_RADIUS = 28;

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

// Every fill and text colour of a button is a style object from the tokens, never only a class: on the phone NativeWind can
// drop a class from a Pressable whose style is a function, and the dock's gold pill was left as dark text on night (user
// report, 2026-10-25). The pressed state comes from the Pressable's children function, so no style function is needed.

/**
 * A text button on night or paper: 44 pt target, the pressed fill in the same frame. `variant` "text" is a word alone (the
 * top bar, a panel's Close); "outline" is a raised pill with a goldLine edge (the dock's other answers: Pass, Cancel, the
 * alternative); "quiet" is a raised pill with a hairline edge (the dock's Read the card, List, Actions).
 */
export function ChromeButton({
  label,
  onPress,
  testID,
  tone = "bone",
  variant = "text",
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  tone?: "bone" | "gold" | "ink" | "muted";
  variant?: "text" | "outline" | "quiet";
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const ink = tone === "ink";
  const color = disabled ? (ink ? t.inkMuted : t.faint) : tone === "gold" ? t.gold : ink ? t.inkLabel : tone === "muted" ? t.muted : t.bone;
  const edge = variant === "outline" ? (ink ? t.inkLabel : t.goldLine) : variant === "quiet" ? (ink ? t.inkLine : t.hairline) : null;
  const rest = variant === "text" ? "transparent" : ink ? t.paper : t.raised;
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ minHeight: 44, minWidth: 44, justifyContent: "center", paddingVertical: variant === "text" ? 0 : 2 }}
    >
      {({ pressed }) => (
        <View
          className={`items-center justify-center px-3 ${variant === "text" ? "min-h-11 rounded-tile" : "min-h-10 rounded-pill"}`}
          style={{ backgroundColor: pressed && !disabled ? (ink ? t.paperPressed : t.pressed) : rest, ...(edge ? { borderWidth: 1, borderColor: edge } : {}) }}
        >
          <Text className="text-body font-medium" style={{ color }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * The one filled action: a gold pill on night with a soft gold glow, an ink pill on paper. Disabled, it is a dashed outline
 * (a goldLine edge with muted text on night, inkLine with inkMuted on paper) that still reads as the button it will be and
 * not as one of the solid-edged answers beside it (docs/design-system.md). A disabled action has a sentence near it saying
 * why.
 */
export function ChromePrimary({
  label,
  onPress,
  testID,
  disabled = false,
  surface = "night",
  compact = false,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  disabled?: boolean;
  surface?: "night" | "paper";
  // In the table's dock: a 48 pt pill whose label keeps its size (no widest tracking) and wraps to two lines when long.
  compact?: boolean;
  accessibilityHint?: string;
}) {
  const paper = surface === "paper";
  const color = disabled ? (paper ? t.inkMuted : t.muted) : paper ? t.paper : t.onGold;
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
    >
      {({ pressed }) => (
        <View className={`${compact ? "min-h-12 px-3" : "min-h-14 px-5"} items-center justify-center rounded-pill`} style={primaryFill(paper, disabled, pressed)}>
          {/* In the dock a long label ("Leave undefended") takes a second line rather than shrinking. */}
          <Text numberOfLines={compact ? 2 : 1} className={`text-center font-display text-body uppercase ${compact ? "tracking-wide" : "tracking-widest"}`} style={{ color }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function primaryFill(paper: boolean, disabled: boolean, pressed: boolean) {
  if (disabled) return { backgroundColor: "transparent", borderWidth: 1.5, borderStyle: "dashed" as const, borderColor: paper ? t.inkLine : t.goldLine };
  if (paper) return { backgroundColor: t.ink, opacity: pressed ? 0.85 : 1 };
  return {
    backgroundColor: pressed ? t.goldDeep : t.gold,
    borderTopWidth: 1,
    borderColor: t.goldHigh,
    boxShadow: pressed ? undefined : `0 0 12px ${t.gold}8C`,
  };
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
    >
      {({ pressed }) => (
        <View
          className="mb-2 justify-center rounded-tile px-4 py-2"
          style={{ minHeight: 48, borderWidth: selected ? 1.5 : 1, borderColor: selected ? t.ink : t.inkLine, backgroundColor: pressed ? t.paperPressed : "transparent" }}
        >
          <View className="flex-row items-center justify-between gap-2">
            <Text className={`shrink text-body text-ink ${selected ? "font-semibold" : ""}`}>{label}</Text>
            <Stats stats={stats} />
          </View>
          {detail ? <Text className="mt-0.5 text-label text-inkMuted">{detail}</Text> : null}
        </View>
      )}
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
