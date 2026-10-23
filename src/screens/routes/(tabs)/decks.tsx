import { View } from "react-native";

import { BodyText, Screen, ScreenTitle } from "../../chrome";

export default function Decks() {
  return (
    <Screen testID="decks">
      <View className="pt-6">
        <ScreenTitle>Decks</ScreenTitle>
      </View>
      <BodyText tone="muted" className="mt-6">
        The deck editor is not in this build.
      </BodyText>
    </Screen>
  );
}
