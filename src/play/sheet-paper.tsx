// The table chrome's shared pieces: the text and pill buttons, the choice tile, the engine's numbers with their icons, the
// sentence under a disabled action, and the parchment frame (docs/design-system.md, Table). The dock's buttons, which arm
// before they send, are dock-buttons.tsx. Every press shows its pressed fill in the same frame. Nothing here holds a number
// the engine did not compute.
import type { ReactNode } from "react";
import { Pressable, Text, View, type DimensionValue } from "react-native";
import Animated, { ReduceMotion, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconValue } from "./game-icon.tsx";
import type { SheetStat } from "./sheet-types.ts";
import { tableTokens as t } from "./tokens.ts";

const rise = SlideInDown.duration(220).reduceMotion(ReduceMotion.System);
const SHEET_RADIUS = 28;

/**
 * The parchment a sheet sits on, from the bottom edge: its fill, corners and bottom inset are plain styles from the tokens and
 * useSafeAreaInsets, not NativeWind classes (sheets that carried pb-safe in their classes lost their parchment on the phone).
 * (The table's choice tray and reading panels are tray-frame.tsx.)
 */
export function SheetFrame({ children, testID, maxHeight, paddingTop = 12, animated = true }: { children: ReactNode; testID?: string; maxHeight?: DimensionValue; paddingTop?: number; animated?: boolean }) {
  const insets = useSafeAreaInsets();
  const style = {
    backgroundColor: t.paper,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    paddingHorizontal: 24,
    paddingTop,
    paddingBottom: Math.max(insets.bottom, 12),
    ...(maxHeight != null ? { maxHeight } : {}),
  };
  return animated ? (
    <Animated.View entering={rise} testID={testID} collapsable={false} style={style}>
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
  tight = false,
  accessibilityLabel,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  tone?: "bone" | "gold" | "ink" | "muted";
  variant?: "text" | "outline" | "quiet";
  disabled?: boolean;
  // On a short phone's dock: a 36 pt pill in a 40 pt row, its 44 pt target kept by a 2 pt hit slop (docs/design-system.md, Table).
  tight?: boolean;
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
      hitSlop={tight ? { top: 2, bottom: 2 } : undefined}
      style={{ minHeight: tight ? 40 : 44, minWidth: 44, justifyContent: "center", paddingVertical: variant === "text" ? 0 : 2 }}
    >
      {({ pressed }) => (
        <View
          className={`items-center justify-center px-3 ${variant === "text" ? "min-h-11 rounded-tile" : tight ? "min-h-9 rounded-pill" : "min-h-10 rounded-pill"}`}
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
  tight = false,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  disabled?: boolean;
  surface?: "night" | "paper";
  // In the table's dock: a 48 pt pill whose label keeps its size (no widest tracking) and wraps to two lines when long.
  compact?: boolean;
  // A 44 pt pill (not 48) on a short phone's dock.
  tight?: boolean;
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
        <View className={`${compact ? (tight ? "min-h-11 px-3" : "min-h-12 px-3") : "min-h-14 px-5"} items-center justify-center rounded-pill`} style={primaryFill(paper, disabled, pressed)}>
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

/**
 * A choice tile, on paper (a pile's cards) or on night (the choice tray). `leading` is a card picture, `trailing` a pill (the
 * foreseen damage); `dense` puts everything on one line (the tray on a short phone). A picked night tile has the gold edge and
 * a gold check; a paper one a heavier ink edge. A long press (`onLongPress`) reads the card.
 */
export function Tile({
  label,
  selected,
  onPress,
  onLongPress,
  testID,
  detail,
  stats = [],
  surface = "paper",
  dense = false,
  leading = null,
  trailing = null,
  said = "",
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  onLongPress?: (() => void) | null;
  testID: string;
  detail?: string | null;
  stats?: readonly SheetStat[];
  surface?: "night" | "paper";
  dense?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  // More for a screen reader to say (the foreseen damage).
  said?: string;
}) {
  const night = surface === "night";
  const numbers = stats.length > 0 || trailing != null ? (
    <View className="flex-row flex-wrap items-center gap-2">
      <Stats stats={stats} surface={surface} />
      {trailing}
    </View>
  ) : null;
  return (
    <Pressable
      testID={testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={[label, ...stats.map((stat) => `${stat.word} ${stat.value}`), said, detail ?? ""].filter((part) => part.length > 0).join(". ")}
      accessibilityHint={onLongPress ? "Hold to read the card" : undefined}
      onPress={onPress}
      onLongPress={onLongPress ?? undefined}
    >
      {({ pressed }) => (
        <View
          className={`${dense ? "mb-1 py-0.5" : night ? "mb-1.5 py-1" : "mb-2 py-2"} flex-row items-center gap-2 rounded-tile ${night ? "px-2" : "px-4"}`}
          style={{
            minHeight: dense ? 44 : night ? 52 : 48,
            borderWidth: selected ? 1.5 : 1,
            borderColor: selected ? (night ? t.gold : t.ink) : night ? t.hairline : t.inkLine,
            backgroundColor: pressed ? (night ? t.pressed : t.paperPressed) : night ? t.night : "transparent",
          }}
        >
          {leading}
          <View className={`flex-1 ${dense ? "flex-row flex-wrap items-center gap-x-2 gap-y-0.5" : ""}`}>
            <View className={dense ? "" : "flex-row items-center justify-between gap-2"} style={dense ? { flexGrow: 1, flexShrink: 1, minWidth: 84 } : undefined}>
              <Text numberOfLines={2} className={`shrink text-body ${night ? "text-bone" : "text-ink"} ${selected ? "font-semibold" : ""}`}>
                {label}
              </Text>
              {night || dense ? null : numbers}
            </View>
            {detail ? <Text className={`mt-0.5 text-label ${night ? "text-muted" : "text-inkMuted"}`}>{detail}</Text> : null}
            {night || dense ? <View className={dense ? "" : "mt-0.5"}>{numbers}</View> : null}
          </View>
          {selected && night ? (
            <View accessible={false} importantForAccessibility="no" style={{ width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: t.gold }}>
              <Text style={{ color: t.onGold, fontSize: 13, lineHeight: 16, fontWeight: "700" }}>{"\u2713"}</Text>
            </View>
          ) : null}
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
