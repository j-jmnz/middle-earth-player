import { FlashList } from "@shopify/flash-list";
import { eq } from "drizzle-orm";
import { useRouter } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { inactiveCodes as inactiveTextCodes } from "../catalog/active-text";
import { formatDeckRefusal } from "../catalog/deck-save";
import { cards, packs } from "../catalog/schema";
import { EFFECTS } from "../effects";
import { BodyText, ListRow, Screen, SphereMark, TextButton, markedSphere, pressedNight } from "./chrome";
import { addDraftCard, draftCopyCount, useDeckDraft } from "./deck-draft";
import { useDatabases } from "./databases";
import { enqueueImageDownloads } from "./images/queue";
import { CardThumb, useCardPreview } from "./images/picture";
import { useListPreview } from "./list-preview";
import type { PictureSource } from "../play/table-canvas-types";
import { palette } from "./palette.js";
import { cycleGroups, emptyPoolFilter, filterPool, poolDetail, sortPool, type PoolCard, type PoolFilter } from "./pool-filter";
import { PoolFilterSheet } from "./pool-filter-sheet";

type PoolRowCard = PoolCard & {
  typeName: string;
  sphereName: string | null;
  deckLimit: number | null;
  deckLegal: boolean;
  imagesrc: string | null;
};

const viewabilityConfig = { itemVisiblePercentThreshold: 10 };
const thumb = { width: 32, height: 44 };

function onViewableItemsChanged({ viewableItems }: { viewableItems: { item?: PoolRowCard | null }[] }): void {
  const jobs = [];
  for (const token of viewableItems) {
    const item = token.item;
    if (!item?.imagesrc) continue;
    jobs.push({ code: item.code, imagesrc: item.imagesrc });
  }
  if (jobs.length > 0) enqueueImageDownloads(jobs);
}

// The sphere's printed icon before the row's words ("Ally · Spirit · 2").
function RowIcons({ sphere }: { sphere: string | null }) {
  const mark = markedSphere(sphere);
  return mark ? <SphereMark sphere={mark} size={12} /> : null;
}

function PoolCardRow({
  item,
  adding,
  count,
  onPreview,
}: {
  item: PoolRowCard;
  adding: boolean;
  count: number;
  onPreview: (code: string, name: string, source: PictureSource | null) => void;
}) {
  const router = useRouter();
  const picture = useCardPreview(item.code, item.imagesrc);
  return (
    <ListRow
      testID={`card-${item.code}`}
      label={item.name}
      detail={poolDetail(item)}
      detailIcons={<RowIcons sphere={item.sphereCode} />}
      leading={<CardThumb code={item.code} imagesrc={item.imagesrc} width={thumb.width} height={thumb.height} />}
      onPress={() => {
        router.push({ pathname: "/card/[code]", params: { code: item.code } });
      }}
      onLongPress={() => onPreview(item.code, item.name, picture)}
      trailing={
        adding ? (
          <View className="flex-row items-center">
            <Text className="min-w-6 text-center text-body text-bone">{String(count)}</Text>
            <Pressable
              testID={`add-${item.code}`}
              collapsable={false}
              accessibilityRole="button"
              accessibilityLabel={`Add ${item.name}`}
              onPress={() => {
                addDraftCard({
                  code: item.code,
                  name: item.name,
                  typeCode: item.typeCode,
                  deckLimit: item.deckLimit,
                });
              }}
              className="min-h-11 min-w-11 items-center justify-center rounded-tile"
              style={({ pressed }) => (pressed ? pressedNight : undefined)}
            >
              <Text className="text-body text-bone">+</Text>
            </Pressable>
          </View>
        ) : undefined
      }
    />
  );
}

// The deck-legal player pool, searched and filtered in memory. The Cards tab browses it; the deck editor opens it with
// `adding` to put cards in the open draft. `header` is the screen's top: the tab's title, or the editor's NavBar.
export function CardPool({ adding, header }: { adding: boolean; header: ReactNode }) {
  const draft = useDeckDraft();
  const { catalog } = useDatabases();
  const preview = useListPreview();
  // Sorted in memory: a printing's tag ("(MotK) Aragorn") files under the name.
  const [rows] = useState(() =>
    sortPool(
      catalog
        .select({
          code: cards.code,
          name: cards.name,
          typeCode: cards.typeCode,
          typeName: cards.typeName,
          sphereCode: cards.sphereCode,
          sphereName: cards.sphereName,
          packCode: cards.packCode,
          packCodes: cards.packCodes,
          traits: cards.traits,
          cost: cards.cost,
          threat: cards.threat,
          isUnique: cards.isUnique,
          deckLimit: cards.deckLimit,
          deckLegal: cards.deckLegal,
          imagesrc: cards.imagesrc,
        })
        .from(cards)
        .where(eq(cards.deckLegal, true))
        .all(),
    ),
  );
  const [packRows] = useState(() =>
    catalog
      .select({
        code: packs.code,
        name: packs.name,
        position: packs.position,
        cyclePosition: packs.cyclePosition,
      })
      .from(packs)
      .orderBy(packs.cyclePosition, packs.position)
      .all(),
  );
  // The same inactive-text check as the card screen and the table: unique text with no effect record.
  const [inactiveCodes] = useState(() =>
    inactiveTextCodes(
      catalog.select({ code: cards.code, text: cards.text }).from(cards).where(eq(cards.deckLegal, true)).all().map((row) => [row.code, row.text] as const),
      EFFECTS,
    ),
  );
  const groups = useMemo(() => cycleGroups(packRows), [packRows]);
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState<PoolFilter>(emptyPoolFilter);
  const [draftFilter, setDraftFilter] = useState<PoolFilter>(emptyPoolFilter);
  const [open, setOpen] = useState(false);
  const visible = useMemo(
    () => filterPool(rows, search, applied, groups, inactiveCodes),
    [rows, search, applied, groups, inactiveCodes],
  );
  const held = adding ? draft.heldRefusal : null;

  function openSheet(): void {
    setDraftFilter(applied);
    setOpen(true);
  }

  function dismiss(): void {
    setOpen(false);
  }

  function apply(): void {
    setApplied(draftFilter);
    setOpen(false);
  }

  return (
    <Screen scene="plain">
      <View className="min-h-0 flex-1">
        {header}
        <View className="mt-3 flex-row items-center gap-2">
          <TextInput
            testID="pool-search"
            value={search}
            onChangeText={setSearch}
            placeholder="Search"
            placeholderTextColor={palette.faint}
            autoCorrect={false}
            autoCapitalize="none"
            className="min-h-11 min-w-0 flex-1 rounded-pill bg-raised px-4 text-body text-bone"
          />
          <TextButton testID="pool-filter" label="Filter" onPress={openSheet} />
        </View>
        {held ? (
          <BodyText tone="danger" className="mt-3">
            {formatDeckRefusal(held)}
          </BodyText>
        ) : null}
        <View className="mt-2 min-h-0 flex-1">
          <FlashList
            data={visible}
            keyExtractor={(item) => item.code}
            style={{ flex: 1 }}
            extraData={draft}
            keyboardShouldPersistTaps="handled"
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            ListFooterComponent={<View className="pb-safe" />}
            ListEmptyComponent={
              <BodyText testID="pool-empty" tone="muted" className="mt-6">
                No cards match.
              </BodyText>
            }
            renderItem={({ item }) =>
              item ? (
                <PoolCardRow
                  item={item}
                  adding={adding}
                  count={draftCopyCount(draft, item.code, item.typeCode)}
                  onPreview={preview.open}
                />
              ) : null
            }
          />
        </View>
      </View>
      <PoolFilterSheet open={open} rows={rows} groups={groups} filter={draftFilter} onChange={setDraftFilter} onDismiss={dismiss} onApply={apply} />
      {preview.overlay}
    </Screen>
  );
}
