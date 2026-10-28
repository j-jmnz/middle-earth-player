// The frame of the table's popovers (docs/design-system.md, Table, Table menu): a lit night card (tileSurface) with a deep shadow
// and rounded-card corners, its rows inset rounded plates, that scales in from the corner it hangs from (MOTION.menuEnter ease-out from 0.96, MOTION.menuLeave ease-in), the layer
// that holds it, and a Pressable scrim that fills the screen under it so a tap outside closes it and does nothing else. Not a
// Modal: a Modal takes over the orientation lock and the status bar. The table menu (table-menu.tsx) and the dock's More
// popover (dock-more.tsx) both draw in it; Android Back closes either first (back.ts).
import { useEffect, useRef, type ComponentRef, type ReactNode, type RefObject } from "react";
import { AccessibilityInfo, findNodeHandle, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { GameIcon } from "./game-icon.tsx";
import type { IconName } from "./icon-map.ts";
import { useOpenMotion } from "./motion-run.ts";
import { MOTION, ms } from "./motion-tokens.ts";
import { Chevron } from "./phase-rail.tsx";
import { raisedEdgeOf, tileSurface } from "./surfaces.ts";
import { withAlphaHex } from "./tokens.ts";
import { useTableTokens } from "./use-table-tokens.ts";

export type PressableRef = ComponentRef<typeof Pressable>;
const ROW = 48;
const FROM_SCALE = 0.96;
// The frame's inner padding: rows sit this far inside its edge, so their pressed fill is a rounded plate of its own.
const PAD = 6;

export type PopoverRowItem = {
  testID: string;
  label: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  icon?: IconName | null;
  // A mark drawn as views when no printed icon fits: the door of Leave the table.
  glyph?: "leave";
  // The row opens a screen or a panel: a chevron at its right says so.
  opens?: boolean;
};

/** One 48 pt row of a popover: a rounded plate inside the frame's padding that fills when pressed. */
export function PopoverRow({ item, onPress, rowRef }: { item: PopoverRowItem; onPress: () => void; rowRef?: RefObject<PressableRef | null> }) {
  const t = useTableTokens();
  return (
    <Pressable
      ref={rowRef}
      testID={item.testID}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={item.accessibilityLabel ?? item.label}
      accessibilityHint={item.accessibilityHint}
      onPress={onPress}
      style={{ minHeight: ROW }}
    >
      {({ pressed }) => (
        <View
          style={{
            minHeight: ROW,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 10,
            borderRadius: 10,
            backgroundColor: pressed ? t.pressed : "transparent",
          }}
        >
          {item.icon ? <GameIcon name={item.icon} size={18} tint="bone" /> : null}
          {item.glyph === "leave" ? <LeaveMark color={t.muted} /> : null}
          <Text className="flex-1 text-body font-medium" style={{ color: t.bone, minWidth: 0 }} numberOfLines={1}>
            {item.label}
          </Text>
          {item.opens ? <Chevron direction="next" color={t.faint} /> : null}
        </View>
      )}
    </Pressable>
  );
}

/** A door with an arrow leaving it, 18 pt, drawn as views (no printed icon fits): the frame open at its right, the arrow out through it. */
function LeaveMark({ color }: { color: string }) {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: 18, height: 18 }}>
      <View style={{ position: "absolute", left: 1, top: 2, width: 9, height: 14, borderWidth: 1.5, borderRightWidth: 0, borderColor: color, borderTopLeftRadius: 2, borderBottomLeftRadius: 2 }} />
      <View style={{ position: "absolute", left: 6, top: 8.25, width: 10, height: 1.5, backgroundColor: color }} />
      <View style={{ position: "absolute", left: 10, top: 6, width: 6, height: 6, borderTopWidth: 1.5, borderRightWidth: 1.5, borderColor: color, transform: [{ rotate: "45deg" }] }} />
    </View>
  );
}

/** A hairline between groups of rows. */
export function PopoverDivider() {
  const t = useTableTokens();
  return <View style={{ height: 1, marginVertical: 4, marginHorizontal: 10, backgroundColor: t.hairline }} />;
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
  onClose: () => void;
  children: ReactNode;
}) {
  const { progress, leaving, scale } = useOpenMotion(open, MOTION.menuEnter, MOTION.menuLeave);

  const fallback = useRef<PressableRef>(null);
  const first = focusRef ?? fallback;
  const t = useTableTokens();
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      try {
        const node = first.current ? findNodeHandle(first.current) : null;
        if (node != null) AccessibilityInfo.setAccessibilityFocus(node);
      } catch {
        // A platform without accessibility focus has nothing to move.
      }
    }, ms(MOTION.menuEnter, scale));
    return () => clearTimeout(timer);
  }, [open, first, scale]);

  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, progress.get()));
    return { opacity: p, transform: [{ scale: FROM_SCALE + (1 - FROM_SCALE) * p }] };
  });

  if (!open && !leaving) return null;
  return (
    // One modal layer: a screen reader stays inside the popover while it is open (the card preview does the same).
    <View testID={ids.layer} accessibilityViewIsModal={open} pointerEvents={open ? "box-none" : "none"} style={StyleSheet.absoluteFill}>
      {open ? <Pressable testID={ids.scrim} accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} style={StyleSheet.absoluteFill} /> : null}
      <Animated.View
        testID={ids.popover}
        pointerEvents={open ? "auto" : "none"}
        style={[
          {
            position: "absolute",
            ...place,
            width,
            padding: PAD,
            borderRadius: 16, // rounded-card
            ...tileSurface(false, t),
            boxShadow: `${raisedEdgeOf(t)}, 0 12px 32px ${withAlphaHex(t.night, 0.65)}, 0 2px 6px ${withAlphaHex(t.night, 0.4)}`,
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
