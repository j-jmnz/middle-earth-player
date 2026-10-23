import { FlashList } from "@shopify/flash-list";
import { eq } from "drizzle-orm";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { cards, packs } from "../../../catalog/schema";
import { useDatabases } from "../../databases";
import { routeCode } from "../../route-code";

export default function PackCards() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string }>();
  const code = routeCode(params.code);
  const { catalog } = useDatabases();
  const pack = useMemo(() => {
    if (!code) return undefined;
    return catalog
      .select({ code: packs.code, name: packs.name })
      .from(packs)
      .where(eq(packs.code, code))
      .get();
  }, [catalog, code]);
  const rows = useMemo(() => {
    if (!code) return [];
    return catalog
      .select({ code: cards.code, name: cards.name })
      .from(cards)
      .where(eq(cards.packCode, code))
      .orderBy(cards.position)
      .all();
  }, [catalog, code]);

  if (!code) throw new Error("Missing route code");

  return (
    <View className="flex-1 bg-white px-6 pt-safe dark:bg-black">
      <Text className="text-4xl font-semibold text-black dark:text-white">
        {pack?.name ?? code}
      </Text>
      <FlashList
        data={rows}
        keyExtractor={(item) => item.code}
        style={{ flex: 1 }}
        renderItem={({ item }) => (
          <Pressable
            testID={`card-${item.code}`}
            collapsable={false}
            accessibilityRole="button"
            onPress={() => {
              router.push({ pathname: "/card/[code]", params: { code: item.code } });
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
      <View className="pb-safe">
        <Pressable
          testID="pack-back"
          collapsable={false}
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{ minHeight: 44 }}
          className="justify-center"
        >
          <Text className="text-2xl leading-8 text-black dark:text-white">Back</Text>
        </Pressable>
      </View>
    </View>
  );
}
