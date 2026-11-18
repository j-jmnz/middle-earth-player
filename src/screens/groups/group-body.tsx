// A card group on screen (docs/design-system.md, Card groups): the spoiler ask in place on first open, then the cards under their type's heading as
// a grid. The card-group route and the Cards tab's detail pane on a tablet both draw it; the ask is remembered while the app is open (reveal.ts).
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";

import { Text } from "../../ui/text";
import { useUiScale } from "../../ui/ui-scale";
import { useDatabases } from "../data/databases";
import { enqueueImageDownloads } from "../images/queue";
import { BodyText, Section, TextButton } from "../kit/chrome";
import { gridCardWidth, gridOffset, poolColumns } from "../pool/grid";
import { useListPreview } from "../pool/list-preview";
import { groupDataOf } from "./cache";
import { cardGroupOf, type CardGroup, type GroupKind } from "./card-group";
import { GroupCell } from "./group-cell";
import type { GroupCard } from "./group-types";
import { groupKey, reveal, useRevealed } from "./reveal";

type Item = { kind: "head"; id: string; title: string } | { kind: "cards"; id: string; cards: readonly GroupCard[]; first: boolean };

// The grid's items: a heading, then the group's cards in rows of `columns`.
export function groupItems(group: CardGroup, columns: number): Item[] {
  return group.groups.flatMap((section) => {
    const rows: Item[] = [{ kind: "head", id: `head:${section.id}`, title: section.title }];
    for (let start = 0; start < section.cards.length; start += columns) rows.push({ kind: "cards", id: `${section.id}:${start}`, cards: section.cards.slice(start, start + columns), first: start === 0 });
    return rows;
  });
}

function itemKey(item: Item): string {
  return item.id;
}

function itemType(item: Item): string {
  return item.kind;
}

function onViewableItemsChanged({ viewableItems }: { viewableItems: { item?: Item | null }[] }): void {
  const jobs = [];
  for (const token of viewableItems) {
    if (token.item?.kind !== "cards") continue;
    for (const card of token.item.cards) if (card.imagesrc) jobs.push({ code: card.code, imagesrc: card.imagesrc });
  }
  if (jobs.length > 0) enqueueImageDownloads(jobs);
}

const viewabilityConfig = { itemVisiblePercentThreshold: 10 };

// The ask the cards hide behind: they show what the scenario or the campaign holds.
function SpoilerAsk({ kind, onShow, onDecline }: { kind: GroupKind; onShow: () => void; onDecline: () => void }) {
  return (
    <View testID="group-spoiler" className="mt-6 gap-3">
      <Text className="text-body text-bone">{kind === "campaign" ? "These cards show what the campaign holds. Show them anyway?" : "These cards show what the scenario holds. Show them anyway?"}</Text>
      <View className="flex-row gap-4">
        <TextButton label="Show them" testID="group-spoiler-show" tone="accent" onPress={onShow} />
        <TextButton label="Not now" testID="group-spoiler-cancel" onPress={onDecline} />
      </View>
    </View>
  );
}

function Grid({ group, onPreview }: { group: CardGroup; onPreview: ReturnType<typeof useListPreview>["open"] }) {
  const router = useRouter();
  const scale = useUiScale();
  const [width, setWidth] = useState(0);
  const columns = poolColumns(width, false, scale);
  const cellWidth = gridCardWidth(width, columns, scale);
  const items = useMemo(() => groupItems(group, columns), [group, columns]);
  const open = useCallback((code: string) => router.push({ pathname: "/card/[code]", params: { code } }), [router]);
  const renderItem = useCallback(
    ({ item }: { item: Item }) => {
      if (item.kind === "head") return <Section title={item.title} className="mt-3" />;
      return (
        <View className="flex-row">
          {item.cards.map((card, index) => (
            <GroupCell key={card.code} card={card} width={cellWidth} offset={gridOffset(index, columns, scale)} onOpen={open} onPreview={onPreview} />
          ))}
        </View>
      );
    },
    [cellWidth, columns, scale, open, onPreview],
  );
  return (
    <View
      className="mt-2 min-h-0 flex-1"
      onLayout={(event) => {
        const next = Math.floor(event.nativeEvent.layout.width);
        setWidth((current) => (current === next ? current : next));
      }}
    >
      {/* Mounted once the width is measured: a cell drawn at no width is no height (the pool's grid does the same). */}
      {cellWidth > 0 ? (
        <FlashList
          testID="group-grid"
          data={items}
          keyExtractor={itemKey}
          getItemType={itemType}
          renderItem={renderItem}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          ListFooterComponent={<View className="pb-safe" style={{ height: 24 * scale }} />}
        />
      ) : null}
    </View>
  );
}

/** The group a route's kind and id name, or null: the catalog's trees are built once per database (groups/cache.ts). */
export function useCardGroup(kind: GroupKind | null, id: string | null): CardGroup | null {
  const { catalog } = useDatabases();
  return useMemo(() => (kind && id ? cardGroupOf(groupDataOf(catalog).trees(), kind, id) : null), [catalog, kind, id]);
}

/** The group: the ask, then the grid; "That group is not in the catalog." for none. `onDecline` is Not now. */
export function CardGroupBody({ group, onDecline, onPreview }: { group: CardGroup | null; onDecline: () => void; onPreview: ReturnType<typeof useListPreview>["open"] }) {
  const key = group ? groupKey(group.kind, group.id) : "";
  const shown = useRevealed(key);
  if (!group) {
    return (
      <BodyText testID="group-missing" tone="muted" className="mt-6">
        That group is not in the catalog.
      </BodyText>
    );
  }
  return (
    <View className="min-h-0 flex-1">
      {group.spoiler && !shown ? <SpoilerAsk kind={group.kind} onShow={() => reveal(key)} onDecline={onDecline} /> : <Grid group={group} onPreview={onPreview} />}
    </View>
  );
}
