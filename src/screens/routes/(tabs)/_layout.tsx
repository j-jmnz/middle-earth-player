import { Tabs } from "expo-router";
import { useMemo, type ReactNode } from "react";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";

import { AppTabBar, dockIcon } from "../../chrome";
import { usePalette } from "../../palette-hook";
import { useSizeClass } from "../../../ui/use-size-class";

// The dock: the campaigns to play, a scenario played on its own, the decks to play them with, every card, and the rules to look up
// between turns (docs/design-system.md, Navigation). Each tab carries one of the game's printed icons (RingsDB font): the One Ring for
// the saga, the crossed axes for a single battle, a hero for the decks built around them, the unique star for the card pool, and the
// Lore book for the rules. Settings is not a tab: the gear on each hub, or the rail's foot, pushes it. In an expanded window (a tablet
// in landscape) the dock becomes a rail down the left edge.
export default function TabLayout() {
  const palette = usePalette();
  const { rail } = useSizeClass();
  const insets = useSafeAreaInsets();
  const beside = useMemo(() => ({ ...insets, left: 0 }), [insets]);
  return (
    <Tabs
      // A tab not on screen is hidden (React Activity: its effects stop and its renders wait, its state stays). This is expo-router 58's freezeOnBlur, which it ignores.
      activityEnabled
      tabBar={(props) => <AppTabBar {...props} />}
      // The rail takes the left safe inset, so a screen beside it must not pad for it again. Only while the rail shows: a phone keeps its tree.
      screenLayout={rail ? ({ children }: { children: ReactNode }) => <SafeAreaInsetsContext.Provider value={beside}>{children}</SafeAreaInsetsContext.Provider> : undefined}
      screenOptions={{ headerShown: false, lazy: true, sceneStyle: { backgroundColor: palette.night }, tabBarPosition: rail ? "left" : "bottom" }}
    >
      <Tabs.Screen name="index" options={{ tabBarIcon: dockIcon("oneRing"), title: "Campaigns", tabBarButtonTestID: "campaigns-tab" }} />
      <Tabs.Screen name="scenarios" options={{ tabBarIcon: dockIcon("attack"), title: "Scenarios", tabBarButtonTestID: "scenarios-tab" }} />
      <Tabs.Screen name="decks" options={{ tabBarIcon: dockIcon("hero"), title: "Decks", tabBarButtonTestID: "decks-tab" }} />
      <Tabs.Screen name="cards" options={{ tabBarIcon: dockIcon("unique"), title: "Cards", tabBarButtonTestID: "cards-tab" }} />
      <Tabs.Screen name="rules" options={{ tabBarIcon: dockIcon("lore"), title: "Rules", tabBarButtonTestID: "rules-tab" }} />
    </Tabs>
  );
}
