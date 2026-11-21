import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { ActionBar, BodyText, PrimaryButton, ProgressBar, Screen, SearchField, Segmented, SecondaryButton, ToggleChip, sphereWord } from "../kit/chrome";
import { draftAddRefused, draftCopyCount, setDraftTarget, targetPicks, useDeckDraft, type DraftPile, type TitleLookup } from "../deck/draft";
import { deckCardCount, deckCountLine, deckLootRule, DECK_MINIMUM } from "../deck/status";
import { lootCodes } from "../../catalog/loot";
import { useDatabases } from "../data/databases";
import { enqueueImageDownloads } from "../images/queue";
import { useListPreview } from "./list-preview";
import { notAppliedWords } from "../../play/cards/not-applied";
import { usePalette } from "../kit/palette-hook";
import { poolOf } from "./cache";
import { cardsWord } from "../groups/card-group";
import { addingView, browseView } from "./view";
import { PoolCardCell, PoolCardRow, type PoolRowCard } from "./cards";
import { LIST_ROW_HEIGHT, gridCardWidth, gridOffset, poolCellHeight, poolColumns, recyclePool } from "./grid";
import { activeFilterCount, applyTypeRequest, emptyPoolFilter, filterPool, MOTK_TYPE, motkFilter, packGroups, poolCountLine, typeRequestWords, type PoolFilter } from "./filter";
import { unownedCodes } from "../../catalog/collection";
import { collectionPacks, collectionSets } from "../collection/sets";
import { useNotOwned } from "../collection/store";
import { PoolFilterSheet, typeChoices } from "./filter-sheet";
import { FilterFold, useFilterFold } from "./filter-fold";
import { ToastView } from "../kit/toast-view";
import { gutter } from "../../ui/size-class";
import { GameIcon } from "../../ui/game-icon";
import { SPHERE_TINT } from "../../ui/icon-map";
import { chipSurface } from "../../ui/surfaces";
import { withAlphaHex } from "../../ui/tokens";
import { useTableTokens } from "../../ui/use-table-tokens";
import type { PictureSource } from "../../play/canvas/table-canvas-types";
import { touch, useUiScale } from "../../ui/ui-scale";
import { withSound } from "../../ui/sound/sound";
import { useSizeClass } from "../../ui/use-size-class";
import { Text } from "../../ui/text";
import { announce } from "../../ui/announce";
import { useScreenReader } from "../../ui/screen-reader";


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

// Night chips for the type, one tap from the search field: only types, one picked at a time. The filter sheet leaves the type to them and
// holds the switches (Applied only, My collection).
function TypeChips({
  types,
  value,
  onChange,
  request,
}: {
  types: { code: string; name: string }[];
  value: string | null;
  onChange: (next: string | null) => void;
  // A request from outside the pool: the row scrolls to the chip it chose.
  request: PoolTypeRequest | null;
}) {
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

// The five sphere toggles under the search: a 44 pt capsule each, the sphere's printed icon in its colour with a glow on a wash of that
// colour when on, grey on the tonal fill when off. A second tap turns a sphere off again.
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
            aria-checked={on}
            accessibilityLabel={sphereWord(sphere)}
            // Picking a sphere plays the choice's sound; tapping the picked one again clears the filter.
            onPress={withSound(() => onChange(on ? null : sphere), on ? "ui.toggle-off" : "ui.select")}
          >
            {({ pressed }) => (
              <View
                className="items-center justify-center rounded-control"
                style={{ width: box, height: box, ...(on ? { backgroundColor: withAlphaHex(color, 0.22) } : chipSurface(false, pressed, t)) }}
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

const MOTK_CHOICE = { code: MOTK_TYPE, name: "MotK heroes" };
const NONE: ReadonlySet<string> = new Set();

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
  // Only the heroes, the cards and the side deck: typing the deck's name in the editor does not render the pool. While adding, − and +
  // change the pile the editor chose (the deck, or the side deck), and the switch above the search moves between them.
  const heroes = useDeckDraft((current) => current.heroes);
  const deckCards = useDeckDraft((current) => current.cards);
  const sideCards = useDeckDraft((current) => current.side);
  const target = useDeckDraft((current) => current.target);
  const draft = useMemo(() => targetPicks({ heroes, cards: deckCards, side: sideCards }, target), [heroes, deckCards, sideCards, target]);
  const { catalog } = useDatabases();
  const router = useRouter();
  // Both views are read on every render (a hook is never chosen at run time); the mode picks which one shows and which one changes.
  const browsing = browseView.useValue();
  const addingTo = addingView.useValue();
  const viewSetting = adding ? addingView : browseView;
  const view = adding ? addingTo : browsing;
  // The grid's cards share the list's measured width: three across to browse, two while adding so each card's stepper fits under it
  // (a phone's exact counts), and more where a tablet's list has the room (pool/grid.ts).
  const [listWidth, setListWidth] = useState(0);
  const scale = useUiScale();
  const { size, height: windowHeight } = useSizeClass();
  const columns = poolColumns(listWidth, adding, scale);
  const cellWidth = gridCardWidth(listWidth, columns, scale);
  // FlashList keeps every cell it has ever mounted in its recycle pool unless told otherwise: a screen's worth (and two rows each
  // way) for reuse, and the rest unmounted as they scroll off. A phone's grid is about twenty cells, so it keeps the 24 it always had.
  // The window's height stands for the list's: the list is never taller, and it does not change while the filters fold, so a fold
  // does not render the pool on each of its frames.
  const grid = view === "Grid";
  // The list view's rows are a reading column outside compact; the grid fills the width.
  const inset = grid ? 0 : gutter(listWidth, size, "readable", scale);
  const recycle = grid ? recyclePool(columns, windowHeight, poolCellHeight(cellWidth, adding, scale)) : recyclePool(1, windowHeight, LIST_ROW_HEIGHT * scale);
  // The sorted pool, its packs and the cards with a line the app does not apply: read once per catalog (pool/cache.ts), shared with the
  // Cards tab, the pool route, the deck editor's cards pane and the import screen.
  const { rows, packs: packRows, notApplied: inactiveCodes, byCode, motk: motkRows, motkNotes } = poolOf(catalog);
  const groups = useMemo(() => packGroups(collectionSets(), packRows), [packRows]);
  // The cards outside the player's collection (src/catalog/collection.ts): the My collection chip hides them, and with it off they
  // say "Not owned". Empty, and the chip gone, while everything is owned.
  const notOwnedList = useNotOwned();
  const notOwned = useMemo(() => new Set(notOwnedList), [notOwnedList]);
  const unowned = useMemo(() => unownedCodes(rows, collectionPacks(), notOwned), [rows, notOwned]);
  // Keyed on the cards, not the saved packs: a pack switched off that holds no deck-legal card leaves everything owned.
  const collectionSet = unowned.size > 0;
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
  // The Messenger of the King's heroes (browse only) are a chip of their own while browsing: picked, the pool lists them in place of the
  // deck-legal cards, searched and narrowed by sphere and the sheet as those are, and each says on its strip which ally it stands for.
  const motkOn = !adding && applied.typeCode === MOTK_TYPE;
  const visible = useMemo(
    () => (motkOn ? filterPool(motkRows, query, motkFilter(applied), groups, NONE, NONE) : filterPool(rows, query, applied, groups, inactiveCodes, unowned)),
    [motkOn, motkRows, rows, query, applied, groups, inactiveCodes, unowned],
  );
  // Browsing, in portrait and landscape alike, the sphere toggles, the type chips and the count fold away as the pool scrolls down
  // and come back as it scrolls up or the list changes; the search row stays. Not with a screen reader on: it would hide them with no
  // way back it can find.
  const screenReader = useScreenReader();
  const fold = useFilterFold(!adding && !screenReader, visible);
  const allyNotes = motkOn ? motkNotes : null;
  const unownedShown = useMemo(() => (applied.owned || !collectionSet ? 0 : visible.filter((card) => unowned.has(card.code)).length), [applied.owned, collectionSet, visible, unowned]);
  const types = useMemo(() => (!adding && motkRows.length > 0 ? [...typeChoices(rows), MOTK_CHOICE] : typeChoices(rows)), [adding, motkRows, rows]);
  const list = useRef<FlashListRef<PoolRowCard>>(null);
  useEffect(() => {
    if (!typeRequest) return;
    list.current?.scrollToOffset({ offset: 0, animated: false });
    announce(typeRequestWords(types, typeRequest.type));
  }, [typeRequest, types]);
  // Other printings of a title share its copy limit: the deck's codes are named from the loaded rows.
  const lookup = useMemo<TitleLookup>(() => (code) => byCode.get(code), [byCode]);
  // With the heroes picked, the badge counts only what narrows them.
  const filters = activeFilterCount(motkOn ? motkFilter(applied) : applied);
  const openCard = useCallback((code: string) => (onOpen ? onOpen(code) : router.push({ pathname: "/card/[code]", params: { code } })), [router, onOpen]);
  const previewCard = onPreview;
  // One function while nothing it reads changes, so FlashList and the memoized cards skip the cards a render did not touch.
  const renderItem = useCallback(
    ({ item, index }: { item: PoolRowCard | undefined; index: number }) => {
      if (!item) return null;
      const loss = allyNotes ? (allyNotes.get(item.code) ?? null) : inactiveCodes.has(item.code) ? notAppliedWords(item.code, item.typeCode) : null;
      const out = unowned.has(item.code);
      const count = draftCopyCount(draft, item.code, item.typeCode);
      const full = draftAddRefused(draft, item, lookup, target);
      const side = target === "side";
      // A hero or a contract has no stepper while adding to the side deck: it never goes there.
      const offSide = side && (item.typeCode === "hero" || item.typeCode === "contract");
      const stepper = adding && !offSide;
      if (!grid) {
        return <PoolCardRow item={item} adding={stepper} side={side} loss={loss} unowned={out} count={count} full={full} lookup={lookup} onOpen={openCard} onPreview={previewCard} />;
      }
      return (
        <PoolCardCell
          item={item}
          width={cellWidth}
          offset={gridOffset(index, columns, scale)}
          adding={stepper}
          side={side}
          loss={loss}
          unowned={out}
          count={count}
          full={full}
          lookup={lookup}
          onOpen={openCard}
          onPreview={previewCard}
          selected={selected === item.code}
        />
      );
    },
    [grid, cellWidth, columns, scale, adding, allyNotes, inactiveCodes, unowned, draft, target, lookup, openCard, previewCard, selected],
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

  // The sphere toggles, the type chips and the count with Grid / List: in the page's flow, or over the top of the list while they fold.
  const filterRows = (
    <>
      <SphereToggles value={applied.sphere} onChange={(sphere) => setApplied({ ...applied, sphere })} />
      <TypeChips
        types={types}
        value={applied.typeCode}
        onChange={(typeCode) => setApplied({ ...applied, typeCode })}
        request={typeRequest}
      />
      <View className="mt-1 flex-row items-center justify-between">
        <Text testID="pool-shown" className="text-label text-muted">{motkOn ? `${cardsWord(visible.length)} · Browse only` : poolCountLine(visible.length, applied.owned, collectionSet, unownedShown)}</Text>
        <Segmented options={["Grid", "List"] as const} value={view} onChange={viewSetting.set} testIDPrefix="pool-view" compact accessibilityLabel="Card view" />
      </View>
    </>
  );

  return (
    <View className="min-h-0 flex-1">
      {adding ? (
        <View className="mt-3">
          <Segmented options={PILE_WORDS} value={pileWord(target)} onChange={(word) => setDraftTarget(word === "Side deck" ? "side" : "deck")} testIDPrefix="pool-pile" stretch accessibilityLabel="Add cards to" />
        </View>
      ) : null}
      <View className="mt-3 flex-row items-center gap-2">
        <SearchField testID="pool-search" value={search} onChangeText={setSearch} placeholder="Search name, trait or text" accessibilityLabel="Search cards" accessibilityHint="Searches card name, traits, type, sphere and text" />
        <FilterButton count={filters} onPress={openSheet} />
      </View>
      {fold.enabled ? null : filterRows}
      <View
        className={`${fold.enabled ? "" : "mt-2 "}min-h-0 flex-1`}
        onLayout={(event) => {
          const next = Math.floor(event.nativeEvent.layout.width);
          setListWidth((current) => (current === next ? current : next));
        }}
      >
        {/* Before the list, so a keyboard reaches the filters first; drawn over it by its zIndex. */}
        {fold.enabled ? (
          <FilterFold fold={fold} column={size === "expanded"}>
            {filterRows}
          </FilterFold>
        ) : null}
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
            contentContainerStyle={{ paddingHorizontal: inset, paddingTop: fold.enabled ? fold.height : 0 }}
            extraData={{ draft, selected }}
            keyboardShouldPersistTaps="handled"
            onScroll={fold.onScroll}
            scrollEventThrottle={16}
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
      <PoolFilterSheet open={open} rows={rows} groups={groups} notOwned={draftFilter.owned && collectionSet ? notOwned : null} collection={collectionSet} heroes={motkOn} filter={draftFilter} onChange={setDraftFilter} onDismiss={dismiss} onApply={apply} />
    </View>
  );
}

// The bar's count of the side deck: "12 cards", or "9 of 14 loot" while the deck's contract builds a loot deck from it ("16 loot, 14
// kept" past the size: the player leaves the rest out at Setup).
function sideDeckLine(count: number, loot: { found: number; size: number } | null): string {
  if (loot && loot.found > loot.size) return `${loot.found} loot, ${loot.size} kept`;
  if (loot) return `${loot.found} of ${loot.size} loot`;
  return `${count} ${count === 1 ? "card" : "cards"}`;
}

// The two piles the pool adds to while adding, by name.
const PILE_WORDS = ["Deck", "Side deck"] as const;

function pileWord(pile: DraftPile): (typeof PILE_WORDS)[number] {
  return pile === "side" ? "Side deck" : "Deck";
}

/** Filter, with a round count of the filters on beside the word. */
function FilterButton({ count, onPress }: { count: number; onPress: () => void }) {
  const palette = usePalette();
  const s = useUiScale();
  const badge =
    count > 0 ? (
      <View className="items-center justify-center rounded-control" style={{ minWidth: 20 * s, height: 20 * s, paddingHorizontal: 5 * s, backgroundColor: palette.accent }}>
        <Text className="font-display" style={{ fontSize: 12 * s, lineHeight: 15 * s, color: palette.onAccent }}>
          {String(count)}
        </Text>
      </View>
    ) : null;
  return <SecondaryButton testID="pool-filter" label="Filter" accessibilityLabel={count > 0 ? `Filter, ${count} on` : "Filter"} trailing={badge} onPress={onPress} />;
}

// The pool on its own route: the Cards tab, or the pool the deck editor pushes on a phone. `header` is the screen's top: the tab's
// title, or the editor's NavBar naming the deck. Adding, a bar shows the deck's count against 50 (or the side deck's count) beside Done,
// and every change is said in a toast with Undo.
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
  const heroes = useDeckDraft((current) => current.heroes);
  const deckCards = useDeckDraft((current) => current.cards);
  const sideCards = useDeckDraft((current) => current.side);
  const side = useDeckDraft((current) => current.target === "side");
  const preview = useListPreview();
  const { catalog } = useDatabases();
  // With The Burglar's Turn in the deck, the side deck's bar counts the loot deck against its size (src/catalog/loot.ts).
  const loot = useMemo(() => deckLootRule(deckCards), [deckCards]);
  const lootFound = loot ? lootCodes(loot, sideCards, poolOf(catalog).byCode).length : 0;
  const sideCount = deckCardCount(sideCards);
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
                  <Text className="text-label text-muted">{side ? "Side deck" : "Deck"}</Text>
                  <Text testID="pool-deck-count" className="text-label text-bone" numberOfLines={1}>
                    {side ? sideDeckLine(sideCount, loot ? { found: lootFound, size: loot.size } : null) : deckCountLine({ heroes, cards: deckCards })}
                  </Text>
                </View>
                {side && !loot ? null : (
                  <View className="mt-1.5">
                    <ProgressBar value={side ? lootFound : deckCardCount(deckCards)} max={side && loot ? loot.size : DECK_MINIMUM} />
                  </View>
                )}
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
