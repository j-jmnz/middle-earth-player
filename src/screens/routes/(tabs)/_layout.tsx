import { Tabs } from "expo-router";

import { AppTabBar } from "../../chrome";
import { palette } from "../../palette.js";

// The dock: the campaigns to play, the decks to play them with, every card, and the rules to look up between turns.
export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{ headerShown: false, lazy: true, sceneStyle: { backgroundColor: palette.night } }}
    >
      <Tabs.Screen name="index" options={{ title: "Campaigns", tabBarButtonTestID: "campaigns-tab" }} />
      <Tabs.Screen name="decks" options={{ title: "Decks", tabBarButtonTestID: "decks-tab" }} />
      <Tabs.Screen name="cards" options={{ title: "Cards", tabBarButtonTestID: "cards-tab" }} />
      <Tabs.Screen name="rules" options={{ title: "Rules", tabBarButtonTestID: "rules-tab" }} />
    </Tabs>
  );
}
