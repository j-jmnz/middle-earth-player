import { useRouter } from "expo-router";
import { View } from "react-native";

import { CardPool } from "../../card-pool";
import { ScreenTitle, SecondaryButton } from "../../chrome";

// Every deck-legal player card, searched and filtered. The packs, encounter cards included, are one tap away.
export default function Cards() {
  const router = useRouter();
  return (
    <CardPool
      adding={false}
      header={
        <View className="flex-row items-center justify-between pt-4">
          <ScreenTitle>Cards</ScreenTitle>
          <SecondaryButton label="Packs" icon="unique" testID="packs-open" compact accessibilityLabel="Browse cards by pack" onPress={() => router.push("/packs")} />
        </View>
      }
    />
  );
}
