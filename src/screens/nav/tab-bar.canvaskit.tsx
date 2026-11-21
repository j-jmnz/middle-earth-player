// The tabs on the web and the desktop (the phone's are tab-bar.tsx, unchanged; metro.config.js serves this file in its place on the web platform only, and it imports
// the phone's without the file extension, so the phone's bundle never sees it). It adds one rule (docs/design-system.md, Tablets): in a window shorter than 480 pt,
// which only a desktop window can be, the rail's items are compacted to the height the window has (rail-fit.ts), so every tab and Settings are on screen with no scroll.
// Otherwise it is the phone's bar.
import { type ComponentProps, type ReactElement } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, type Tabs } from "expo-router";

import { AppTabBar as PhoneTabBar, pressSettings, tabItem } from "./tab-bar";
import { compactItemHeight, COMPACT_PAD } from "./rail-fit";
import { GearMark } from "../kit/chrome-marks";
import { usePalette } from "../kit/palette-hook";
import { RAIL } from "../../ui/size-class";
import { Text } from "../../ui/text";
import { useSizeClass } from "../../ui/use-size-class";
import { useTableTokens } from "../../ui/use-table-tokens";
import { withAlphaHex } from "../../ui/tokens";

export { dockIcon, GearButton, HubHeader } from "./tab-bar";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

/** The tabs: the phone's bar, and in a short window beside a rail the compact rail. */
export function AppTabBar(props: TabBarProps) {
  const { rail, short } = useSizeClass();
  return rail && short ? <CompactRail {...props} /> : <PhoneTabBar {...props} />;
}

// One item: its icon over its word, the current one with the rail's accent bar and wash. It is as tall as the window allows.
function RailItem({ height, focused, icon, word, button }: { height: number; focused: boolean; icon: ReactElement | undefined; word: string; button: object }) {
  const palette = usePalette();
  return (
    <Pressable {...button} className="items-center justify-center" style={{ height, gap: 2 }}>
      {({ pressed }) => (
        <>
          {focused ? (
            <>
              <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundImage: `linear-gradient(90deg, ${withAlphaHex(palette.glow, 0.12)}, ${withAlphaHex(palette.glow, 0)})` }} />
              <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, backgroundColor: palette.accentHigh, boxShadow: `0 0 12px 2px ${withAlphaHex(palette.glow, 0.6)}` }} />
            </>
          ) : null}
          {pressed ? <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: withAlphaHex(palette.pressed, 0.5) }} /> : null}
          <View className="items-center justify-center" style={{ height: 22 }} importantForAccessibility="no-hide-descendants">
            {icon}
          </View>
          <Text className="font-display" style={{ fontSize: 12, lineHeight: 14, letterSpacing: 0.4, color: focused ? palette.bone : palette.faint }} numberOfLines={1}>
            {word}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function CompactRail(props: TabBarProps) {
  const { state } = props;
  const palette = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, s } = useSizeClass();
  const t = useTableTokens();
  const light = t.depth === "light";
  const each = compactItemHeight(height, s, state.routes.length + 1);
  return (
    <View
      accessibilityRole="tablist"
      style={{
        width: RAIL * s + insets.left,
        paddingLeft: insets.left,
        paddingVertical: COMPACT_PAD,
        backgroundColor: palette.night,
        backgroundImage: `linear-gradient(90deg, ${withAlphaHex(light ? palette.raised : palette.night, 0.96)}, ${withAlphaHex(light ? palette.raisedTop : palette.dusk, 0.88)})`,
        boxShadow: `18px 0 40px ${withAlphaHex(t.shade, light ? 0.18 : 0.8)}`,
        zIndex: 1,
      }}
    >
      {state.routes.map((route, index) => {
        // The phone's tab press, with its sound (tab-bar.tsx, tabItem).
        const { focused, options, word, button } = tabItem(props, route, index);
        return <RailItem key={route.key} height={each} focused={focused} icon={options.tabBarIcon?.({ focused, color: focused ? palette.bone : palette.faint, size: 22 }) as ReactElement | undefined} word={word} button={button} />;
      })}
      <View style={{ marginTop: "auto" }}>
        <RailItem
          height={each}
          focused={false}
          icon={<GearMark color={palette.faint} size={22} />}
          word="Settings"
          button={{ testID: "settings-open", collapsable: false, accessibilityRole: "button", accessibilityLabel: "Settings", onPress: pressSettings(router) }}
        />
      </View>
    </View>
  );
}
