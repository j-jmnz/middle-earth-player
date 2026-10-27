import { FlashList } from "@shopify/flash-list";
import { eq } from "drizzle-orm";
import { useRouter } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";

import { cards, packs } from "../catalog/schema";
import { ActionBar, BodyText, ListRow, PrimaryButton, ProgressBar, Screen, SearchField, Segmented, SecondaryButton, SphereMark, ToggleChip, markedSphere } from "./chrome";
import { CountStepper } from "./count-stepper";
import { addDraftCard, announceDraftChange, draftAddRefused, draftCopyCount, takeDraftCard, useDeckDraft, type TitleLookup } from "./deck-draft";
import { deckCardCount, deckCountLine, DECK_MINIMUM } from "./deck-status";
import { useDatabases } from "./databases";
import { enqueueImageDownloads } from "./images/queue";
import { CardThumb, useCardPreview } from "./images/picture";
import { useListPreview } from "./list-preview";
import { notAppliedCodes, notAppliedWords } from "../play/not-applied";
import type { PictureSource } from "../play/table-canvas-types";
import { palette } from "./palette.js";
import { setPoolView, usePoolView } from "./pool-view";
import { withAlphaHex } from "../play/tokens";
import { activeFilterCount, cycleGroups, emptyPoolFilter, filterPool, poolDetail, sortPool, type PoolCard, type PoolFilter } from "./pool-filter";
import { PoolFilterSheet, typeChoices } from "./pool-filter-sheet";
import { ToastView } from "./toast-view";

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
  full,
  lookup,
  onPreview,
  loss = null,
}: {
  item: PoolRowCard;
  adding: boolean;
  // What the app does not apply of this card, in a few words ("Ability not applied"), or null.
  loss?: string | null;
  count: number;
  // Whether + would be refused: the title is at its copy limit (any printing), or the hero is taken or the slots are full.
  full: boolean;
  lookup: TitleLookup;
  onPreview: (code: string, name: string, source: PictureSource | null) => void;
}) {
  const router = useRouter();
  const picture = useCardPreview(item.code, item.imagesrc);
  const card = { code: item.code, name: item.name, typeCode: item.typeCode, deckLimit: item.deckLimit };
  return (
    <ListRow
      testID={`card-${item.code}`}
      label={item.name}
      detail={loss ? `${poolDetail(item)} · ${loss}` : poolDetail(item)}
      detailIcons={<RowIcons sphere={item.sphereCode} />}
      leading={<CardThumb code={item.code} imagesrc={item.imagesrc} width={thumb.width} height={thumb.height} />}
      onPress={() => {
        router.push({ pathname: "/card/[code]", params: { code: item.code } });
      }}
      onLongPress={() => onPreview(item.code, item.name, picture)}
      trailing={
        adding ? (
          <CountStepper
            code={item.code}
            name={item.name}
            count={count}
            full={full}
            minus={count > 0}
            ids={{ dec: `take-${item.code}`, count: `pool-count-${item.code}`, inc: `add-${item.code}` }}
            onChange={(delta) => announceDraftChange(delta > 0 ? addDraftCard(card, lookup) : takeDraftCard(card, lookup))}
          />
        ) : undefined
      }
    />
  );
}

const GRID_COLUMNS = 3;
const GRID_GAP = 10;
const CARD_RATIO = 600 / 429;

// One card in the grid: its picture, the name under a missing picture, the count the deck holds (gold) and, while adding, − and +
// under it. A tap opens the card, a long press shows it large, as a row does.
function PoolCardCell({
  item,
  width,
  adding,
  count,
  full,
  lookup,
  onPreview,
  loss = null,
}: {
  item: PoolRowCard;
  width: number;
  adding: boolean;
  loss?: string | null;
  count: number;
  full: boolean;
  lookup: TitleLookup;
  onPreview: (code: string, name: string, source: PictureSource | null) => void;
}) {
  const router = useRouter();
  const picture = useCardPreview(item.code, item.imagesrc);
  const card = { code: item.code, name: item.name, typeCode: item.typeCode, deckLimit: item.deckLimit };
  const height = Math.round(width * CARD_RATIO);
  return (
    <View style={{ width, marginBottom: 14 }}>
      <Pressable
        testID={`card-${item.code}`}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${poolDetail(item)}${loss ? `, ${loss}` : ""}${adding && count > 0 ? `, ${count} in the deck` : ""}`}
        accessibilityHint="Opens the card. Hold to show it large"
        onPress={() => router.push({ pathname: "/card/[code]", params: { code: item.code } })}
        onLongPress={() => onPreview(item.code, item.name, picture)}
        delayLongPress={350}
      >
        {({ pressed }) => (
          <View style={{ width, height, borderRadius: 8, overflow: "hidden", opacity: pressed ? 0.75 : 1, borderWidth: adding && count > 0 ? 1.5 : 1, borderColor: adding && count > 0 ? palette.gold : withAlphaHex(palette.bone, 0.08), backgroundColor: palette.raised }}>
            {picture ? (
              <CardThumb code={item.code} imagesrc={item.imagesrc} width={width - 2} height={height - 2} />
            ) : (
              <View className="flex-1 justify-between p-2">
                <Text className="font-display text-label text-bone" numberOfLines={4}>
                  {item.name}
                </Text>
                <View className="flex-row items-center gap-1">
                  <RowIcons sphere={item.sphereCode} />
                  <Text className="text-micro text-muted" numberOfLines={1}>
                    {item.typeName}
                  </Text>
                </View>
              </View>
            )}
            {loss ? (
              <View className="absolute bottom-1 left-1 right-1 rounded px-1 py-0.5" style={{ backgroundColor: withAlphaHex(palette.night, 0.82) }}>
                <Text className="text-center text-micro text-muted" numberOfLines={1}>
                  {loss}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </Pressable>
      {adding && count > 0 ? (
        <View pointerEvents="none" className="absolute -right-1.5 -top-1.5 h-6 min-w-6 items-center justify-center rounded-pill px-1.5" style={{ backgroundColor: palette.gold, borderWidth: 2, borderColor: palette.night }}>
          <Text className="font-display-bold text-label text-onGold">{String(count)}</Text>
        </View>
      ) : null}
      {adding ? (
        <View className="mt-1.5 items-center">
          <CountStepper
            code={item.code}
            name={item.name}
            count={count}
            full={full}
            minus={count > 0}
            ids={{ dec: `take-${item.code}`, count: `pool-count-${item.code}`, inc: `add-${item.code}` }}
            onChange={(delta) => announceDraftChange(delta > 0 ? addDraftCard(card, lookup) : takeDraftCard(card, lookup))}
          />
        </View>
      ) : null}
    </View>
  );
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
  const preview = useListPreview();
  const view = usePoolView();
  const { width: screenWidth } = useWindowDimensions();
  // The grid fills the page inside its inset: three cards a row with a 10 pt gap.
  const cellWidth = Math.floor((Math.min(screenWidth, 600) - 48 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
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
  const [applied, setApplied] = useState<PoolFilter>(() => ({ ...emptyPoolFilter, typeCode: startType }));
  const [draftFilter, setDraftFilter] = useState<PoolFilter>(applied);
  const [open, setOpen] = useState(false);
  const visible = useMemo(
    () => filterPool(rows, search, applied, groups, inactiveCodes),
    [rows, search, applied, groups, inactiveCodes],
  );
  const types = useMemo(() => typeChoices(rows), [rows]);
  // Other printings of a title share its copy limit: the deck's codes are named from the loaded rows.
  const lookup = useMemo<TitleLookup>(() => {
    const byCode = new Map(rows.map((row) => [row.code, row]));
    return (code) => byCode.get(code);
  }, [rows]);
  const filters = activeFilterCount(applied);

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
          <Segmented options={["Grid", "List"] as const} value={view} onChange={setPoolView} testIDPrefix="pool-view" compact />
        </View>
        <View className="mt-2 min-h-0 flex-1">
          <FlashList
            key={view}
            data={visible}
            keyExtractor={(item) => item.code}
            numColumns={view === "Grid" ? GRID_COLUMNS : 1}
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
            renderItem={({ item, index }) =>
              item ? (
                view === "Grid" ? (
                  <View style={{ marginLeft: index % GRID_COLUMNS === 0 ? 0 : GRID_GAP }}>
                    <PoolCardCell
                      item={item}
                      width={cellWidth}
                      adding={adding}
                      loss={inactiveCodes.has(item.code) ? notAppliedWords(item.code, item.typeCode) : null}
                      count={draftCopyCount(draft, item.code, item.typeCode)}
                      full={draftAddRefused(draft, item, lookup)}
                      lookup={lookup}
                      onPreview={preview.open}
                    />
                  </View>
                ) : (
                  <PoolCardRow
                    item={item}
                    adding={adding}
                    loss={inactiveCodes.has(item.code) ? notAppliedWords(item.code, item.typeCode) : null}
                    count={draftCopyCount(draft, item.code, item.typeCode)}
                    full={draftAddRefused(draft, item, lookup)}
                    lookup={lookup}
                    onPreview={preview.open}
                  />
                )
              ) : null
            }
          />
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
