import { Tabs } from "expo-router";

import { AppTabBar, GearMark, dockIcon, drawnIcon } from "../../chrome";
import { usePalette } from "../../palette-hook";

// The dock: the campaigns to play, a scenario played on its own, the decks to play them with, every card, and the rules to
// look up between turns, and the settings (user request, 2026-10-28). Each tab carries one of the game's printed icons (RingsDB
// font): the One Ring for the saga, the crossed axes for a single battle, a hero for the decks built around them, the unique star
// for the card pool, and the Lore book for the rules. The font has no gear, so Settings draws its own.
export default function TabLayout() {
  const palette = usePalette();
  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{ headerShown: false, lazy: true, sceneStyle: { backgroundColor: palette.night } }}
    >
      <Tabs.Screen name="index" options={{ tabBarIcon: dockIcon("oneRing"), title: "Campaigns", tabBarButtonTestID: "campaigns-tab" }} />
      <Tabs.Screen name="scenarios" options={{ tabBarIcon: dockIcon("attack"), title: "Scenarios", tabBarButtonTestID: "scenarios-tab" }} />
      <Tabs.Screen name="decks" options={{ tabBarIcon: dockIcon("hero"), title: "Decks", tabBarButtonTestID: "decks-tab" }} />
      <Tabs.Screen name="cards" options={{ tabBarIcon: dockIcon("unique"), title: "Cards", tabBarButtonTestID: "cards-tab" }} />
      <Tabs.Screen name="rules" options={{ tabBarIcon: dockIcon("lore"), title: "Rules", tabBarButtonTestID: "rules-tab" }} />
      <Tabs.Screen name="settings" options={{ tabBarIcon: drawnIcon(GearMark), title: "Settings", tabBarButtonTestID: "settings-tab" }} />
    </Tabs>
  );
}
