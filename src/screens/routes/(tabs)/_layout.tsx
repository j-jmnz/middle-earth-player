import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, lazy: true }}>
      <Tabs.Screen name="index" options={{ title: "Campaigns" }} />
      <Tabs.Screen
        name="packs"
        options={{ title: "Packs", tabBarButtonTestID: "packs-tab" }}
      />
      <Tabs.Screen name="decks" options={{ title: "Decks" }} />
    </Tabs>
  );
}
