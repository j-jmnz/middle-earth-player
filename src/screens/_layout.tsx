import "react-native-gesture-handler";
import "../../global.css";

import { useEffect } from "react";
import { Appearance, type ColorSchemeName } from "react-native";
import { Tabs } from "expo-router";
import { colorScheme } from "nativewind";

function applyColorScheme(scheme: ColorSchemeName | null) {
  colorScheme.set(scheme === "dark" ? "dark" : "light");
}

export default function RootLayout() {
  useEffect(() => {
    applyColorScheme(Appearance.getColorScheme());
    const subscription = Appearance.addChangeListener(({ colorScheme: scheme }) => {
      applyColorScheme(scheme);
    });
    return () => subscription.remove();
  }, []);

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Campaigns" }} />
      <Tabs.Screen name="decks" options={{ title: "Decks" }} />
    </Tabs>
  );
}
