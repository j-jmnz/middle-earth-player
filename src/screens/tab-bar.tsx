// The dock of the tabs (docs/design-system.md, Components, AppTabBar). Re-exported by chrome.tsx.
import type { ComponentProps, ReactElement } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Tabs } from "expo-router";

import { usePressedNight } from "./chrome-buttons";
import { usePalette } from "./palette-hook";
import { GameIcon } from "../play/game-icon";
import { iconAspect, type IconName } from "../play/icon-map";
import { withAlphaHex } from "../play/tokens";
import { RAIL } from "../play/size-class";
import { useUiScale } from "../play/ui-scale";
import { useSizeClass } from "../play/use-size-class";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

// A dock icon is 22 pt tall, and a wide one (the One Ring) may run to 30 pt across, so each carries about the same weight
// and the labels sit on one line.
const DOCK_ICON = 22;

const DOCK_ICON_WIDE = 30;

/** The `tabBarIcon` of a dock tab: one of the game's printed icons, accent on the current tab and faint on the others. */
export function dockIcon(name: IconName) {
  const aspect = iconAspect(name);
  const size = Math.round(Math.min(DOCK_ICON, DOCK_ICON_WIDE / aspect));
  return function DockIcon({ focused }: { focused: boolean }) {
    const s = useUiScale();
    return <GameIcon name={name} size={Math.round(size * s)} tint={focused ? "accentHigh" : "faint"} />;
  };
}

/** The `tabBarIcon` of a tab whose mark the icon font lacks and the chrome draws (the Settings gear): the same tint as a dock icon. */
export function drawnIcon(Mark: (props: { color: string; size?: number }) => ReactElement) {
  return function DrawnIcon({ focused }: { focused: boolean }) {
    const palette = usePalette();
    return <Mark color={focused ? palette.accentHigh : palette.faint} size={DOCK_ICON} />;
  };
}

/**
 * What a tab's button shares in the dock and the rail: whether it is the current one, the word that names it, and the props that make
 * it a tab to a screen reader and press it (the tabPress event, then the navigation unless it was prevented).
 */
function tabItem(props: TabBarProps, route: TabBarProps["state"]["routes"][number], index: number) {
  const { state, descriptors, emitter, navigateToTab } = props;
  const focused = state.index === index;
  const { options } = descriptors[route.key];
  return {
    focused,
    options,
    word: options.title ?? route.name,
    button: {
      testID: options.tabBarButtonTestID,
      collapsable: false,
      accessibilityRole: "tab" as const,
      accessibilityState: { selected: focused },
      accessibilityLabel: options.tabBarAccessibilityLabel,
      onPress: () => {
        const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
        if (!focused && !event.defaultPrevented) navigateToTab(route.key);
      },
    },
  };
}

/**
 * The tabs: a dock at the foot of the screen, or in an expanded window (a tablet in landscape) a rail down the left edge
 * (docs/design-system.md, Tablets). The tabs/_layout.tsx puts the bar where this draws it. Same tabs, testIDs and `tablist` role.
 */
export function AppTabBar(props: TabBarProps) {
  const { rail } = useSizeClass();
  return rail ? <RailTabBar {...props} /> : <DockTabBar {...props} />;
}

/** The dock: six tabs, printed icons (a drawn gear for Settings) over their words on night. The current tab is lit: an accent bar glowing over an accent icon and word. */
function DockTabBar(props: TabBarProps) {
  const { state } = props;
  const palette = usePalette();
  const pressedNight = usePressedNight();
  const { width, s } = useSizeClass();
  // The icons and the bar grow with the scale but the words stay at Medium's size, so six labels fit across at Large (micro: 11 / 14 / 0.6).
  // On a narrow phone (a tab under 70 pt) "Campaigns" in semibold gets a point less and tighter letters, so it reads whole.
  const tight = width / state.routes.length < 70;
  const labelScale = Math.min(s, 1);
  const labelSize = { fontSize: (tight ? 10 : 11) * labelScale, lineHeight: 14 * labelScale, letterSpacing: (tight ? 0.2 : 0.6) * labelScale };
  return (
    <View accessibilityRole="tablist" className="flex-row border-t border-hairline bg-night pb-safe">
      {state.routes.map((route, index) => {
        const { focused, options, word, button } = tabItem(props, route, index);
        return (
          <Pressable
            key={route.key}
            {...button}
            className="min-h-14 flex-1 items-center justify-center pb-1 pt-2.5"
            style={({ pressed }) => (pressed ? pressedNight : undefined)}
          >
            {focused ? (
              <View pointerEvents="none" style={{ position: "absolute", top: 0, width: 32 * s, height: 2, borderRadius: 1, backgroundColor: palette.accent, boxShadow: `0 0 10px 1px ${withAlphaHex(palette.accent, 0.6)}` }} />
            ) : null}
            {/* The icon in a fixed box, so each label sits on the same line; the label says the tab, the icon is not read. */}
            <View className="mb-1 items-center justify-center" style={{ height: DOCK_ICON * s }} importantForAccessibility="no-hide-descendants">
              {options.tabBarIcon?.({ focused, color: focused ? palette.accentHigh : palette.faint, size: DOCK_ICON * s })}
            </View>
            <Text className={focused ? "font-semibold text-accentHigh" : "text-faint"} style={labelSize} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {word}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The rail: 88 pt wide plus the left safe inset, on night with a hairline right edge. Each item is at least 64 pt tall, its icon over
 * its 12 pt word; Settings sits at the foot. The items scroll when the window is too short for them. The current item has a 2 pt
 * accent bar glowing along its leading edge and a faint accent wash behind it, over an accentHigh icon and word.
 */
function RailTabBar(props: TabBarProps) {
  const { state } = props;
  const palette = usePalette();
  const pressedNight = usePressedNight();
  const s = useUiScale();
  const insets = useSafeAreaInsets();
  const labelScale = Math.min(s, 1);
  const labelSize = { fontSize: 12 * labelScale, lineHeight: 15 * labelScale, letterSpacing: 0.5 * labelScale };
  return (
    <View
      accessibilityRole="tablist"
      style={{ width: RAIL * s + insets.left, paddingLeft: insets.left, backgroundColor: palette.night, borderRightWidth: 1, borderRightColor: palette.hairline }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: Math.max(insets.top, 12 * s), paddingBottom: Math.max(insets.bottom, 12 * s) }} showsVerticalScrollIndicator={false}>
        {state.routes.map((route, index) => {
          const { focused, options, word, button } = tabItem(props, route, index);
          return (
            <Pressable
              key={route.key}
              {...button}
              className={`min-h-16 items-center justify-center px-1 py-2 ${route.name === "settings" ? "mt-auto" : ""}`}
              style={({ pressed }) => (pressed ? pressedNight : focused ? { backgroundColor: withAlphaHex(palette.accent, 0.11) } : undefined)}
            >
              {focused ? (
                <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, borderRadius: 1, backgroundColor: palette.accent, boxShadow: `0 0 10px 1px ${withAlphaHex(palette.accent, 0.6)}` }} />
              ) : null}
              <View className="mb-1 items-center justify-center" style={{ height: DOCK_ICON * s }} importantForAccessibility="no-hide-descendants">
                {options.tabBarIcon?.({ focused, color: focused ? palette.accentHigh : palette.faint, size: DOCK_ICON * s })}
              </View>
              <Text className={focused ? "font-semibold text-accentHigh" : "text-faint"} style={labelSize} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9}>
                {word}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
