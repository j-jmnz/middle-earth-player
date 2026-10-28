// The dock of the tabs (docs/design-system.md, Components, AppTabBar). Re-exported by chrome.tsx.
import type { ComponentProps, ReactElement } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import type { Tabs } from "expo-router";

import { usePressedNight } from "./chrome-buttons";
import { usePalette } from "./palette-hook";
import { GameIcon } from "../play/game-icon";
import { iconAspect, type IconName } from "../play/icon-map";
import { withAlphaHex } from "../play/tokens";
import { useUiScale } from "../play/ui-scale";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

// A dock icon is 22 pt tall, and a wide one (the One Ring) may run to 30 pt across, so each carries about the same weight
// and the labels sit on one line.
const DOCK_ICON = 22;

const DOCK_ICON_WIDE = 30;

/** The `tabBarIcon` of a dock tab: one of the game's printed icons, gold on the current tab and faint on the others. */
export function dockIcon(name: IconName) {
  const aspect = iconAspect(name);
  const size = Math.round(Math.min(DOCK_ICON, DOCK_ICON_WIDE / aspect));
  return function DockIcon({ focused }: { focused: boolean }) {
    const s = useUiScale();
    return <GameIcon name={name} size={Math.round(size * s)} tint={focused ? "goldHigh" : "faint"} />;
  };
}

/** The `tabBarIcon` of a tab whose mark the icon font lacks and the chrome draws (the Settings gear): the same tint as a dock icon. */
export function drawnIcon(Mark: (props: { color: string; size?: number }) => ReactElement) {
  return function DrawnIcon({ focused }: { focused: boolean }) {
    const palette = usePalette();
    return <Mark color={focused ? palette.goldHigh : palette.faint} size={DOCK_ICON} />;
  };
}

/** The dock: six tabs, printed icons (a drawn gear for Settings) over their words on night. The current tab is lit: a gold bar glowing over a gold icon and word. */
export function AppTabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  const palette = usePalette();
  const pressedNight = usePressedNight();
  const s = useUiScale();
  // The icons and the bar grow with the scale but the words stay at Medium's size, so six labels fit across at Large (micro: 11 / 14 / 0.6).
  // On a narrow phone (a tab under 70 pt) "Campaigns" in semibold gets a point less and tighter letters, so it reads whole.
  const { width } = useWindowDimensions();
  const tight = width / state.routes.length < 70;
  const label = Math.min(s, 1);
  const labelSize = { fontSize: (tight ? 10 : 11) * label, lineHeight: 14 * label, letterSpacing: (tight ? 0.2 : 0.6) * label };
  return (
    <View accessibilityRole="tablist" className="flex-row border-t border-hairline bg-night pb-safe">
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        return (
          <Pressable
            key={route.key}
            testID={options.tabBarButtonTestID}
            collapsable={false}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={() => {
              const event = emitter.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigateToTab(route.key);
              }
            }}
            className="min-h-14 flex-1 items-center justify-center pb-1 pt-2.5"
            style={({ pressed }) => (pressed ? pressedNight : undefined)}
          >
            {focused ? (
              <View pointerEvents="none" style={{ position: "absolute", top: 0, width: 32 * s, height: 2, borderRadius: 1, backgroundColor: palette.gold, boxShadow: `0 0 10px 1px ${withAlphaHex(palette.gold, 0.6)}` }} />
            ) : null}
            {/* The icon in a fixed box, so each label sits on the same line; the label says the tab, the icon is not read. */}
            <View className="mb-1 items-center justify-center" style={{ height: DOCK_ICON * s }} importantForAccessibility="no-hide-descendants">
              {options.tabBarIcon?.({ focused, color: focused ? palette.goldHigh : palette.faint, size: DOCK_ICON * s })}
            </View>
            <Text className={focused ? "font-semibold text-goldHigh" : "text-faint"} style={labelSize} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
