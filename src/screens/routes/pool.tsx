import { FlashList } from "@shopify/flash-list";
import { eq } from "drizzle-orm";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { inactiveCodes as inactiveTextCodes } from "../../catalog/active-text";
import { traitTokens } from "../../catalog/deck-save";
import { cards, packs } from "../../catalog/schema";
import { EFFECTS } from "../../effects";
import {
  BodyText,
  Eyebrow,
  ListRow,
  NavBar,
  PaperSheet,
  PrimaryButton,
  Screen,
  SphereMark,
  TextButton,
  markedSphere,
  sphereWord,
} from "../chrome";
import { CountStepper, stepperFull } from "../count-stepper";
import { addDraftCard, announceDraftChange, draftCopyCount, takeDraftCard, useDeckDraft, type DraftContent } from "../deck-draft";
import { deckCountLine } from "../deck-status";
import { useDatabases } from "../databases";
import { enqueueImageDownloads } from "../images/queue";
import { CardThumb, useCardPreview } from "../images/picture";
import { useListPreview } from "../list-preview";
import { ToastView } from "../toast-view";
import type { PictureSource } from "../../play/table-canvas-types";
import { palette } from "../palette.js";
import {
  activeFilterCount,
  costOptions,
  cycleGroups,
  emptyPoolFilter,
  filterPool,
  filterSheetAnimation,
  packChooserRows,
  poolDetail,
  traitChooserRows,
  type CycleGroup,
  type PoolCard,
  type PoolFilter,
} from "../pool-filter";
import { GameIcon } from "../../play/game-icon";
import type { IconName } from "../../play/icon-map";
import { goBack } from "../go-back";

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

function Chip({
  label,
  selected,
  onPress,
  sphere,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  sphere?: string;
}) {
  const mark = sphere ? markedSphere(sphere) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`mb-2 mr-2 min-h-11 flex-row items-center gap-2 rounded-pill px-3 ${selected ? "bg-gold" : "bg-paperPressed"}`}
    >
      {mark ? <SphereMark sphere={mark} /> : null}
      <Text className={selected ? "text-body font-semibold text-onGold" : "text-body text-ink"}>{label}</Text>
    </Pressable>
  );
}

function OptionRow({ label, detail, onPress, icon }: { label: string; detail: string; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-14 flex-row items-center justify-between border-b border-inkLine"
    >
      <View className="flex-row items-center gap-2">
        {icon ? <GameIcon name={icon} size={16} tint="ink" /> : null}
        <Text className="text-body text-ink">{label}</Text>
      </View>
      <Text className="ml-3 shrink text-label text-inkMuted" numberOfLines={1}>
        {detail}
      </Text>
    </Pressable>
  );
}

// The sphere's printed icon before the row's words ("Ally · Spirit · 2").
function RowIcons({ sphere }: { sphere: string | null }) {
  const mark = markedSphere(sphere);
  return mark ? <SphereMark sphere={mark} size={12} /> : null;
}

// The + on a hero is spent when the hero is in the deck or the three slots are full; on another card, at its copy limit.
function addFull(item: PoolRowCard, count: number, deck: DraftContent): boolean {
  if (item.typeCode === "hero") return count > 0 || deck.heroes.length >= 3;
  return stepperFull(count, item.deckLimit);
}

function PoolCardRow({
  item,
  adding,
  count,
  full,
  onPreview,
}: {
  item: PoolRowCard;
  adding: boolean;
  count: number;
  full: boolean;
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
            onChange={(delta) => announceDraftChange(delta > 0 ? addDraftCard(card) : takeDraftCard(card))}
          />
        ) : undefined
      }
    />
  );
}

// Night chips for the type, one tap from the search field. The filter sheet sets the same field.
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

export default function CardPool() {
  const router = useRouter();
  const params = useLocalSearchParams<{ adding?: string | string[]; type?: string | string[] }>();
  const adding = params.adding === "1" || (Array.isArray(params.adding) && params.adding[0] === "1");
  // An empty hero slot opens the pool on heroes.
  const startType = typeof params.type === "string" && params.type.length > 0 ? params.type : null;
  const draft = useDeckDraft();
  const { height } = useWindowDimensions();
  const { catalog } = useDatabases();
  const preview = useListPreview();
  const [rows] = useState(() =>
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
      .orderBy(cards.name, cards.code)
      .all(),
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
  const [applied, setApplied] = useState<PoolFilter>(() => ({ ...emptyPoolFilter, typeCode: startType }));
  const [draftFilter, setDraftFilter] = useState<PoolFilter>(applied);
  const [barHeight, setBarHeight] = useState(0);
  const [open, setOpen] = useState(false);
  const [chooser, setChooser] = useState<"pack" | "trait" | "cost" | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let current = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (current) setReduceMotion(enabled);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      setReduceMotion(enabled);
    });
    return () => {
      current = false;
      subscription.remove();
    };
  }, []);
  const visible = useMemo(
    () => filterPool(rows, search, applied, groups, inactiveCodes),
    [rows, search, applied, groups, inactiveCodes],
  );
  const spheres = useMemo(() => sphereChoices(rows), [rows]);
  const types = useMemo(() => typeChoices(rows), [rows]);
  const traits = useMemo(() => traitChoices(rows), [rows]);
  const costs = useMemo(() => costChoices(rows), [rows]);
  const filters = activeFilterCount(applied);

  function openSheet(): void {
    setDraftFilter(applied);
    setChooser(null);
    setOpen(true);
  }

  function dismiss(): void {
    setChooser(null);
    setOpen(false);
  }

  function apply(): void {
    setApplied(draftFilter);
    setChooser(null);
    setOpen(false);
  }

  return (
    <Screen scene="plain">
      <View className="min-h-0 flex-1">
        <NavBar backLabel={adding ? "Deck" : "Decks"} backTestID="pool-back" onBack={() => goBack(router, "/decks")} />
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
                  full={addFull(item, draftCopyCount(draft, item.code, item.typeCode), draft)}
                  onPreview={preview.open}
                />
              ) : null
            }
          />
        </View>
        {adding ? (
          <View
            testID="pool-deck-bar"
            className="flex-row items-center gap-3 border-t border-hairline pb-safe pt-3"
            onLayout={(event) => setBarHeight(Math.round(event.nativeEvent.layout.height))}
          >
            <View className="flex-1">
              <Text testID="pool-deck-count" className="text-body text-bone">
                {deckCountLine(draft)}
              </Text>
              <Text className="text-label text-muted" numberOfLines={1}>
                Tap + to add, − to take out
              </Text>
            </View>
            <PrimaryButton testID="pool-done" label="Done" onPress={() => goBack(router, "/decks")} />
          </View>
        ) : null}
      </View>
      <Modal visible={open} transparent animationType={filterSheetAnimation(reduceMotion)} onRequestClose={dismiss}>
        <View className="flex-1 justify-end">
          <Pressable
            accessibilityLabel="Close filter"
            onPress={dismiss}
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: palette.night, opacity: 0.72 }}
          />
          <PaperSheet step="Filter" title={chooserTitle(chooser)}>
            {chooser === "pack" ? (
              <OptionList
                rows={packChooserRows(groups)}
                listHeight={height * 0.62}
                onBack={() => setChooser(null)}
                onPick={(row) => {
                  setDraftFilter({ ...draftFilter, pack: row.pack });
                  setChooser(null);
                }}
              />
            ) : chooser === "trait" ? (
              <OptionList
                rows={traitChooserRows(traits)}
                listHeight={height * 0.62}
                onBack={() => setChooser(null)}
                onPick={(row) => {
                  setDraftFilter({ ...draftFilter, trait: row.key === "any" ? null : row.label });
                  setChooser(null);
                }}
              />
            ) : (
              <ScrollView style={{ maxHeight: height * 0.62 }} keyboardShouldPersistTaps="handled">
                {chooser === null ? (
                  <FilterBody
                    filter={draftFilter}
                    spheres={spheres}
                    types={types}
                    groups={groups}
                    onChange={setDraftFilter}
                    onChoose={setChooser}
                  />
                ) : (
                  <CostChooser
                    filter={draftFilter}
                    costs={costs}
                    onChange={setDraftFilter}
                    onBack={() => setChooser(null)}
                  />
                )}
              </ScrollView>
            )}
            {chooser === null ? (
              <View className="mt-4">
                <TextButton testID="pool-filter-close" label="Close" tone="ink" onPress={dismiss} />
                <View className="mt-2">
                  <PrimaryButton testID="pool-apply" label="Apply" surface="paper" onPress={apply} />
                </View>
              </View>
            ) : null}
          </PaperSheet>
        </View>
      </Modal>
      <ToastView bottom={adding ? barHeight + 8 : 12} />
      {preview.overlay}
    </Screen>
  );
}

function chooserTitle(chooser: "pack" | "trait" | "cost" | null): string {
  if (chooser === "pack") return "Pack or cycle";
  if (chooser === "trait") return "Trait";
  if (chooser === "cost") return "Cost";
  return "Card pool";
}

function FilterBody({
  filter,
  spheres,
  types,
  groups,
  onChange,
  onChoose,
}: {
  filter: PoolFilter;
  spheres: { code: string; name: string }[];
  types: { code: string; name: string }[];
  groups: CycleGroup[];
  onChange: (next: PoolFilter) => void;
  onChoose: (chooser: "pack" | "trait" | "cost") => void;
}) {
  return (
    <View>
      <Text className="mb-2 text-label text-inkLabel">Sphere</Text>
      <View className="flex-row flex-wrap">
        {spheres.map((sphere) => (
          <Chip
            key={sphere.code}
            label={sphere.name}
            sphere={sphere.code}
            selected={filter.sphere === sphere.code}
            onPress={() => onChange({ ...filter, sphere: filter.sphere === sphere.code ? null : sphere.code })}
          />
        ))}
      </View>
      <Text className="mb-2 mt-3 text-label text-inkLabel">Type</Text>
      <View className="flex-row flex-wrap">
        {types.map((type) => (
          <Chip
            key={type.code}
            label={type.name}
            selected={filter.typeCode === type.code}
            onPress={() => onChange({ ...filter, typeCode: filter.typeCode === type.code ? null : type.code })}
          />
        ))}
      </View>
      <OptionRow label="Pack or cycle" detail={packDetail(filter, groups)} onPress={() => onChoose("pack")} />
      <OptionRow label="Trait" detail={filter.trait ?? "Any"} onPress={() => onChoose("trait")} />
      <OptionRow label="Cost" icon="cost" detail={filter.cost ?? "Any"} onPress={() => onChoose("cost")} />
      <View className="min-h-14 flex-row items-center justify-between border-b border-inkLine">
        <Text className="text-body text-ink">Unique</Text>
        <Switch
          value={filter.unique}
          onValueChange={(unique) => onChange({ ...filter, unique })}
          trackColor={{ false: palette.hairline, true: palette.gold }}
          ios_backgroundColor={palette.hairline}
        />
      </View>
      <View className="min-h-14 flex-row items-center justify-between">
        <Text className="text-body text-ink">Active text</Text>
        <Switch
          value={filter.activeText}
          onValueChange={(activeText) => onChange({ ...filter, activeText })}
          trackColor={{ false: palette.hairline, true: palette.gold }}
          ios_backgroundColor={palette.hairline}
        />
      </View>
    </View>
  );
}

function OptionList<T extends { key: string; label: string; detail: string }>({
  rows,
  listHeight,
  onPick,
  onBack,
}: {
  rows: readonly T[];
  listHeight: number;
  onPick: (row: T) => void;
  onBack: () => void;
}) {
  return (
    <View style={{ height: listHeight }}>
      <TextButton testID="pool-chooser-back" label="Back" tone="ink" onPress={onBack} />
      <FlashList
        data={rows}
        keyExtractor={(item) => item.key}
        style={{ flex: 1 }}
        renderItem={({ item }) =>
          item ? <OptionRow label={item.label} detail={item.detail} onPress={() => onPick(item)} /> : null
        }
      />
    </View>
  );
}

function CostChooser({
  filter,
  costs,
  onChange,
  onBack,
}: {
  filter: PoolFilter;
  costs: string[];
  onChange: (next: PoolFilter) => void;
  onBack: () => void;
}) {
  function pick(next: PoolFilter): void {
    onChange(next);
    onBack();
  }

  return (
    <View>
      <TextButton testID="pool-chooser-back" label="Back" tone="ink" onPress={onBack} />
      <OptionRow label="Any" detail="" onPress={() => pick({ ...filter, cost: null })} />
      {costs.map((cost) => (
        <OptionRow key={cost} label={cost} icon="cost" detail="" onPress={() => pick({ ...filter, cost })} />
      ))}
    </View>
  );
}

function packDetail(filter: PoolFilter, groups: readonly CycleGroup[]): string {
  const selected = filter.pack;
  if (!selected) return "Any";
  if (selected.kind === "cycle") {
    return groups.find((group) => group.cyclePosition === selected.cyclePosition)?.label ?? "Cycle";
  }
  for (const group of groups) {
    const pack = group.packs.find((candidate) => candidate.code === selected.code);
    if (pack) return pack.name;
  }
  return selected.code;
}

function sphereChoices(rows: readonly PoolRowCard[]): { code: string; name: string }[] {
  const order = ["leadership", "tactics", "spirit", "lore", "fellowship", "baggins", "neutral"];
  const byCode = new Map<string, string>();
  for (const row of rows) {
    if (!row.sphereCode || byCode.has(row.sphereCode)) continue;
    byCode.set(row.sphereCode, sphereWord(row.sphereName));
  }
  const known = order.filter((code) => byCode.has(code)).map((code) => ({ code, name: byCode.get(code) ?? code }));
  const rest = [...byCode.entries()]
    .filter(([code]) => !order.includes(code))
    .map(([code, name]) => ({ code, name }));
  return [...known, ...rest];
}

function typeChoices(rows: readonly PoolRowCard[]): { code: string; name: string }[] {
  const order = ["hero", "ally", "attachment", "event", "contract", "player-side-quest"];
  const byCode = new Map<string, string>();
  for (const row of rows) {
    if (!byCode.has(row.typeCode)) byCode.set(row.typeCode, row.typeName);
  }
  const known = order.filter((code) => byCode.has(code)).map((code) => ({ code, name: byCode.get(code) ?? code }));
  const rest = [...byCode.entries()]
    .filter(([code]) => !order.includes(code))
    .map(([code, name]) => ({ code, name }));
  return [...known, ...rest];
}

function traitChoices(rows: readonly PoolRowCard[]): string[] {
  const tokens = new Set<string>();
  for (const row of rows) {
    for (const token of traitTokens(row.traits)) tokens.add(token);
  }
  return [...tokens].sort((left, right) => left.localeCompare(right));
}

function costChoices(rows: readonly PoolRowCard[]): string[] {
  return costOptions(rows);
}
