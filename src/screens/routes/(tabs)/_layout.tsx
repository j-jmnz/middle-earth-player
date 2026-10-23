import { Tabs } from "expo-router";

import { PaperTabBar } from "../../chrome";

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <PaperTabBar {...props} />} screenOptions={{ headerShown: false, lazy: true }}>
      <Tabs.Screen name="index" options={{ title: "Campaigns" }} />
      <Tabs.Screen name="packs" options={{ title: "Packs", tabBarButtonTestID: "packs-tab" }} />
      <Tabs.Screen name="decks" options={{ title: "Decks" }} />
    </Tabs>
  );
}
