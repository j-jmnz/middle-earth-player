import { useRouter } from "expo-router";
import { View } from "react-native";

import { CardPool } from "../../card-pool";
import { ScreenTitle, TextButton } from "../../chrome";

// Every deck-legal player card, searched and filtered. The packs, encounter cards included, are one tap away.
export default function Cards() {
  const router = useRouter();
  return (
    <CardPool
      adding={false}
      header={
        <View className="flex-row items-end justify-between pt-6">
          <ScreenTitle>Cards</ScreenTitle>
          <View className="-mr-3">
            <TextButton label="Packs" testID="packs-open" tone="gold" accessibilityLabel="Browse cards by pack" onPress={() => router.push("/packs")} />
          </View>
        </View>
      }
    />
  );
}
