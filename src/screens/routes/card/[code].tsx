import { eq } from "drizzle-orm";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { cards } from "../../../catalog/schema";
import { useDatabases } from "../../databases";
import { routeCode } from "../../route-code";

export default function CardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string }>();
  const code = routeCode(params.code);
  const { catalog } = useDatabases();
  const row = useMemo(() => {
    if (!code) return undefined;
    return catalog
      .select({ code: cards.code, name: cards.name, errata: cards.errata })
      .from(cards)
      .where(eq(cards.code, code))
      .get();
  }, [catalog, code]);

  if (!code) throw new Error("Missing route code");

  return (
    <View className="flex-1 bg-white px-6 pt-safe dark:bg-black">
      {row ? (
        <Text className="text-4xl font-semibold text-black dark:text-white">{row.code}</Text>
      ) : (
        <Text className="text-4xl font-semibold text-black dark:text-white">
          This card is not in the catalog.
        </Text>
      )}
      {row?.name ? (
        <Text className="mt-6 text-2xl leading-8 text-neutral-800 dark:text-neutral-200">
          {row.name}
        </Text>
      ) : null}
      {row?.errata ? (
        <Text className="mt-6 text-2xl leading-8 text-neutral-800 dark:text-neutral-200">
          {row.errata}
        </Text>
      ) : null}
      <View className="mt-auto pb-safe">
        <Pressable
          testID="back"
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
