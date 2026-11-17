import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { ScrollView, View } from "react-native";

import { setOwnership } from "../../../catalog/collection";
import { BodyText, Column, NavBar, Screen, ScreenTitle, SettingSwitch } from "../../kit/chrome";
import { OwnedRow } from "../../collection/owned-row";
import { collectionSet } from "../../collection/sets";
import { collectionStore, useNotOwned } from "../../collection/store";
import { setCardCounts, setDetail } from "../../collection/view";
import { useDatabases } from "../../data/databases";
import { goBack } from "../../nav/go-back";
import { routeCode } from "../../nav/route-code";
import { poolOf } from "../../pool/cache";

// One switch of the collection opened (docs/design-system.md, Collection): the whole of it as one switch, then each pack with its
// own, for a player who owns only some of a cycle. A pack's row opens its cards.
export default function CollectionSetScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = routeCode(params.id);
  const set = id ? collectionSet(id) : undefined;
  const { catalog } = useDatabases();
  const { rows: pool, packs } = poolOf(catalog);
  const notOwnedList = useNotOwned();
  const notOwned = useMemo(() => new Set(notOwnedList), [notOwnedList]);
  // Each pack as a set of one, so its row reads and switches as the list's rows do.
  const packSets = useMemo(() => {
    if (!set) return [];
    return set.packs.map((code) => {
      const name = packs.find((pack) => pack.code === code)?.name ?? code;
      return { id: code, heading: set.heading, name, title: name, detail: null, packs: [code] };
    });
  }, [set, packs]);
  const counts = useMemo(() => setCardCounts(pool, packSets), [pool, packSets]);

  if (!id) throw new Error("Missing route id");

  return (
    <Screen scene="calm">
      <NavBar backTestID="collection-set-back" backLabel="Collection" onBack={() => goBack(router, "/collection")} />
      {!set ? (
        <Column>
          <BodyText className="mt-6">{`${id} is not part of the collection.`}</BodyText>
        </Column>
      ) : (
        <ScrollView contentContainerClassName="pb-safe">
          <Column>
            <View className="pt-2">
              <ScreenTitle size="title">{set.title}</ScreenTitle>
            </View>
            {set.detail ? (
              <BodyText tone="muted" className="mt-1">
                {set.detail}
              </BodyText>
            ) : null}
            <View className="mt-3">
              <SettingSwitch
                testID="collection-set-owned"
                roomy
                label="All of it"
                detail={`${set.name}. Turn packs on one by one below.`}
                value={setOwnership(set, notOwned) === "all"}
                onChange={(owned) => collectionStore.getState().switchPacks(set.packs, owned)}
              />
            </View>
            <View className="mt-3">
              {packSets.map((pack) => {
                const ownership = setOwnership(pack, notOwned);
                return (
                  <OwnedRow
                    key={pack.id}
                    testID={`pack-${pack.id}`}
                    label={pack.name}
                    detail={setDetail(pack, ownership, notOwned, counts.get(pack.id) ?? 0)}
                    ownership={ownership}
                    openHint="Shows its cards"
                    onOpen={() => router.push({ pathname: "/pack/[code]", params: { code: pack.id } })}
                    onSwitch={(owned) => collectionStore.getState().switchPacks(pack.packs, owned)}
                  />
                );
              })}
            </View>
          </Column>
        </ScrollView>
      )}
    </Screen>
  );
}
