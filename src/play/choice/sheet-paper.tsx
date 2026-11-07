// The table chrome's shared pieces: the parchment frame, the choice tile, the engine's numbers with their icons and the
// sentence under a disabled action (docs/design-system-table.md). The word buttons are buttons.tsx; the dock's, which arm before
// they send, are dock/buttons.tsx. Every press shows its pressed fill in the same frame. Nothing here holds a number the engine
// did not compute.
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Pressable, View, type AccessibilityRole, type DimensionValue } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useFocusRing } from "../../ui/focus-ring.ts";
import { longPressA11y, mergeA11yActions } from "../../ui/long-press-action.ts";
import { IconValue } from "../../ui/game-icon.tsx";
import { CONTROL_RADIUS, SHEET_RADIUS } from "../../ui/radius.ts";
import { chipOnSurface, parchmentSurface } from "../../ui/surfaces.ts";
import { layoutAnim, useMotionScale } from "../../ui/motion-run.ts";
import { MOTION } from "../../ui/motion-tokens.ts";
import type { SheetStat } from "./sheet-types.ts";
import { withAlphaHex } from "../../ui/tokens.ts";
import { touch, useUiScale } from "../../ui/ui-scale.ts";
import { useTableTokens } from "../../ui/use-table-tokens.ts";
import { Text } from "../../ui/text.tsx";

/**
 * Which corners the parchment rounds: "top" for a sheet that rises from the bottom edge, "all" for one that floats centred on a wide
 * screen (screens/kit/sheet-modal.tsx). A SheetModal provides it, so a sheet inside takes it without being told.
 */
export type SheetCorners = "top" | "all";

export const SheetCornersContext = createContext<SheetCorners>("top");

/**
 * The weathered parchment a sheet sits on, from the bottom edge: its fill, corners and bottom inset are plain styles from the tokens and
 * useSafeAreaInsets, not NativeWind classes (sheets that carried pb-safe in their classes lost their parchment on the phone).
 * (The table's choice tray and reading panels are tray-frame.tsx.)
 */
export function SheetFrame({
  children,
  testID,
  maxHeight,
  paddingTop = 12,
  animated = true,
  corners,
}: {
  children: ReactNode;
  testID?: string;
  maxHeight?: DimensionValue;
  paddingTop?: number;
  animated?: boolean;
  corners?: SheetCorners;
}) {
  const inherited = useContext(SheetCornersContext);
  const round = corners ?? inherited;
  const insets = useSafeAreaInsets();
  const scale = useMotionScale();
  const t = useTableTokens();
  const s = useUiScale();
  const rise = useMemo(() => layoutAnim(SlideInDown, MOTION.sheetIn, scale), [scale]);
  const style = {
    ...parchmentSurface(t),
    borderTopLeftRadius: SHEET_RADIUS * s,
    borderTopRightRadius: SHEET_RADIUS * s,
    ...(round === "all" ? { borderBottomLeftRadius: SHEET_RADIUS * s, borderBottomRightRadius: SHEET_RADIUS * s } : {}),
    paddingHorizontal: 24 * s,
    paddingTop: paddingTop * s,
    paddingBottom: Math.max(insets.bottom, 12 * s),
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

/** The engine's numbers with the game's icons beside them. Each reads as "Willpower 2" to a screen reader. */
export function Stats({ stats, testID, surface = "paper", size = "body" }: { stats: readonly SheetStat[]; testID?: string; surface?: "night" | "paper"; size?: "body" | "title" }) {
  const s = useUiScale();
  if (stats.length === 0) return null;
  const ink = surface === "paper";
  const textClass = `font-display ${size === "title" ? "text-title" : "text-body"} ${ink ? "text-ink" : "text-bone"}`;
  return (
    <View testID={testID} className="flex-row flex-wrap items-center gap-2.5">
      {stats.map((stat) => (
        <IconValue key={stat.word} name={stat.icon} value={String(stat.value)} word={stat.word} tint={ink ? "ink" : "bone"} size={(size === "title" ? 18 : 15) * s} textClass={textClass} />
      ))}
    </View>
  );
}

const STEP_ACTIONS = [{ name: "increment" }, { name: "decrement" }];

/**
 * A choice row, on paper (a pile's cards) or on night (the choice in the dock). `leading` is a card picture, `trailing` a pill (the
 * foreseen damage); `dense` puts everything on one line (the choice on a short phone). A row has no plate and no drawn edge: at rest
 * it is words on the ground; picked, a night row is washed in accent with its name in accentHigh and an accent check, a paper row in
 * an ink wash. A long press (`onLongPress`) reads the card.
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
  hint,
  detailSpoken = true,
  reader,
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
  // What a tap does, when the label does not say ("Plays it"); said before the long press's hint.
  hint?: string;
  // The detail is drawn but not said again: its words are already in the stats ("Success" beside the success icon).
  detailSpoken?: boolean;
  // How a screen reader meets the row (accessibility props only; a touch acts as it always did): its role, whether its state is "checked"
  // (a radio, a checkbox) or "selected", the name it speaks when that is not the drawn label, and for an "adjustable" row its value and the
  // increment and decrement actions that add or take away one share (tray-logic.ts, stepShares). Given only under useReaderMode.
  reader?: { role: AccessibilityRole; checks: boolean; name?: string; value?: { min: number; max: number; now: number; text: string }; onStep?: (delta: 1 | -1) => void };
}) {
  const t = useTableTokens();
  const s = useUiScale();
  const night = surface === "night";
  const ring = useFocusRing();
  // A screen reader's actions on the row: a share row's increment and decrement, and the long press's "Show card" (docs/design-system.md, Screen reader).
  const onStep = reader?.onStep;
  const actions = mergeA11yActions(
    onStep ? { accessibilityActions: STEP_ACTIONS, onAccessibilityAction: (event) => onStep(event.nativeEvent.actionName === "increment" ? 1 : -1) } : null,
    onLongPress ? longPressA11y("Show card", onLongPress) : null,
  );
  const numbers = stats.length > 0 || trailing != null ? (
    <View className="flex-row flex-wrap items-center gap-2">
      <Stats stats={stats} surface={surface} />
      {trailing}
    </View>
  ) : null;
  return (
    <Pressable
      {...ring.props}
      testID={testID}
      collapsable={false}
      accessibilityRole={reader?.role ?? "button"}
      accessibilityState={reader?.checks ? { checked: selected } : { selected }}
      accessibilityValue={reader?.value}
      accessibilityActions={actions.accessibilityActions}
      onAccessibilityAction={actions.onAccessibilityAction}
      accessibilityLabel={[reader?.name ?? label, ...stats.map((stat) => `${stat.word} ${stat.value}`), said, detailSpoken ? (detail ?? "") : ""].filter((part) => part.length > 0).join(". ")}
      accessibilityHint={[hint, actions.accessibilityHint].filter(Boolean).join(". ") || undefined}
      onPress={onPress}
      onLongPress={onLongPress ?? undefined}
    >
      {({ pressed }) => (
        <View
          className={`${dense ? "mb-1 py-0.5" : night ? "mb-1.5 py-1" : "mb-2 py-2"} flex-row items-center gap-2 rounded-item ${night ? "px-2" : "px-4"}`}
          style={{
            minHeight: touch(s, dense ? 44 : night ? 50 : 48),
            ...(pressed ? { backgroundColor: night ? t.pressed : t.paperPressed } : selected ? (night ? chipOnSurface(t) : { backgroundColor: withAlphaHex(t.ink, 0.1) }) : { backgroundColor: "transparent" }),
            ...ring.style,
          }}
        >
          {leading}
          <View className={`flex-1 ${dense ? "flex-row flex-wrap items-center gap-x-2 gap-y-0.5" : ""}`}>
            <View className={dense ? "" : "flex-row items-center justify-between gap-2"} style={dense ? { flexGrow: 1, flexShrink: 1, minWidth: 84 * s } : undefined}>
              <Text numberOfLines={2} className={`shrink text-body ${selected ? "font-semibold" : ""}`} style={{ color: night ? (selected ? t.accentHigh : t.bone) : t.ink }}>
                {label}
              </Text>
              {night || dense ? null : numbers}
            </View>
            {detail ? <Text className={`mt-0.5 text-label ${night ? "text-muted" : "text-inkMuted"}`}>{detail}</Text> : null}
            {night || dense ? <View className={dense ? "" : "mt-0.5"}>{numbers}</View> : null}
          </View>
          {selected && night ? (
            <View accessible={false} importantForAccessibility="no" style={{ width: 20 * s, height: 20 * s, borderRadius: CONTROL_RADIUS, alignItems: "center", justifyContent: "center", backgroundColor: t.accent }}>
              <Text style={{ color: t.onAccent, fontSize: 13 * s, lineHeight: 16 * s, fontWeight: "700" }}>{"\u2713"}</Text>
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
