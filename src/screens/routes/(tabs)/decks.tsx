import { Text, View } from "react-native";

export default function Decks() {
  return (
    <View testID="decks" collapsable={false} className="flex-1 bg-white px-6 pt-safe dark:bg-black">
      <Text className="text-4xl font-semibold text-black dark:text-white">Decks</Text>
      <Text className="mt-6 text-2xl leading-8 text-neutral-800 dark:text-neutral-200">
        The deck editor is not in this build.
      </Text>
    </View>
  );
}
