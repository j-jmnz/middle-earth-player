import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { packs } from "../../../catalog/schema";
import { useDatabases } from "../../databases";

export default function PackList() {
  const router = useRouter();
  const { catalog } = useDatabases();
  const rows = useMemo(
    () =>
      catalog
        .select({ code: packs.code, name: packs.name })
        .from(packs)
        .orderBy(packs.cyclePosition, packs.position)
        .all(),
    [catalog],
  );

  return (
    <View className="flex-1 bg-white px-6 pt-safe dark:bg-black">
      <Text className="text-4xl font-semibold text-black dark:text-white">Packs</Text>
      <FlashList
        data={rows}
        keyExtractor={(item) => item.code}
        style={{ flex: 1 }}
        renderItem={({ item }) => (
          <Pressable
            testID={`pack-${item.code}`}
            collapsable={false}
            accessibilityRole="button"
            onPress={() => {
              router.push({ pathname: "/pack/[code]", params: { code: item.code } });
            }}
            style={{ minHeight: 44 }}
            className="justify-center"
          >
            <Text className="text-2xl leading-8 text-neutral-800 dark:text-neutral-200">
              {item.name}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
