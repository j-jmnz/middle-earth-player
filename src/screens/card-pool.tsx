import { FlashList } from "@shopify/flash-list";
import { eq } from "drizzle-orm";
import { useRouter } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { cards, packs } from "../catalog/schema";
import { BodyText, Eyebrow, ListRow, PrimaryButton, Screen, SphereMark, TextButton, markedSphere } from "./chrome";
import { CountStepper } from "./count-stepper";
import { addDraftCard, announceDraftChange, draftAddRefused, draftCopyCount, takeDraftCard, useDeckDraft, type TitleLookup } from "./deck-draft";
import { deckCountLine } from "./deck-status";
import { useDatabases } from "./databases";
import { enqueueImageDownloads } from "./images/queue";
import { CardThumb, useCardPreview } from "./images/picture";
import { useListPreview } from "./list-preview";
import { notAppliedCodes } from "../play/not-applied";
import type { PictureSource } from "../play/table-canvas-types";
import { palette } from "./palette.js";
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
}: {
  item: PoolRowCard;
  adding: boolean;
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
      detail={poolDetail(item)}
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

// Night chips for the type, one tap from the search field. The filter sheet leaves the type to them.
function TypeChips({ types, value, onChange }: { types: { code: string; name: string }[]; value: string | null; onChange: (next: string | null) => void }) {
  const options = [{ code: null, name: "All" }, ...types];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" className="-mx-6 mt-2 grow-0" contentContainerClassName="gap-2 px-6">
      {options.map((option) => {
        const selected = value === option.code;
        return (
          <Pressable
            key={option.code ?? "all"}
            testID={`pool-type-${option.code ?? "all"}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.code)}
            className={`min-h-11 justify-center rounded-pill px-4 ${selected ? "bg-gold" : "bg-raised"}`}
          >
            <Text className={selected ? "text-body font-semibold text-onGold" : "text-body text-muted"}>{option.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// The deck-legal player pool, searched and filtered in memory. The Cards tab browses it; the deck editor opens it with
// `adding` to put cards in the open draft: each row then has − and +, every change is said in a toast with Undo, and a bar
// shows the deck's counts above Done. `header` is the screen's top: the tab's title, or the editor's NavBar. `startType`
// opens it on one type (an empty hero slot opens it on heroes).
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
    notAppliedCodes(catalog.select({ code: cards.code, text: cards.text }).from(cards).where(eq(cards.deckLegal, true)).all().map((row) => [row.code, row.text] as const)),
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
        {adding ? (
          <View className="mt-1">
            <Eyebrow tone="muted">Adding to</Eyebrow>
            <Text className="mt-0.5 font-display text-title text-bone" numberOfLines={1}>
              {draft.name.trim() || "New deck"}
            </Text>
          </View>
        ) : null}
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
          <TextButton
            testID="pool-filter"
            label={filters > 0 ? `Filter · ${filters}` : "Filter"}
            accessibilityLabel={filters > 0 ? `Filter, ${filters} on` : "Filter"}
            onPress={openSheet}
          />
        </View>
        <TypeChips types={types} value={applied.typeCode} onChange={(typeCode) => setApplied({ ...applied, typeCode })} />
        <View className="mt-2 min-h-0 flex-1">
          <FlashList
            data={visible}
            keyExtractor={(item) => item.code}
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
            renderItem={({ item }) =>
              item ? (
                <PoolCardRow
                  item={item}
                  adding={adding}
                  count={draftCopyCount(draft, item.code, item.typeCode)}
                  full={draftAddRefused(draft, item, lookup)}
                  lookup={lookup}
                  onPreview={preview.open}
                />
              ) : null
            }
          />
        </View>
        <ToastView />
        {adding ? (
          <View testID="pool-deck-bar" className="flex-row items-center gap-3 border-t border-hairline pb-safe pt-3">
            <View className="flex-1">
              <Text testID="pool-deck-count" className="text-body text-bone">
                {deckCountLine(draft)}
              </Text>
              <Text className="text-label text-muted" numberOfLines={1}>
                Tap + to add, − to take out
              </Text>
            </View>
            <PrimaryButton testID="pool-done" label="Done" onPress={() => onDone?.()} />
          </View>
        ) : null}
      </View>
      <PoolFilterSheet open={open} rows={rows} groups={groups} filter={draftFilter} onChange={setDraftFilter} onDismiss={dismiss} onApply={apply} />
      {preview.overlay}
    </Screen>
  );
}
