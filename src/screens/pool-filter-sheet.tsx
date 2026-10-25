import { FlashList } from "@shopify/flash-list";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Modal, Pressable, ScrollView, Switch, Text, useWindowDimensions, View } from "react-native";

import { PaperSheet, PrimaryButton, SphereMark, TextButton, markedSphere } from "./chrome";
import { palette } from "./palette.js";
import {
  filterSheetAnimation,
  packChooserRows,
  traitChooserRows,
  type CycleGroup,
  type PoolFilter,
} from "./pool-filter";
import { GameIcon } from "../play/game-icon";
import type { IconName } from "../play/icon-map";

// The card pool's Filter sheet: sphere chips, pack or cycle, trait, cost and two switches, edited as a draft and applied
// at once. The type is the pool's chip row, not a field here.

function useReduceMotion(): boolean {
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
  return reduceMotion;
}

export function PoolFilterSheet({
  open,
  applied,
  groups,
  spheres,
  traits,
  costs,
  onApply,
  onClose,
}: {
  open: boolean;
  applied: PoolFilter;
  groups: CycleGroup[];
  spheres: { code: string; name: string }[];
  traits: string[];
  costs: string[];
  onApply: (next: PoolFilter) => void;
  onClose: () => void;
}) {
  const { height } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const [draftFilter, setDraftFilter] = useState<PoolFilter>(applied);
  const [chooser, setChooser] = useState<"pack" | "trait" | "cost" | null>(null);

  // Each opening starts from the filter in use, on the sheet's first page (set while rendering, as React advises for
  // state that follows a prop).
  const [shown, setShown] = useState(open);
  if (open !== shown) {
    setShown(open);
    if (open) {
      setDraftFilter(applied);
      setChooser(null);
    }
  }

  function dismiss(): void {
    setChooser(null);
    onClose();
  }

  function apply(): void {
    setChooser(null);
    onApply(draftFilter);
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
  groups,
  onChange,
  onChoose,
}: {
  filter: PoolFilter;
  spheres: { code: string; name: string }[];
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
      <View className="mt-1" />
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
