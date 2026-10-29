import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { eq } from "drizzle-orm";
import { useRouter } from "expo-router";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { AccessibilityInfo, Pressable, ScrollView, View } from "react-native";

import { cards, packs } from "../catalog/schema";
import { ActionBar, BodyText, PrimaryButton, ProgressBar, Screen, SearchField, Segmented, ToggleChip, sphereWord } from "./chrome";
import { draftAddRefused, draftCopyCount, useDeckDraft, type TitleLookup } from "./deck-draft";
import { deckCardCount, deckCountLine, DECK_MINIMUM } from "./deck-status";
import { useDatabases } from "./databases";
import { enqueueImageDownloads } from "./images/queue";
import { useListPreview } from "./list-preview";
import { notAppliedCodes, notAppliedWords } from "../play/not-applied";
import { usePalette } from "./palette-hook";
import { addingView, browseView } from "./pool-view";
import { PoolCardCell, PoolCardRow, type PoolRowCard } from "./pool-cards";
import { LIST_ROW_HEIGHT, gridCardWidth, gridOffset, poolCellHeight, poolColumns, recyclePool } from "./pool-grid";
import { activeFilterCount, applyTypeRequest, cycleGroups, emptyPoolFilter, filterPool, sortPool, typeRequestWords, type PoolFilter } from "./pool-filter";
import { PoolFilterSheet, typeChoices } from "./pool-filter-sheet";
import { ToastView } from "./toast-view";
import { gutter } from "../play/size-class";
import { GameIcon } from "../play/game-icon";
import { SPHERE_TINT } from "../play/icon-map";
import { rowSurface, segmentSurface, slateSurface } from "../play/surfaces";
import { withAlphaHex } from "../play/tokens";
import { useTableTokens } from "../play/use-table-tokens";
import type { PictureSource } from "../play/table-canvas-types";
import { touch, useUiScale } from "../play/ui-scale";
import { useSizeClass } from "../play/use-size-class";
import { Text } from "../play/text";


const viewabilityConfig = { itemVisiblePercentThreshold: 10 };
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
  request,
}: {
  types: { code: string; name: string }[];
  value: string | null;
  onChange: (next: string | null) => void;
  // "Applied only": the cards whose every printed line the app applies (the filter's Active text, as a chip). Off by default.
  applied: boolean;
  onApplied: (next: boolean) => void;
  // A request from outside the pool: the row scrolls to the chip it chose.
  request: PoolTypeRequest | null;
}) {
  const palette = usePalette();
  const t = useTableTokens();
  const row = useRef<ComponentRef<typeof ScrollView>>(null);
  const chipX = useRef(new Map<string, number>());
  useEffect(() => {
    if (!request) return;
    const x = chipX.current.get(request.type ?? "all");
    if (x != null) row.current?.scrollTo({ x: Math.max(0, x - 24), animated: true });
  }, [request]);
  const options = [{ code: null, name: "All" }, ...types];
  return (
    <ScrollView ref={row} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" className="-mx-6 mt-1 grow-0" contentContainerClassName="gap-1.5 px-6">
      {/* A switch, not a type: an outlined plate with a check when on, and a hairline after it before the type chips. */}
      <Pressable
        testID="pool-applied-only"
        accessibilityRole="switch"
        accessibilityState={{ checked: applied }}
        accessibilityLabel="Applied only: cards whose text the app applies"
        onPress={() => onApplied(!applied)}
        className="min-h-touch justify-center"
      >
        <View className="h-9 justify-center rounded-tile px-3" style={applied ? { ...segmentSurface(t), boxShadow: `inset 0 -2px 0 ${palette.accentHigh}` } : rowSurface(false, t)}>
          <Text className={applied ? "text-label font-semibold text-accent" : "text-label text-muted"}>{applied ? "✓ Applied only" : "Applied only"}</Text>
        </View>
      </Pressable>
      <View className="my-3 w-px" style={{ backgroundColor: withAlphaHex(palette.bone, 0.12) }} />
      {options.map((option) => (
        <ToggleChip
          key={option.code ?? "all"}
          testID={`pool-type-${option.code ?? "all"}`}
          label={option.name}
          selected={value === option.code}
          onPress={() => onChange(option.code)}
          onLayout={(event) => chipX.current.set(option.code ?? "all", event.nativeEvent.layout.x)}
        />
      ))}
    </ScrollView>
  );
}

// The five sphere toggles under the search: a 44 pt plate each, the sphere's printed icon in its colour with a glow and a bar along
// the plate's foot when on, grey when off. A second tap turns a sphere off again.
const SPHERES = ["leadership", "tactics", "spirit", "lore", "neutral"] as const;

function SphereToggles({ value, onChange }: { value: string | null; onChange: (next: string | null) => void }) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  const box = touch(s, 44);
  return (
    <View className="mt-2 flex-row" style={{ gap: 6 * s }} accessibilityRole="radiogroup" accessibilityLabel="Sphere">
      {SPHERES.map((sphere) => {
        const on = value === sphere;
        const tint = SPHERE_TINT[sphere] ?? "faint";
        const color = palette[tint];
        return (
          <Pressable
            key={sphere}
            testID={`pool-sphere-${sphere}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, checked: on }}
            accessibilityLabel={sphereWord(sphere)}
            onPress={() => onChange(on ? null : sphere)}
          >
            {({ pressed }) => (
              <View
                className="items-center justify-center rounded-tile"
                style={{ width: box, height: box, ...(on ? { ...segmentSurface(t), boxShadow: `inset 0 -2px 0 ${color}, 0 0 14px ${withAlphaHex(color, 0.35)}` } : rowSurface(pressed, t)) }}
              >
                <View style={on ? { filter: `drop-shadow(0 0 5px ${withAlphaHex(color, 0.8)})` } : undefined}>
                  <GameIcon name={sphere} size={20 * s} tint={on ? tint : "faint"} />
                </View>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// A request for the pool to show one type (null: all of them), made from outside it: the deck editor's Add on a subsection or an
// empty hero slot, when the pool is already on screen beside it and there is no route to push. Each request is a new object, so
// asking for the same type again applies it again after the builder has changed the chips.
export type PoolTypeRequest = { type: string | null };

// The deck-legal player pool, searched and filtered in memory, as a grid of the card pictures or a list of rows. The Cards tab
// browses it; the deck editor opens it with `adding` to put cards in the open draft: each card then has − and +. The body is the
// search, the type chips, the grid or list and the filter sheet, with no Screen, bar, toast or preview of its own: `CardPool` below
// wraps it for its own route, and the deck editor in an expanded window sets it beside the deck, both on the one draft store, so a +
// shows on the other side at once. `startType` opens it on one type (an empty hero slot opens it on heroes); `onPreview` is the
// screen's long-press preview.
export function CardPoolBody({
  adding,
  startType = null,
  typeRequest = null,
  onPreview,
  onOpen,
  selected = null,
}: {
  adding: boolean;
  startType?: string | null;
  typeRequest?: PoolTypeRequest | null;
  onPreview: (code: string, name: string, source: PictureSource | null) => void;
  // A tap on a card; the card screen is pushed without it. The Cards hub on a tablet in landscape fills its detail pane instead.
  onOpen?: (code: string) => void;
  // The card whose detail is open beside the pool: its cell carries the silver ring.
  selected?: string | null;
}) {
  const draft = useDeckDraft();
  const { catalog } = useDatabases();
  const router = useRouter();
  // Both views are read on every render (a hook is never chosen at run time); the mode picks which one shows and which one changes.
  const browsing = browseView.useValue();
  const addingTo = addingView.useValue();
  const viewSetting = adding ? addingView : browseView;
  const view = adding ? addingTo : browsing;
  // The grid's cards share the list's measured width: three across to browse, two while adding so each card's stepper fits under it
  // (a phone's exact counts), and more where a tablet's list has the room (pool-grid.ts).
  const [listWidth, setListWidth] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const scale = useUiScale();
  const { size } = useSizeClass();
  const columns = poolColumns(listWidth, adding, scale);
  const cellWidth = gridCardWidth(listWidth, columns, scale);
  // FlashList keeps every cell it has ever mounted in its recycle pool unless told otherwise: a screen's worth (and two rows each
  // way) for reuse, and the rest unmounted as they scroll off. A phone's grid is about twenty cells, so it keeps the 24 it always had.
  const grid = view === "Grid";
  // The list view's rows are a reading column outside compact; the grid fills the width.
  const inset = grid ? 0 : gutter(listWidth, size, "readable", scale);
  const recycle = grid ? recyclePool(columns, listHeight, poolCellHeight(cellWidth, adding, scale)) : recyclePool(1, listHeight, LIST_ROW_HEIGHT * scale);
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
  // The editor's Add asks for a type: the chips follow it (state adjusted while rendering, once per request).
  // A request also clears the search and the Applied only switch, so nothing hides what it asked to see (applyTypeRequest).
  const [seenRequest, setSeenRequest] = useState(typeRequest);
  if (typeRequest !== seenRequest) {
    setSeenRequest(typeRequest);
    if (typeRequest) {
      const next = applyTypeRequest(applied, typeRequest.type);
      setApplied(next.filter);
      setSearch(next.search);
    }
  }
  const [draftFilter, setDraftFilter] = useState<PoolFilter>(applied);
  const [open, setOpen] = useState(false);
  const visible = useMemo(
    () => filterPool(rows, query, applied, groups, inactiveCodes),
    [rows, query, applied, groups, inactiveCodes],
  );
  const types = useMemo(() => typeChoices(rows), [rows]);
  const list = useRef<FlashListRef<PoolRowCard>>(null);
  useEffect(() => {
    if (!typeRequest) return;
    list.current?.scrollToOffset({ offset: 0, animated: false });
    AccessibilityInfo.announceForAccessibility(typeRequestWords(types, typeRequest.type));
  }, [typeRequest, types]);
  // Other printings of a title share its copy limit: the deck's codes are named from the loaded rows.
  const lookup = useMemo<TitleLookup>(() => {
    const byCode = new Map(rows.map((row) => [row.code, row]));
    return (code) => byCode.get(code);
  }, [rows]);
  const filters = activeFilterCount(applied);
  const openCard = useCallback((code: string) => (onOpen ? onOpen(code) : router.push({ pathname: "/card/[code]", params: { code } })), [router, onOpen]);
  const previewCard = onPreview;
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
          offset={gridOffset(index, columns, scale)}
          adding={adding}
          loss={loss}
          count={count}
          full={full}
          lookup={lookup}
          onOpen={openCard}
          onPreview={previewCard}
          selected={selected === item.code}
        />
      );
    },
    [grid, cellWidth, columns, scale, adding, inactiveCodes, draft, lookup, openCard, previewCard, selected],
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
    <View className="min-h-0 flex-1">
      <View className="mt-3 flex-row items-center gap-2">
        <SearchField testID="pool-search" value={search} onChangeText={setSearch} placeholder="Search cards" accessibilityLabel="Search cards" />
        <FilterButton count={filters} onPress={openSheet} />
      </View>
      <SphereToggles value={applied.sphere} onChange={(sphere) => setApplied({ ...applied, sphere })} />
      <TypeChips
        types={types}
        value={applied.typeCode}
        onChange={(typeCode) => setApplied({ ...applied, typeCode })}
        applied={applied.activeText}
        onApplied={(activeText) => setApplied({ ...applied, activeText })}
        request={typeRequest}
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
          const nextHeight = Math.floor(event.nativeEvent.layout.height);
          setListHeight((current) => (current === nextHeight ? current : nextHeight));
        }}
      >
        {/* Mounted once the width is measured, never before: a grid cell drawn at no width is no height, and FlashList then lays
            out every card of the pool as on screen and mounts all of them (852 at once), which it never gives back. */}
        {cellWidth > 0 ? (
          <FlashList
            ref={list}
            key={`${view}:${grid ? columns : 1}`}
            data={visible}
            keyExtractor={poolKey}
            numColumns={grid ? columns : 1}
            style={{ flex: 1 }}
            contentContainerStyle={inset > 0 ? { paddingHorizontal: inset } : undefined}
            extraData={{ draft, selected }}
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
            maxItemsInRecyclePool={recycle}
          />
        ) : null}
      </View>
      <PoolFilterSheet open={open} rows={rows} groups={groups} filter={draftFilter} onChange={setDraftFilter} onDismiss={dismiss} onApply={apply} />
    </View>
  );
}

/** Filter, with a round count of the filters on beside the word. */
function FilterButton({ count, onPress }: { count: number; onPress: () => void }) {
  const palette = usePalette();
  const t = useTableTokens();
  const s = useUiScale();
  return (
    <Pressable testID="pool-filter" collapsable={false} accessibilityRole="button" accessibilityLabel={count > 0 ? `Filter, ${count} on` : "Filter"} onPress={onPress}>
      {({ pressed }) => (
        <View className="flex-row items-center rounded-tile px-3.5" style={{ minHeight: touch(s, 44), gap: 8 * s, ...slateSurface(pressed, t) }}>
          <Text className="text-body" style={{ color: palette.muted }}>
            Filter
          </Text>
          {count > 0 ? (
            <View className="items-center justify-center rounded-pill" style={{ minWidth: 20 * s, height: 20 * s, paddingHorizontal: 5 * s, backgroundColor: palette.accent }}>
              <Text className="font-display" style={{ fontSize: 12 * s, lineHeight: 15 * s, color: palette.onAccent }}>
                {String(count)}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

// The pool on its own route: the Cards tab, or the pool the deck editor pushes on a phone. `header` is the screen's top: the tab's
// title, or the editor's NavBar naming the deck. Adding, a bar shows the deck's count against 50 beside Done, and every change is
// said in a toast with Undo.
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
  const preview = useListPreview();
  return (
    <Screen scene="calm">
      <View className="min-h-0 flex-1">
        {header}
        <CardPoolBody adding={adding} startType={startType} onPreview={preview.open} />
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
      {preview.overlay}
    </Screen>
  );
}
