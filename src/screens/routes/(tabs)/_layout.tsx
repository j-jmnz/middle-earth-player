import { Tabs } from "expo-router";

import { AppTabBar } from "../../chrome";
import { palette } from "../../palette.js";

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{ headerShown: false, lazy: true, sceneStyle: { backgroundColor: palette.night } }}
    >
      <Tabs.Screen name="index" options={{ title: "Campaigns" }} />
      <Tabs.Screen name="scenarios" options={{ title: "Scenarios", tabBarButtonTestID: "scenarios-tab" }} />
      <Tabs.Screen name="packs" options={{ title: "Packs", tabBarButtonTestID: "packs-tab" }} />
      <Tabs.Screen name="decks" options={{ title: "Decks", tabBarButtonTestID: "decks-tab" }} />
    </Tabs>
  );
}
