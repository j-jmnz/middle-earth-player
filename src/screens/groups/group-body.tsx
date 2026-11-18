// A card group on screen (docs/design-system.md, Card groups): the spoiler ask in place on first open, then the cards under their type's heading as
// a grid, ten points between cards each way (a sideways quest or setup card has a wider cell, in fewer columns). The card-group route and the Cards tab's detail pane on a tablet both draw it; one answer to the ask covers every group while the app is open (reveal.ts).
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";

import { useUiScale } from "../../ui/ui-scale";
import { useDatabases } from "../data/databases";
import { enqueueImageDownloads } from "../images/queue";
import { BodyText, Section } from "../kit/chrome";
import { SpoilerAsk } from "../kit/spoiler-ask";
import { GRID_GAP, gridCardWidth, poolColumns } from "../pool/grid";
import { useListPreview } from "../pool/list-preview";
import { groupDataOf } from "./cache";
import { cardGroupOf, type CardGroup, type GroupKind } from "./card-group";
import { GroupCell } from "./group-cell";
import type { GroupCard } from "./group-types";
import { revealSpoilers, SPOILER_TEXT, useSpoilersRevealed } from "./reveal";

type Item = { kind: "head"; id: string; title: string } | { kind: "cards"; id: string; cards: readonly GroupCard[]; columns: number };

/** The columns of a sideways card's section: about half as many as the upright cards', never fewer than two, so a quest card stays readable. */
export function wideColumns(columns: number): number {
  return Math.max(2, Math.ceil(columns / 2));
}

// The grid's items: a heading, then the group's cards in rows of `columns` (`wideColumns` for a section of sideways cards).
export function groupItems(group: CardGroup, columns: number): Item[] {
  return group.groups.flatMap((section) => {
    const across = section.cards.every((card) => card.landscape) ? wideColumns(columns) : columns;
    const rows: Item[] = [{ kind: "head", id: `head:${section.id}`, title: section.title }];
    for (let start = 0; start < section.cards.length; start += across) rows.push({ kind: "cards", id: `${section.id}:${start}`, cards: section.cards.slice(start, start + across), columns: across });
    return rows;
  });
}

function itemKey(item: Item): string {
  return item.id;
}

// A sideways row is its own recycle type: its cells are shorter than an upright row's.
function itemType(item: Item): string {
  return item.kind === "cards" && item.cards[0]?.landscape ? "cards-wide" : item.kind;
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

function Grid({ group, onPreview }: { group: CardGroup; onPreview: ReturnType<typeof useListPreview>["open"] }) {
  const router = useRouter();
  const scale = useUiScale();
  const [width, setWidth] = useState(0);
  const columns = poolColumns(width, false, scale);
  const gap = GRID_GAP * scale;
  const items = useMemo(() => groupItems(group, columns), [group, columns]);
  const open = useCallback((code: string) => router.push({ pathname: "/card/[code]", params: { code } }), [router]);
  const renderItem = useCallback(
    ({ item }: { item: Item }) => {
      if (item.kind === "head") return <Section title={item.title} className="mt-3" />;
      return (
        <View className="flex-row" style={{ gap }}>
          {item.cards.map((card) => (
            <GroupCell key={card.code} card={card} width={gridCardWidth(width, item.columns, scale)} onOpen={open} onPreview={onPreview} />
          ))}
        </View>
      );
    },
    [width, gap, scale, open, onPreview],
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
      {width > 0 ? (
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
  return useMemo(() => (kind && id ? cardGroupOf(groupDataOf(catalog), kind, id) : null), [catalog, kind, id]);
}

/** The group: the ask, then the grid; "That group is not in the catalog." for none. `onDecline` is Not now. */
export function CardGroupBody({ group, onDecline, onPreview }: { group: CardGroup | null; onDecline: () => void; onPreview: ReturnType<typeof useListPreview>["open"] }) {
  const shown = useSpoilersRevealed();
  if (!group) {
    return (
      <BodyText testID="group-missing" tone="muted" className="mt-6">
        That group is not in the catalog.
      </BodyText>
    );
  }
  return (
    <View className="min-h-0 flex-1">
      {group.spoiler && !shown ? (
        <SpoilerAsk
          testID="group-spoiler"
          className="mt-6"
          text={SPOILER_TEXT}
          showLabel="Show them"
          onShow={revealSpoilers}
          onCancel={onDecline}
        />
      ) : (
        <Grid group={group} onPreview={onPreview} />
      )}
    </View>
  );
}
