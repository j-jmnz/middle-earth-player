// The tabs (docs/design-system.md, Navigation): a dock at the foot of a phone and a tablet in portrait, a rail down the left edge of an
// expanded window. Five hubs: Campaigns, Scenarios, Decks, Cards, Rules. Settings is a pushed screen, opened by the gear at the top
// right of each hub (`GearButton`) or, beside the rail, by the rail's own Settings at its foot. Re-exported by chrome.tsx.
import { type ComponentProps, type ReactElement, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, type Tabs } from "expo-router";

import { GearMark } from "../kit/chrome-marks";
import { IconButton } from "../kit/chrome-buttons";
import { useTitleShadow } from "../kit/chrome-text";
import { usePalette } from "../kit/palette-hook";
import { GameIcon } from "../../ui/game-icon";
import { iconAspect, type IconName } from "../../ui/icon-map";
import { raisedEdgeOf } from "../../ui/surfaces";
import { withAlphaHex } from "../../ui/tokens";
import { useTableTokens } from "../../ui/use-table-tokens";
import { RAIL } from "../../ui/size-class";
import { useUiScale } from "../../ui/ui-scale";
import { useSizeClass } from "../../ui/use-size-class";
import { Text } from "../../ui/text";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

// A dock icon is 24 pt tall (26 in the rail), and a wide one (the One Ring) may run to 32 pt across, so each carries about the same
// weight and the labels sit on one line.
const DOCK_ICON = 24;
const RAIL_ICON = 26;
const ICON_WIDE = 32;

// The dock's height above the home indicator, and the indicator's own room when the platform reports none (the handoff's 92 pt dock
// is 68 over a 24 pt inset).
const DOCK_HEIGHT = 68;
const DOCK_FOOT = 12;

/** The `tabBarIcon` of a tab: one of the game's printed icons, lit with a soft glow on the current tab and faint on the others. */
export function dockIcon(name: IconName) {
  return function DockIcon({ focused, size }: { focused: boolean; size?: number }) {
    const s = useUiScale();
    const palette = usePalette();
    const box = size ?? DOCK_ICON * s;
    const drawn = Math.round(Math.min(box, (ICON_WIDE * s) / iconAspect(name)));
    return (
      <View style={focused ? { filter: `drop-shadow(0 0 6px ${withAlphaHex(palette.glow, 0.7)})` } : undefined}>
        <GameIcon name={name} size={drawn} tint={focused ? "bone" : "faint"} />
      </View>
    );
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
 * (docs/design-system.md, Navigation). The tabs/_layout.tsx puts the bar where this draws it. Same tabs, testIDs and `tablist` role.
 */
export function AppTabBar(props: TabBarProps) {
  const { rail } = useSizeClass();
  return rail ? <RailTabBar {...props} /> : <DockTabBar {...props} />;
}

/**
 * The dock: five equal tabs, each a printed icon over its word in Marcellus SC, on a dark band that rises out of the page. The current
 * tab is lit: a short accent bar glowing across the top of its slot, a soft wash under it, its icon and word in bone.
 */
function DockTabBar(props: TabBarProps) {
  const { state } = props;
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const s = useUiScale();
  // The words stay at Medium's size at Large and Extra large, so five fit across a narrow phone.
  const labelScale = Math.min(s, 1);
  const t = useTableTokens();
  const light = t.depth === "light";
  return (
    <View
      accessibilityRole="tablist"
      className="flex-row"
      style={{
        minHeight: DOCK_HEIGHT * s + Math.max(insets.bottom, DOCK_FOOT),
        paddingBottom: Math.max(insets.bottom, DOCK_FOOT),
        paddingHorizontal: 6,
        backgroundColor: palette.night,
        backgroundImage: `linear-gradient(180deg, ${withAlphaHex(light ? palette.raisedTop : palette.raised, 0.94)}, ${light ? palette.raised : palette.night})`,
        boxShadow: light ? `${raisedEdgeOf(t)}, 0 -12px 30px ${withAlphaHex(t.shade, 0.18)}` : `inset 0 1px 0 ${withAlphaHex(palette.accentHigh, 0.12)}, 0 -18px 40px ${withAlphaHex(t.shade, 0.9)}`,
      }}
    >
      {state.routes.map((route, index) => {
        const { focused, options, word, button } = tabItem(props, route, index);
        return (
          <Pressable key={route.key} {...button} className="flex-1 items-center justify-center" style={{ minHeight: DOCK_HEIGHT * s, gap: 5 * s }}>
            {({ pressed }) => (
              <>
                {focused ? (
                  <>
                    <View pointerEvents="none" style={{ position: "absolute", top: 2, left: "8%", right: "8%", bottom: 4, backgroundImage: `radial-gradient(60% 70% at 50% 0%, ${withAlphaHex(palette.glow, 0.16)}, ${withAlphaHex(palette.glow, 0)})` }} />
                    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: "22%", right: "22%", height: 2, backgroundColor: palette.accentHigh, boxShadow: `0 0 12px 2px ${withAlphaHex(palette.glow, 0.85)}` }} />
                  </>
                ) : null}
                {pressed ? <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: withAlphaHex(palette.pressed, 0.5) }} /> : null}
                {/* The icon in a fixed box, so each label sits on the same line; the label says the tab, the icon is not read. */}
                <View className="items-center justify-center" style={{ height: DOCK_ICON * s }} importantForAccessibility="no-hide-descendants">
                  {options.tabBarIcon?.({ focused, color: focused ? palette.bone : palette.faint, size: DOCK_ICON * s })}
                </View>
                <Text
                  className="font-display"
                  style={{ fontSize: 12 * labelScale, lineHeight: 15 * labelScale, letterSpacing: 0.4 * labelScale, color: focused ? palette.bone : palette.faint }}
                  numberOfLines={1}
                  // Kept: five equal slots across a narrow phone, so a word the phone's larger text would widen shrinks to its slot; the bar grows in height only.
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {word}
                </Text>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The rail: 88 pt wide plus the left safe inset, a dark band falling off to its right. Each item is 72 pt tall, its icon over its 12 pt
 * word; Settings sits at the foot and pushes the Settings screen. The items scroll when the window is too short for them. The current
 * item has a 2 pt accent bar along its leading edge and a wash fading to the right.
 */
function RailTabBar(props: TabBarProps) {
  const { state } = props;
  const palette = usePalette();
  const router = useRouter();
  const s = useUiScale();
  const insets = useSafeAreaInsets();
  const labelScale = Math.min(s, 1);
  const label = (focused: boolean) => ({ fontSize: 12 * labelScale, lineHeight: 15 * labelScale, letterSpacing: 0.4 * labelScale, color: focused ? palette.bone : palette.faint });
  const t = useTableTokens();
  const light = t.depth === "light";
  const item = (key: string, focused: boolean, icon: ReactElement | undefined, word: string, button: object) => (
    <Pressable key={key} {...button} className="items-center justify-center" style={{ minHeight: 72 * s, gap: 6 * s }}>
      {({ pressed }) => (
        <>
          {focused ? (
            <>
              <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundImage: `linear-gradient(90deg, ${withAlphaHex(palette.glow, 0.12)}, ${withAlphaHex(palette.glow, 0)})` }} />
              <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, backgroundColor: palette.accentHigh, boxShadow: `0 0 12px 2px ${withAlphaHex(palette.glow, 0.6)}` }} />
            </>
          ) : null}
          {pressed ? <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: withAlphaHex(palette.pressed, 0.5) }} /> : null}
          <View className="items-center justify-center" style={{ height: RAIL_ICON * s }} importantForAccessibility="no-hide-descendants">
            {icon}
          </View>
          {/* Kept: the rail's tab is a fixed-width slot, as the dock's tabs are. */}
          <Text className="font-display" style={label(focused)} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {word}
          </Text>
        </>
      )}
    </Pressable>
  );
  return (
    <View
      accessibilityRole="tablist"
      style={{
        width: RAIL * s + insets.left,
        paddingLeft: insets.left,
        backgroundColor: palette.night,
        backgroundImage: `linear-gradient(90deg, ${withAlphaHex(light ? palette.raised : palette.night, 0.96)}, ${withAlphaHex(light ? palette.raisedTop : palette.dusk, 0.88)})`,
        boxShadow: `18px 0 40px ${withAlphaHex(t.shade, light ? 0.18 : 0.8)}`,
        zIndex: 1,
      }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: Math.max(insets.top, 36 * s), paddingBottom: Math.max(insets.bottom, 24 * s) }} showsVerticalScrollIndicator={false}>
        {state.routes.map((route, index) => {
          const { focused, options, word, button } = tabItem(props, route, index);
          return item(route.key, focused, options.tabBarIcon?.({ focused, color: focused ? palette.bone : palette.faint, size: RAIL_ICON * s }) as ReactElement | undefined, word, button);
        })}
        <View className="mt-auto">
          {item("settings", false, <GearMark color={palette.faint} size={RAIL_ICON * s} />, "Settings", {
            testID: "settings-open",
            collapsable: false,
            accessibilityRole: "button",
            accessibilityLabel: "Settings",
            onPress: () => router.push("/settings"),
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/** The round gear at the top right of a hub: it pushes Settings. Beside the rail it is not drawn, since the rail holds Settings. */
export function GearButton() {
  const router = useRouter();
  const { rail } = useSizeClass();
  if (rail) return null;
  return <IconButton label="Settings" testID="settings-open" mark={GearMark} onPress={() => router.push("/settings")} />;
}

/**
 * The head of a hub: its title in Marcellus SC (24 pt on a phone, 30 on a tablet) on the left, the hub's own controls and the gear on
 * the right. No line under the title (user request, 2026-11-08: no filler subtitles).
 */
export function HubHeader({ title, children }: { title: string; children?: ReactNode }) {
  const { size, s } = useSizeClass();
  const shadow = useTitleShadow();
  const big = size === "compact" ? 24 : 30;
  return (
    <View className="pb-3 pt-2">
      <View className="flex-row flex-wrap items-center justify-between gap-2" style={{ minHeight: 48 * s }}>
        <Text accessibilityRole="header" numberOfLines={1} className="shrink-0 font-display text-bone" style={{ fontSize: big * s, lineHeight: big * 1.25 * s, letterSpacing: 0.5 * s, ...shadow }}>
          {title}
        </Text>
        <View className="ml-auto max-w-full shrink flex-row flex-wrap items-center justify-end" style={{ gap: 8 * s, rowGap: 8 * s }}>
          {children}
          <GearButton />
        </View>
      </View>
    </View>
  );
}
