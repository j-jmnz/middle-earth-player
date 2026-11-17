// The frame of the table's popovers (docs/design-system-table.md, Table menu): a lit night card (floatingSurface, opaque) with a deep shadow
// and container corners, its rows inset item-cornered plates (no chevron, no divider between groups), that scales in from the corner it hangs from (MOTION.menuEnter ease-out from 0.96, MOTION.menuLeave ease-in), the layer
// that holds it, and a Pressable scrim that fills the screen under it so a tap outside closes it and does nothing else. Not a
// Modal: a Modal takes over the orientation lock and the status bar. The table menu (table-menu.tsx) and the dock's More
// popover (dock/more.tsx) both draw in it; Android Back closes either first (back.ts).
import { useEffect, useRef, type ComponentRef, type ReactNode, type RefObject } from "react";
import { AccessibilityInfo, findNodeHandle, Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { useFocusRing } from "./focus-ring.ts";
import { GameIcon } from "./game-icon.tsx";
import type { IconName } from "./icon-map.ts";
import { useOpenMotion } from "./motion-run.ts";
import { MOTION, ms } from "./motion-tokens.ts";
import { CONTAINER_RADIUS, ITEM_RADIUS } from "./radius.ts";
import { FLOATING_ALPHA, floatingSurface, noticeSurface, raisedEdgeOf } from "./surfaces.ts";
import { withAlphaHex } from "./tokens.ts";
import { touch, useUiScale } from "./ui-scale.ts";
import { useTableTokens } from "./use-table-tokens.ts";
import { Text } from "./text.tsx";

export type PressableRef = ComponentRef<typeof Pressable>;
// Medium's sizes; the popover draws them times the UI scale (ui-scale.ts), its rows never under 44 pt.
const ROW = 48;
const FROM_SCALE = 0.96;
// The frame's inner padding: rows sit this far inside its edge, so their pressed fill is a rounded plate of its own.
export const POPOVER_PAD = 6;
const PAD = POPOVER_PAD;

export type PopoverRowItem = {
  testID: string;
  label: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  icon?: IconName | null;
  // A mark drawn as views when no printed icon fits: the door of Leave the table.
  glyph?: "leave";
  // Leave the table: the word and its mark in danger. The update offer: the word and its icon in the accent.
  tone?: "danger" | "accent";
};

/** One 48 pt row of a popover: a rounded plate inside the frame's padding that fills when pressed. */
export function PopoverRow({ item, onPress, rowRef }: { item: PopoverRowItem; onPress: () => void; rowRef?: RefObject<PressableRef | null> }) {
  const t = useTableTokens();
  const s = useUiScale();
  const row = touch(s, ROW);
  // The ring stays inside the frame's padding (PAD 6 pt holds its 2 pt and 2 pt offset at Medium).
  const ring = useFocusRing();
  return (
    <Pressable
      {...ring.props}
      ref={rowRef}
      testID={item.testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={item.accessibilityLabel ?? item.label}
      accessibilityHint={item.accessibilityHint}
      onPress={onPress}
      style={{ minHeight: row }}
    >
      {({ pressed }) => (
        <View
          style={{
            minHeight: row,
            flexDirection: "row",
            alignItems: "center",
            gap: 10 * s,
            paddingHorizontal: 10 * s,
            borderRadius: ITEM_RADIUS * s,
            backgroundColor: pressed ? t.pressed : "transparent",
            ...ring.style,
          }}
        >
          {item.icon ? <GameIcon name={item.icon} size={18 * s} tint={item.tone === "accent" ? "accent" : "bone"} /> : null}
          {item.glyph === "leave" ? <LeaveMark color={item.tone === "danger" ? t.danger : t.muted} s={s} /> : null}
          <Text className="flex-1 text-body font-medium" style={{ color: item.tone === "danger" ? t.danger : item.tone === "accent" ? t.accent : t.bone, minWidth: 0 }} numberOfLines={1}>
            {item.label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** A door with an arrow leaving it, 18 pt, drawn as views (no printed icon fits): the frame open at its right, the arrow out through it. */
function LeaveMark({ color, s }: { color: string; s: number }) {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: 18 * s, height: 18 * s }}>
      <View style={{ position: "absolute", left: 1 * s, top: 2 * s, width: 9 * s, height: 14 * s, borderWidth: 1.5 * s, borderRightWidth: 0, borderColor: color, borderTopLeftRadius: 2 * s, borderBottomLeftRadius: 2 * s }} />
      <View style={{ position: "absolute", left: 6 * s, top: 8.25 * s, width: 10 * s, height: 1.5 * s, backgroundColor: color }} />
      <View style={{ position: "absolute", left: 10 * s, top: 6 * s, width: 6 * s, height: 6 * s, borderTopWidth: 1.5 * s, borderRightWidth: 1.5 * s, borderColor: color, transform: [{ rotate: "45deg" }] }} />
    </View>
  );
}

// Moves the screen reader's focus to the first row. A module-level function: the React Compiler cannot compile a try/catch inside a component.
function focusRow(row: RefObject<PressableRef | null>): void {
  try {
    const node = row.current ? findNodeHandle(row.current) : null;
    if (node != null) AccessibilityInfo.setAccessibilityFocus(node);
  } catch {
    // A platform without accessibility focus has nothing to move.
  }
}

/**
 * The popover and the layer that closes it. Render it last among the table's panels so it sits over them. `place` positions it
 * (absolute, inside the safe-area insets); `origin` is the corner it grows from. `focusRef` is the first row: focus moves to it
 * when the popover opens, so a screen reader starts inside. The test ids are the caller's, so a flow keeps the ids it had.
 */
export function PopoverFrame({
  open,
  place,
  width,
  origin,
  ids,
  closeLabel,
  focusRef,
  surface,
  onClose,
  children,
}: {
  open: boolean;
  place: { top?: number; right?: number; bottom?: number; left?: number };
  width: number;
  origin: string;
  ids: { layer: string; scrim: string; popover: string };
  closeLabel: string;
  focusRef?: RefObject<PressableRef | null>;
  // `notice`: the banner's plain fill (the table menu, noticeSurface), opaque as every popover is; else the lit night card.
  surface?: "notice";
  onClose: () => void;
  children: ReactNode;
}) {
  const { progress, leaving, scale } = useOpenMotion(open, MOTION.menuEnter, MOTION.menuLeave);

  const fallback = useRef<PressableRef>(null);
  const first = focusRef ?? fallback;
  const t = useTableTokens();
  const s = useUiScale();
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => focusRow(first), ms(MOTION.menuEnter, scale));
    return () => clearTimeout(timer);
  }, [open, first, scale]);

  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, progress.get()));
    return { opacity: p, transform: [{ scale: FROM_SCALE + (1 - FROM_SCALE) * p }] };
  });

  if (!open && !leaving) return null;
  const look = surface === "notice" ? noticeSurface(FLOATING_ALPHA, t) : { ...floatingSurface(t), boxShadow: `${raisedEdgeOf(t)}, 0 12px 32px ${withAlphaHex(t.night, 0.65)}, 0 2px 6px ${withAlphaHex(t.night, 0.4)}` };
  return (
    // One modal layer: a screen reader stays inside the popover while it is open (the card preview does the same).
    <View testID={ids.layer} accessibilityViewIsModal={open} onAccessibilityEscape={open ? onClose : undefined} pointerEvents={open ? "box-none" : "none"} style={StyleSheet.absoluteFill}>
      {open ? <Pressable testID={ids.scrim} accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} style={StyleSheet.absoluteFill} /> : null}
      <Animated.View
        testID={ids.popover}
        pointerEvents={open ? "auto" : "none"}
        style={[
          {
            position: "absolute",
            ...place,
            width,
            padding: PAD * s,
            borderRadius: CONTAINER_RADIUS * s,
            ...look,
            transformOrigin: origin,
          },
          style,
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}
