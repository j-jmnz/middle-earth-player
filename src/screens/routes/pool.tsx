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

import { activeCardCodes } from "../../catalog/active-text";
import { formatDeckRefusal, traitTokens } from "../../catalog/deck-save";
import { cards, packs } from "../../catalog/schema";
import { EFFECTS } from "../../effects";
import {
  BodyText,
  ListRow,
  NavBar,
  PaperSheet,
  PrimaryButton,
  Screen,
  SphereMark,
  TextButton,
  markedSphere,
  pressedNight,
  sphereWord,
} from "../chrome";
import { addDraftCard, draftCopyCount, useDeckDraft } from "../deck-draft";
import { useDatabases } from "../databases";
import { enqueueImageDownloads } from "../images/queue";
import { CardThumb } from "../images/picture";
import { palette } from "../palette.js";
import {
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

function OptionRow({ label, detail, onPress }: { label: string; detail: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-14 flex-row items-center justify-between border-b border-inkLine"
    >
      <Text className="text-body text-ink">{label}</Text>
      <Text className="ml-3 shrink text-label text-inkMuted" numberOfLines={1}>
        {detail}
      </Text>
    </Pressable>
  );
}

function PoolCardRow({
  item,
  adding,
  count,
}: {
  item: PoolRowCard;
  adding: boolean;
  count: number;
}) {
  const router = useRouter();
  return (
    <ListRow
      testID={`card-${item.code}`}
      label={item.name}
      detail={poolDetail(item)}
      leading={<CardThumb code={item.code} imagesrc={item.imagesrc} width={thumb.width} height={thumb.height} />}
      onPress={() => {
        router.push({ pathname: "/card/[code]", params: { code: item.code } });
      }}
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

export default function CardPool() {
  const router = useRouter();
  const params = useLocalSearchParams<{ adding?: string | string[] }>();
  const adding = params.adding === "1" || (Array.isArray(params.adding) && params.adding[0] === "1");
  const draft = useDeckDraft();
  const { height } = useWindowDimensions();
  const { catalog } = useDatabases();
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
  const [activeCodes] = useState(() => activeCardCodes(EFFECTS));
  const groups = useMemo(() => cycleGroups(packRows), [packRows]);
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState<PoolFilter>(emptyPoolFilter);
  const [draftFilter, setDraftFilter] = useState<PoolFilter>(emptyPoolFilter);
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
    () => filterPool(rows, search, applied, groups, activeCodes),
    [rows, search, applied, groups, activeCodes],
  );
  const spheres = useMemo(() => sphereChoices(rows), [rows]);
  const types = useMemo(() => typeChoices(rows), [rows]);
  const traits = useMemo(() => traitChoices(rows), [rows]);
  const costs = useMemo(() => costChoices(rows), [rows]);
  const held = adding ? draft.heldRefusal : null;

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
        <NavBar backLabel="Decks" backTestID="pool-back" onBack={() => goBack(router, "/decks")} />
        <View className="mt-3 flex-row items-center gap-2">
          <TextInput
            testID="pool-search"
            value={search}
            onChangeText={setSearch}
            placeholder="Search"
            placeholderTextColor={palette.faint}
            autoCorrect={false}
            autoCapitalize="none"
            className="min-h-11 flex-1 rounded-pill bg-raised px-4 text-body text-bone"
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
                />
              ) : null
            }
          />
        </View>
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
      <OptionRow label="Cost" detail={filter.cost ?? "Any"} onPress={() => onChoose("cost")} />
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
        <OptionRow key={cost} label={cost} detail="" onPress={() => pick({ ...filter, cost })} />
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
