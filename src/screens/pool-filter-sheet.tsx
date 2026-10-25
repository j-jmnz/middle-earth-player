import { FlashList } from "@shopify/flash-list";
import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Modal, Pressable, ScrollView, Switch, Text, useWindowDimensions, View } from "react-native";

import { traitTokens } from "../catalog/deck-save";
import { GameIcon } from "../play/game-icon";
import type { IconName } from "../play/icon-map";
import { PaperSheet, PrimaryButton, SphereMark, TextButton, markedSphere, sphereWord } from "./chrome";
import { palette } from "./palette.js";
import {
  costOptions,
  filterSheetAnimation,
  packChooserRows,
  traitChooserRows,
  type CycleGroup,
  type PoolCard,
  type PoolFilter,
} from "./pool-filter";

type FilterRow = PoolCard & { typeName: string; sphereName: string | null };

type Chooser = "pack" | "trait" | "cost" | null;

// The pool's filter as a paper sheet over the list: sphere and type chips, then pack, trait and cost choosers and the two
// switches. It edits `filter` (the draft); Apply hands it back, Close and the scrim drop it.
export function PoolFilterSheet({
  open,
  rows,
  groups,
  filter,
  onChange,
  onDismiss,
  onApply,
}: {
  open: boolean;
  rows: readonly FilterRow[];
  groups: CycleGroup[];
  filter: PoolFilter;
  onChange: (next: PoolFilter) => void;
  onDismiss: () => void;
  onApply: () => void;
}) {
  const { height } = useWindowDimensions();
  const [chooser, setChooser] = useState<Chooser>(null);
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
  const spheres = useMemo(() => sphereChoices(rows), [rows]);
  const types = useMemo(() => typeChoices(rows), [rows]);
  const traits = useMemo(() => traitChoices(rows), [rows]);
  const costs = useMemo(() => costOptions(rows), [rows]);

  function dismiss(): void {
    setChooser(null);
    onDismiss();
  }

  function apply(): void {
    setChooser(null);
    onApply();
  }

  return (
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
                onChange({ ...filter, pack: row.pack });
                setChooser(null);
              }}
            />
          ) : chooser === "trait" ? (
            <OptionList
              rows={traitChooserRows(traits)}
              listHeight={height * 0.62}
              onBack={() => setChooser(null)}
              onPick={(row) => {
                onChange({ ...filter, trait: row.key === "any" ? null : row.label });
                setChooser(null);
              }}
            />
          ) : (
            <ScrollView style={{ maxHeight: height * 0.62 }} keyboardShouldPersistTaps="handled">
              {chooser === null ? (
                <FilterBody
                  filter={filter}
                  spheres={spheres}
                  types={types}
                  groups={groups}
                  onChange={onChange}
                  onChoose={setChooser}
                />
              ) : (
                <CostChooser
                  filter={filter}
                  costs={costs}
                  onChange={onChange}
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
  );
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

function sphereChoices(rows: readonly FilterRow[]): { code: string; name: string }[] {
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

function typeChoices(rows: readonly FilterRow[]): { code: string; name: string }[] {
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

function traitChoices(rows: readonly FilterRow[]): string[] {
  const tokens = new Set<string>();
  for (const row of rows) {
    for (const token of traitTokens(row.traits)) tokens.add(token);
  }
  return [...tokens].sort((left, right) => left.localeCompare(right));
}
