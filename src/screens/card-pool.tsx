import { FlashList } from "@shopify/flash-list";
import { eq } from "drizzle-orm";
import { useRouter } from "expo-router";
import { useCallback, useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { cards, packs } from "../catalog/schema";
import { ActionBar, BodyText, PrimaryButton, ProgressBar, Screen, SearchField, Segmented, SecondaryButton, ToggleChip } from "./chrome";
import { draftAddRefused, draftCopyCount, useDeckDraft, type TitleLookup } from "./deck-draft";
import { deckCardCount, deckCountLine, DECK_MINIMUM } from "./deck-status";
import { useDatabases } from "./databases";
import { enqueueImageDownloads } from "./images/queue";
import { useListPreview } from "./list-preview";
import { notAppliedCodes, notAppliedWords } from "../play/not-applied";
import { usePalette } from "./palette-hook";
import { addingView, browseView } from "./pool-view";
import { PoolCardCell, PoolCardRow, type PoolRowCard } from "./pool-cards";
import { gridCardWidth, gridOffset } from "./pool-grid";
import { activeFilterCount, cycleGroups, emptyPoolFilter, filterPool, sortPool, type PoolFilter } from "./pool-filter";
import { PoolFilterSheet, typeChoices } from "./pool-filter-sheet";
import { ToastView } from "./toast-view";


const viewabilityConfig = { itemVisiblePercentThreshold: 10 };
// FlashList keeps every cell it has ever mounted in its recycle pool unless told otherwise. A screen of three-across cards is about
// twenty cells, so this keeps a screen's worth for reuse and unmounts the rest as they scroll off.
const RECYCLE_POOL = 24;

function poolKey(item: PoolRowCard): string {
  return item.code;
}

function onViewableItemsChanged({ viewableItems }: { viewableItems: { item?: PoolRowCard | null }[] }): void {
  const jobs = [];
  for (const token of viewableItems) {
    const item = token.item;
    if (!item?.imagesrc) continue;
    jobs.push({ code: item.code, imagesrc: item.imagesrc });
  }
  if (jobs.length > 0) enqueueImageDownloads(jobs);
}

// Night chips for the type, one tap from the search field. The filter sheet leaves the type to them.
function TypeChips({
  types,
  value,
  onChange,
  applied,
  onApplied,
}: {
  types: { code: string; name: string }[];
  value: string | null;
  onChange: (next: string | null) => void;
  // "Applied only": the cards whose every printed line the app applies (the filter's Active text, as a chip). Off by default.
  applied: boolean;
  onApplied: (next: boolean) => void;
}) {
  const palette = usePalette();
  const options = [{ code: null, name: "All" }, ...types];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" className="-mx-6 mt-1 grow-0" contentContainerClassName="gap-1.5 px-6">
      {/* A switch, not a type: an outlined plate with a check when on, and a hairline after it before the type chips. */}
      <Pressable
        testID="pool-applied-only"
        accessibilityRole="switch"
        accessibilityState={{ checked: applied }}
        accessibilityLabel="Applied only: cards whose text the app applies"
        onPress={() => onApplied(!applied)}
        className="min-h-11 justify-center"
      >
        <View className="h-9 justify-center rounded-tile px-3" style={{ borderWidth: 1, borderColor: applied ? palette.gold : palette.hairline }}>
          <Text className={applied ? "text-label font-semibold text-gold" : "text-label text-muted"}>{applied ? "✓ Applied only" : "Applied only"}</Text>
        </View>
      </Pressable>
      <View className="my-3 w-px bg-hairline" />
      {options.map((option) => (
        <ToggleChip key={option.code ?? "all"} testID={`pool-type-${option.code ?? "all"}`} label={option.name} selected={value === option.code} onPress={() => onChange(option.code)} />
      ))}
    </ScrollView>
  );
}

// The deck-legal player pool, searched and filtered in memory, as a grid of the card pictures or a list of rows. The Cards tab
// browses it; the deck editor opens it with `adding` to put cards in the open draft: each card then has − and +, every change is
// said in a toast with Undo, and a bar shows the deck's count against 50 beside Done. `header` is the screen's top: the tab's
// title, or the editor's NavBar naming the deck. `startType` opens it on one type (an empty hero slot opens it on heroes).
export function CardPool({
  adding,
  header,
  startType = null,
  onDone,
}: {
  adding: boolean;
  header: ReactNode;
  startType?: string | null;
  onDone?: () => void;
}) {
  const draft = useDeckDraft();
  const { catalog } = useDatabases();
  const router = useRouter();
  const preview = useListPreview();
  // Both views are read on every render (a hook is never chosen at run time); the mode picks which one shows and which one changes.
  const browsing = browseView.useValue();
  const addingTo = addingView.useValue();
  const viewSetting = adding ? addingView : browseView;
  const view = adding ? addingTo : browsing;
  // The grid's cards share the list's measured width: three across to browse, two while adding so each card's stepper fits under it.
  const columns = adding ? 2 : 3;
  const [listWidth, setListWidth] = useState(0);
  const cellWidth = gridCardWidth(listWidth, columns);
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
  // The same "not applied" check as the card screen and the table: a printed line no effect record reads.
  const [inactiveCodes] = useState(() =>
    // The text the app shows is the errata when there is one, as on the card screen and in the deck store.
    notAppliedCodes(catalog.select({ code: cards.code, text: cards.text, errata: cards.errata }).from(cards).where(eq(cards.deckLegal, true)).all().map((row) => [row.code, row.errata ?? row.text] as const)),
  );
  const groups = useMemo(() => cycleGroups(packRows), [packRows]);
  const [search, setSearch] = useState("");
  // The field shows each keystroke at once; the list catches up when React has time, so typing never waits on the grid.
  const query = useDeferredValue(search);
  const [applied, setApplied] = useState<PoolFilter>(() => ({ ...emptyPoolFilter, typeCode: startType }));
  const [draftFilter, setDraftFilter] = useState<PoolFilter>(applied);
  const [open, setOpen] = useState(false);
  const visible = useMemo(
    () => filterPool(rows, query, applied, groups, inactiveCodes),
    [rows, query, applied, groups, inactiveCodes],
  );
  const types = useMemo(() => typeChoices(rows), [rows]);
  // Other printings of a title share its copy limit: the deck's codes are named from the loaded rows.
  const lookup = useMemo<TitleLookup>(() => {
    const byCode = new Map(rows.map((row) => [row.code, row]));
    return (code) => byCode.get(code);
  }, [rows]);
  const filters = activeFilterCount(applied);
  const openCard = useCallback((code: string) => router.push({ pathname: "/card/[code]", params: { code } }), [router]);
  const previewCard = preview.open;
  const grid = view === "Grid";
  // One function while nothing it reads changes, so FlashList and the memoized cards skip the cards a render did not touch.
  const renderItem = useCallback(
    ({ item, index }: { item: PoolRowCard | undefined; index: number }) => {
      if (!item) return null;
      const loss = inactiveCodes.has(item.code) ? notAppliedWords(item.code, item.typeCode) : null;
      const count = draftCopyCount(draft, item.code, item.typeCode);
      const full = draftAddRefused(draft, item, lookup);
      if (!grid) {
        return <PoolCardRow item={item} adding={adding} loss={loss} count={count} full={full} lookup={lookup} onOpen={openCard} onPreview={previewCard} />;
      }
      return (
        <PoolCardCell
          item={item}
          width={cellWidth}
          offset={gridOffset(index, columns)}
          adding={adding}
          loss={loss}
          count={count}
          full={full}
          lookup={lookup}
          onOpen={openCard}
          onPreview={previewCard}
        />
      );
    },
    [grid, cellWidth, columns, adding, inactiveCodes, draft, lookup, openCard, previewCard],
  );

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
          <SearchField testID="pool-search" value={search} onChangeText={setSearch} placeholder="Search cards" accessibilityLabel="Search cards" />
          <SecondaryButton
            testID="pool-filter"
            label={filters > 0 ? `Filter · ${filters}` : "Filter"}
            tone={filters > 0 ? "gold" : "bone"}
            compact
            accessibilityLabel={filters > 0 ? `Filter, ${filters} on` : "Filter"}
            onPress={openSheet}
          />
        </View>
        <TypeChips
          types={types}
          value={applied.typeCode}
          onChange={(typeCode) => setApplied({ ...applied, typeCode })}
          applied={applied.activeText}
          onApplied={(activeText) => setApplied({ ...applied, activeText })}
        />
        <View className="mt-1 flex-row items-center justify-between">
          <Text testID="pool-shown" className="text-label text-muted">{`${visible.length} ${visible.length === 1 ? "card" : "cards"}`}</Text>
          <Segmented options={["Grid", "List"] as const} value={view} onChange={viewSetting.set} testIDPrefix="pool-view" compact />
        </View>
        <View
          className="mt-2 min-h-0 flex-1"
          onLayout={(event) => {
            const next = Math.floor(event.nativeEvent.layout.width);
            setListWidth((current) => (current === next ? current : next));
          }}
        >
          {/* Mounted once the width is measured, never before: a grid cell drawn at no width is no height, and FlashList then lays
              out every card of the pool as on screen and mounts all of them (852 at once), which it never gives back. */}
          {cellWidth > 0 ? (
            <FlashList
              key={view}
              data={visible}
              keyExtractor={poolKey}
              numColumns={grid ? columns : 1}
              style={{ flex: 1 }}
              extraData={draft}
              keyboardShouldPersistTaps="handled"
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              ListFooterComponent={<View className={adding ? "h-4" : "pb-safe"} />}
              ListEmptyComponent={
                <BodyText testID="pool-empty" tone="muted" className="mt-6">
                  No cards match.
                </BodyText>
              }
              renderItem={renderItem}
              maxItemsInRecyclePool={RECYCLE_POOL}
            />
          ) : null}
        </View>
        <ToastView />
        {adding ? (
          <ActionBar testID="pool-deck-bar">
            <View className="flex-row items-center gap-3.5">
              <View className="flex-1">
                <View className="flex-row items-baseline justify-between">
                  <Text className="text-label text-muted">Deck</Text>
                  <Text testID="pool-deck-count" className="text-label text-bone" numberOfLines={1}>
                    {deckCountLine(draft)}
                  </Text>
                </View>
                <View className="mt-1.5">
                  <ProgressBar value={deckCardCount(draft.cards)} max={DECK_MINIMUM} />
                </View>
              </View>
              <PrimaryButton testID="pool-done" label="Done" onPress={() => onDone?.()} />
            </View>
          </ActionBar>
        ) : null}
      </View>
      <PoolFilterSheet open={open} rows={rows} groups={groups} filter={draftFilter} onChange={setDraftFilter} onDismiss={dismiss} onApply={apply} />
      {preview.overlay}
    </Screen>
  );
}
