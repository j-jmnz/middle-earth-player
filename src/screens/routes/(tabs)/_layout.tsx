import { Tabs } from "expo-router";
import { useEffect, useMemo, type ReactNode } from "react";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";

import { AppTabBar, dockIcon } from "../../kit/chrome";
import { usePalette } from "../../kit/palette-hook";
import { markHubWarm } from "../../nav/tabs-warm";
import { useSizeClass } from "../../../ui/use-size-class";

// The dock: the campaigns to play, a scenario played on its own, the decks to play them with, every card, and the rules to look up
// between turns (docs/design-system.md, Navigation). Each tab carries one of the game's printed icons (RingsDB font): the One Ring for
// the saga, the crossed axes for a single battle, a hero for the decks built around them, the unique star for the card pool, and the
// Lore book for the rules. Settings is not a tab: the gear on each hub, or the rail's foot, pushes it. In an expanded window (a tablet
// in landscape) the dock becomes a rail down the left edge.

// A hub's screen: it tells the splash it has mounted (nav/tabs-warm.ts). A parent's effect runs after its children's, so the hub's own first effects have run.
function Hub({ name, children }: { name: string; children: ReactNode }) {
  useEffect(() => {
    markHubWarm(name);
  }, [name]);
  return children;
}

export default function TabLayout() {
  const palette = usePalette();
  const { rail } = useSizeClass();
  const insets = useSafeAreaInsets();
  const beside = useMemo(() => ({ ...insets, left: 0 }), [insets]);
  return (
    <Tabs
      // Every hub mounts at launch, behind the splash (lazy off; nav/tabs-warm.ts), and stays live when another has the focus: no React Activity here.
      // A hub hidden by Activity lays out no list until it is first shown and runs every effect again on each return, which is the wait a quick
      // switch between tabs showed. The stack above still hides the hubs under two pushed screens (routes/_layout.tsx).
      activityEnabled={false}
      tabBar={(props) => <AppTabBar {...props} />}
      // The rail takes the left safe inset, so a screen beside it must not pad for it again. One tree for both, so a turn of the tablet keeps the hub mounted.
      screenLayout={({ children, route }: { children: ReactNode; route: { name: string } }) => (
        <Hub name={route.name}>
          <SafeAreaInsetsContext.Provider value={rail ? beside : insets}>{children}</SafeAreaInsetsContext.Provider>
        </Hub>
      )}
      screenOptions={{ headerShown: false, lazy: false, sceneStyle: { backgroundColor: palette.night }, tabBarPosition: rail ? "left" : "bottom" }}
    >
      <Tabs.Screen name="index" options={{ tabBarIcon: dockIcon("oneRing"), title: "Campaigns", tabBarButtonTestID: "campaigns-tab" }} />
      <Tabs.Screen name="scenarios" options={{ tabBarIcon: dockIcon("attack"), title: "Scenarios", tabBarButtonTestID: "scenarios-tab" }} />
      <Tabs.Screen name="decks" options={{ tabBarIcon: dockIcon("hero"), title: "Decks", tabBarButtonTestID: "decks-tab" }} />
      <Tabs.Screen name="cards" options={{ tabBarIcon: dockIcon("unique"), title: "Cards", tabBarButtonTestID: "cards-tab" }} />
      <Tabs.Screen name="rules" options={{ tabBarIcon: dockIcon("lore"), title: "Rules", tabBarButtonTestID: "rules-tab" }} />
    </Tabs>
  );
}
