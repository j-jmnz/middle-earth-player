// The table menu (docs/design-system.md, Table, top bar): Leave the table, Log, Rules, Booklet and Table settings, in a
// popover under the menu button at the top right. React Native views over the canvas, never on the canvas. The outside tap
// is a Pressable that fills the screen under the popover, not a Modal: a Modal takes over the orientation lock and the status
// bar. A row closes the menu and then acts (the caller's onSelect). Android Back closes it first (back.ts).
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { GameIcon } from "./game-icon.tsx";
import { menuItems, type MenuItem, type MenuItemId, type MenuNav } from "./table-menu-items.ts";
import { tableTokens as t } from "./tokens.ts";

export const MENU_WIDTH = 240;
const ROW = 48;
// Motion values for phase 23's motion-tokens.ts: in 200 ms ease-out from scale 0.96 at the top right, out 150 ms ease-in.
const ENTER_MS = 200;
const LEAVE_MS = 150;
const FROM_SCALE = 0.96;

/** The 44 pt button at the right of the top bar: three dots drawn as views (no printed icon fits). */
export function MenuButton({ open, onPress }: { open: boolean; onPress: () => void }) {
  return (
    <Pressable
      testID="table-menu"
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel="Menu"
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
    >
      {({ pressed }) => (
        <View
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: pressed || open ? t.pressed : "transparent" }}
        >
          {[0, 1, 2].map((dot) => (
            <View key={dot} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: open ? t.gold : t.bone }} />
          ))}
        </View>
      )}
    </Pressable>
  );
}

function Row({ item, onPress }: { item: MenuItem; onPress: () => void }) {
  return (
    <View>
      <Pressable
        testID={item.testID}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={item.accessibilityLabel}
        accessibilityHint={item.accessibilityHint}
        onPress={onPress}
        style={{ minHeight: ROW }}
      >
        {({ pressed }) => (
          <View style={{ minHeight: ROW, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, backgroundColor: pressed ? t.pressed : "transparent" }}>
            {item.icon ? <GameIcon name={item.icon} size={18} tint="bone" /> : null}
            <Text className="flex-1 text-body font-medium" style={{ color: t.bone }} numberOfLines={1}>
              {item.label}
            </Text>
            {item.detail ? (
              <Text className="text-label" style={{ color: t.muted }} numberOfLines={1}>
                {item.detail}
              </Text>
            ) : null}
          </View>
        )}
      </Pressable>
      {item.note ? (
        <Text className="text-label" style={{ color: t.muted, paddingHorizontal: 14, paddingBottom: 8, marginTop: -4 }}>
          {item.note}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The popover and the layer that closes it. Render it last among the table's panels so it sits over them. `top` and `right`
 * place it under the menu button, inside the safe-area insets.
 */
export function TableMenu({ open, nav, top, right, onClose, onSelect }: { open: boolean; nav: MenuNav; top: number; right: number; onClose: () => void; onSelect: (id: MenuItemId) => void }) {
  const reduceMotion = useReducedMotion();
  // The popover stays mounted while it leaves (`leaving`), set while rendering when `open` turns off, not from an effect.
  const [wasOpen, setWasOpen] = useState(open);
  const [leaving, setLeaving] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    setLeaving(!open && !reduceMotion);
  }
  const progress = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    if (open) progress.set(reduceMotion ? 1 : withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) }));
    else if (reduceMotion) progress.set(0);
    else {
      progress.set(
        withTiming(0, { duration: LEAVE_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) scheduleOnRN(setLeaving, false);
        }),
      );
    }
  }, [open, reduceMotion, progress]);

  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, progress.get()));
    return { opacity: p, transform: [{ scale: FROM_SCALE + (1 - FROM_SCALE) * p }] };
  });

  if (!open && !leaving) return null;
  return (
    <>
      {open ? (
        <Pressable
          testID="table-menu-scrim"
          accessibilityRole="button"
          accessibilityLabel="Close the menu"
          onPress={onClose}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        />
      ) : null}
      <Animated.View
        testID="table-menu-popover"
        pointerEvents={open ? "auto" : "none"}
        style={[
          {
            position: "absolute",
            top,
            right,
            width: MENU_WIDTH,
            paddingVertical: 4,
            borderRadius: 20, // rounded-card
            borderWidth: 1,
            borderColor: t.hairline,
            backgroundColor: t.raised,
            transformOrigin: "100% 0%",
            shadowColor: t.night,
            shadowOpacity: 0.4,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
          },
          style,
        ]}
      >
        {menuItems(nav).map((item) => (
          <Row key={item.id} item={item} onPress={() => onSelect(item.id)} />
        ))}
      </Animated.View>
    </>
  );
}
