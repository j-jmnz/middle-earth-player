import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";

import { setOwnership, unownedCodes, type CollectionSet } from "../../catalog/collection";
import { BodyText, NavBar, Screen, ScreenTitle, Section, TextButton } from "../kit/chrome";
import { OwnedRow } from "../collection/owned-row";
import { collectionPacks, collectionSets } from "../collection/sets";
import { collectionStore, useNotOwned } from "../collection/store";
import { collectionRows, collectionTally, setCardCounts, setDetail, type CollectionRow } from "../collection/view";
import { useDatabases } from "../data/databases";
import { goBack } from "../nav/go-back";
import { useListGutter } from "../nav/list-gutter";
import { poolOf } from "../pool/cache";
import { Text } from "../../ui/text";
import { useUiScale } from "../../ui/ui-scale";

// The player's collection (docs/design-system.md, Collection): a switch for each cycle, Campaign Expansion and Starter Deck they can
// own, under sticky cycle headings, and the way into the cards by pack. A switch saves at once. A row opens its packs (each with its
// own switch), or its one pack's cards.
export default function Collection() {
  const router = useRouter();
  const list = useListGutter("readable", 0);
  const scale = useUiScale();
  const pad = list.inset > 0 ? { paddingHorizontal: Math.max(list.inset, 24 * scale) } : undefined;
  const { catalog } = useDatabases();
  const { rows: pool } = poolOf(catalog);
  const sets = collectionSets();
  const notOwnedList = useNotOwned();
  const notOwned = useMemo(() => new Set(notOwnedList), [notOwnedList]);
  const counts = useMemo(() => setCardCounts(pool, sets), [pool, sets]);
  const ownedCards = pool.length - useMemo(() => unownedCodes(pool, collectionPacks(), notOwned), [pool, notOwned]).size;
  const { rows, sticky } = useMemo(() => collectionRows(sets), [sets]);
  const every = useMemo(() => sets.flatMap((set) => set.packs), [sets]);

  function open(set: CollectionSet): void {
    const only = set.packs.length === 1 ? set.packs[0] : undefined;
    if (only) router.push({ pathname: "/pack/[code]", params: { code: only } });
    else router.push({ pathname: "/collection/[id]", params: { id: set.id } });
  }

  function renderRow({ item }: { item: CollectionRow }) {
    if (item.kind === "heading") {
      return (
        <View accessibilityRole="header" className="bg-night px-6 pb-1 pt-4" style={pad}>
          <Section title={item.title} />
        </View>
      );
    }
    const set = item.set;
    const ownership = setOwnership(set, notOwned);
    return (
      <View className="px-6" style={pad}>
        <OwnedRow
          testID={`collection-${set.id}`}
          label={set.name}
          detail={setDetail(set, ownership, notOwned, counts.get(set.id) ?? 0)}
          ownership={ownership}
          openHint={set.packs.length === 1 ? "Shows its cards" : "Shows its packs"}
          onOpen={() => open(set)}
          onSwitch={(owned) => collectionStore.getState().switchPacks(set.packs, owned)}
        />
      </View>
    );
  }

  const head = (
    <View className="px-6 pb-2" style={pad}>
      <View className="pt-1">
        <ScreenTitle>Collection</ScreenTitle>
      </View>
      <BodyText tone="muted" className="mt-1">
        Turn on what you own. The card pool and the deck builder then show only these cards.
      </BodyText>
      <View className="mt-3 flex-row items-center justify-between">
        <Text testID="collection-tally" className="shrink text-label text-muted">
          {collectionTally(sets, notOwned, ownedCards)}
        </Text>
        <View className="flex-row">
          <TextButton testID="collection-all" label="All" tone="accent" small accessibilityLabel="Own everything" onPress={() => collectionStore.getState().ownAll()} />
          <TextButton testID="collection-none" label="None" tone="accent" small accessibilityLabel="Own nothing" onPress={() => collectionStore.getState().ownNone(every)} />
        </View>
      </View>
    </View>
  );

  return (
    <Screen scene="calm" inset={false}>
      <View className="px-6">
        <NavBar backLabel="Cards" backTestID="collection-back" onBack={() => goBack(router, "/cards")} />
      </View>
      <View className="min-h-0 flex-1" onLayout={list.onLayout}>
        <FlashList
          data={rows}
          keyExtractor={(item) => (item.kind === "heading" ? `heading-${item.title}` : item.set.id)}
          getItemType={(item) => item.kind}
          renderItem={renderRow}
          stickyHeaderIndices={sticky}
          ListHeaderComponent={head}
          ListFooterComponent={<View className="pb-safe" />}
          extraData={notOwned}
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
  );
}
