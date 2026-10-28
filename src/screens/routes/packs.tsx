import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";

import { packs } from "../../catalog/schema";
import { BodyText, Column, ListRow, NavBar, Screen, ScreenTitle } from "../chrome";
import { useDatabases } from "../databases";
import { goBack } from "../go-back";
import { useListGutter } from "../list-gutter";

export default function PackList() {
  const router = useRouter();
  const list = useListGutter();
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
      <Column>
        <View className="pt-1">
          <ScreenTitle>Packs</ScreenTitle>
        </View>
      </Column>
      {rows.length === 0 ? (
        <Column>
          <BodyText tone="muted" className="mt-6">
            No packs are in the catalog.
          </BodyText>
        </Column>
      ) : (
        <View className="mt-4 flex-1" onLayout={list.onLayout}>
          <FlashList
            data={rows}
            keyExtractor={(item) => item.code}
            style={{ flex: 1 }}
            contentContainerStyle={list.contentContainerStyle}
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
