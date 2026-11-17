import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { setOwnership, unownedCodes } from "../../catalog/collection";
import { BodyText, NavBar, Screen, ScreenTitle, Section, TextButton } from "../kit/chrome";
import { OwnedRow } from "../collection/owned-row";
import { collectionPacks, collectionSets } from "../collection/sets";
import { collectionStore, useNotOwned } from "../collection/store";
import { collectionRows, collectionTally, entryLine, type CollectionRow } from "../collection/view";
import { useDatabases } from "../data/databases";
import { goBack } from "../nav/go-back";
import { useListGutter } from "../nav/list-gutter";
import { poolOf } from "../pool/cache";
import { sunkSurface } from "../../ui/surfaces";
import { Text } from "../../ui/text";
import { useUiScale } from "../../ui/ui-scale";
import { useTableTokens } from "../../ui/use-table-tokens";

function toggled(open: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(open);
  if (!next.delete(id)) next.add(id);
  return next;
}

// The player's collection (docs/design-system.md, Collection): one list of what they can own that holds deck-legal cards, a switch
// each, under headings that scroll with it. A row of several packs unfolds them in place, each with its own switch; nothing here
// opens another screen. A switch saves at once.
export default function Collection() {
  const router = useRouter();
  const list = useListGutter("readable", 0);
  const scale = useUiScale();
  const t = useTableTokens();
  const pad = list.inset > 0 ? { paddingHorizontal: Math.max(list.inset, 24 * scale) } : undefined;
  const { catalog } = useDatabases();
  const { rows: pool, packs } = poolOf(catalog);
  const notOwnedList = useNotOwned();
  const notOwned = useMemo(() => new Set(notOwnedList), [notOwnedList]);
  const ownedCards = pool.length - useMemo(() => unownedCodes(pool, collectionPacks(), notOwned), [pool, notOwned]).size;
  const rows = useMemo(() => collectionRows(collectionSets(), pool, new Map(packs.map((pack) => [pack.code, pack.name]))), [pool, packs]);
  const every = useMemo(() => rows.flatMap((row) => (row.kind === "set" ? row.entry.codes : [])), [rows]);
  // The rows whose packs are unfolded: the screen's own, so it starts folded each time the screen opens.
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const extra = useMemo(() => ({ notOwned, open }), [notOwned, open]);

  function renderRow({ item }: { item: CollectionRow }) {
    if (item.kind === "heading") {
      return (
        <View className="px-6 pb-1 pt-4" style={pad}>
          <Section title={item.title} />
        </View>
      );
    }
    const entry = item.entry;
    const ownership = setOwnership({ packs: entry.codes }, notOwned);
    return (
      <View className="px-6" style={pad}>
        <OwnedRow
          testID={`collection-${entry.id}`}
          label={entry.label}
          detail={entryLine(entry, ownership, notOwned)}
          ownership={ownership}
          packs={entry.packs}
          notOwned={notOwned}
          open={open.has(entry.id)}
          onToggle={() => setOpen((before) => toggled(before, entry.id))}
          onSwitch={(owned) => collectionStore.getState().switchPacks(entry.codes, owned)}
          onSwitchPack={(code, owned) => collectionStore.getState().switchPacks([code], owned)}
        />
      </View>
    );
  }

  const head = (
    <View className="px-6 pb-1" style={pad}>
      <View className="pt-1">
        <ScreenTitle>Collection</ScreenTitle>
      </View>
      <BodyText tone="muted" className="mt-1">
        Turn on what you own. The card pool and the deck builder then show only these cards.
      </BodyText>
      <View className="mt-3 flex-row items-center justify-between">
        <Text testID="collection-tally" className="shrink text-label text-muted">
          {collectionTally(ownedCards, pool.length)}
        </Text>
        <View className="flex-row">
          <TextButton testID="collection-all" label="All" tone="accent" small accessibilityLabel="Own everything" onPress={() => collectionStore.getState().ownAll()} />
          <TextButton testID="collection-none" label="None" tone="accent" small accessibilityLabel="Own nothing" onPress={() => collectionStore.getState().ownNone(every)} />
        </View>
      </View>
      {/* The share of the pool owned, drawn; the tally says it in words. */}
      <View importantForAccessibility="no-hide-descendants" className="mt-1 overflow-hidden rounded-full" style={{ height: 4 * scale, ...sunkSurface(t) }}>
        <View className="h-full rounded-full bg-accent" style={{ width: `${pool.length > 0 ? (100 * ownedCards) / pool.length : 0}%` }} />
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
          keyExtractor={(item) => (item.kind === "heading" ? `heading-${item.title}` : item.entry.id)}
          getItemType={(item) => item.kind}
          renderItem={renderRow}
          ListHeaderComponent={head}
          ListFooterComponent={<View className="pb-safe" />}
          extraData={extra}
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
  );
}
