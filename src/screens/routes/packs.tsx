import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";

import { packs } from "../../catalog/schema";
import { BodyText, ListRow, NavBar, Screen, ScreenTitle } from "../chrome";
import { useDatabases } from "../databases";
import { goBack } from "../go-back";

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
    <Screen>
      <NavBar backLabel="Cards" backTestID="packs-back" onBack={() => goBack(router, "/cards")} />
      <View className="pt-2">
        <ScreenTitle>Packs</ScreenTitle>
      </View>
      {rows.length === 0 ? (
        <BodyText tone="muted" className="mt-6">
          No packs are in the catalog.
        </BodyText>
      ) : (
        <View className="mt-4 flex-1">
          <FlashList
            data={rows}
            keyExtractor={(item) => item.code}
            style={{ flex: 1 }}
            renderItem={({ item }) => (
              <ListRow
                testID={`pack-${item.code}`}
                label={item.name}
                onPress={() => {
                  router.push({ pathname: "/pack/[code]", params: { code: item.code } });
                }}
              />
            )}
          />
        </View>
      )}
    </Screen>
  );
}
