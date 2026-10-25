import { View } from "react-native";

import { ScreenTitle } from "../../chrome";
import { RulesView } from "../../rules-view";

// The rules a player reaches for mid-game: the two books in the reader, and every rule span searchable by name.
export default function Rules() {
  return (
    <RulesView
      testID="rules"
      books
      header={
        <View className="pt-6">
          <ScreenTitle>Rules</ScreenTitle>
        </View>
      }
    />
  );
}
