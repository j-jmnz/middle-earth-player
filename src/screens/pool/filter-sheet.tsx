import { FlashList } from "@shopify/flash-list";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";

import { traitTokens } from "../../catalog/deck-save";
import { GameIcon } from "../../ui/game-icon";
import type { IconName } from "../../ui/icon-map";
import { useReduceMotion } from "../../ui/motion-run";
import { PaperSheet, PrimaryButton, SettingSwitch, SphereMark, TextButton, markedSphere, sphereWord } from "../kit/chrome";
import { usePalette } from "../kit/palette-hook";
import { SheetModal } from "../kit/sheet-modal";
import {
  costOptions,
  filterSheetAnimation,
  packChooserRows,
  packDetail,
  traitChooserRows,
  type PackGroup,
  type PoolCard,
  type PoolFilter,
} from "./filter";
import { withAlphaHex } from "../../ui/tokens";
import { useUiScale } from "../../ui/ui-scale";
import { useSizeClass } from "../../ui/use-size-class";
import { Text } from "../../ui/text";

type FilterRow = PoolCard & { typeName: string; sphereName: string | null };

type Chooser = "pack" | "trait" | "cost" | null;

// The pool's filter as a paper sheet over the list: sphere chips, then pack, trait and cost choosers and the two
// switches. It edits `filter` (the draft); Apply hands it back, Close and the scrim drop it.
export function PoolFilterSheet({
  open,
  rows,
  groups,
  notOwned,
  filter,
  onChange,
  onDismiss,
  onApply,
}: {
  open: boolean;
  rows: readonly FilterRow[];
  groups: readonly PackGroup[];
  // The packs switched off while My collection is on: the chooser leaves them out. Null lists every pack.
  notOwned: ReadonlySet<string> | null;
  filter: PoolFilter;
  onChange: (next: PoolFilter) => void;
  onDismiss: () => void;
  onApply: () => void;
}) {
  const { height } = useWindowDimensions();
  const { size, s } = useSizeClass();
  // A sheet floating centred outside compact leaves 280 pt for its title, buttons and margins, so it never passes the window.
  const listHeight = size === "compact" ? height * 0.62 : Math.min(height * 0.62, height - 280 * s);
  const [chooser, setChooser] = useState<Chooser>(null);
  const reduceMotion = useReduceMotion();
  const spheres = useMemo(() => sphereChoices(rows), [rows]);
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
    <SheetModal visible={open} animationType={filterSheetAnimation(reduceMotion)} onRequestClose={dismiss} scrimLabel="Close filter">
      <PaperSheet title={chooserTitle(chooser)}>
        {chooser === "pack" ? (
          <OptionList
            rows={packChooserRows(groups, notOwned)}
            listHeight={listHeight}
            onBack={() => setChooser(null)}
            onPick={(row) => {
              onChange({ ...filter, pack: row.pack });
              setChooser(null);
            }}
          />
        ) : chooser === "trait" ? (
          <OptionList
            rows={traitChooserRows(traits)}
            listHeight={listHeight}
            onBack={() => setChooser(null)}
            onPick={(row) => {
              onChange({ ...filter, trait: row.key === "any" ? null : row.label });
              setChooser(null);
            }}
          />
        ) : (
          <ScrollView style={{ maxHeight: listHeight }} keyboardShouldPersistTaps="handled">
            {chooser === null ? (
              <FilterBody
                filter={filter}
                spheres={spheres}
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
    </SheetModal>
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
  const palette = usePalette();
  const mark = sphere ? markedSphere(sphere) : null;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      className="mb-2 mr-2 min-h-touch flex-row items-center gap-2 rounded-control px-4"
      style={{ backgroundColor: selected ? palette.ink : withAlphaHex(palette.ink, 0.08) }}
    >
      {mark ? <SphereMark sphere={mark} /> : null}
      <Text className={selected ? "text-body font-semibold text-paper" : "text-body text-ink"}>{label}</Text>
    </Pressable>
  );
}

// `opens` is a row that opens a list of choices (its hint says so); the rows in that list pick one.
function OptionRow({ label, detail, onPress, icon, opens = false }: { label: string; detail: string; onPress: () => void; icon?: IconName; opens?: boolean }) {
  const s = useUiScale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={opens ? "Opens a choice" : undefined}
      onPress={onPress}
      className="min-h-14 flex-row items-center justify-between"
    >
      <View className="flex-row items-center gap-2">
        {icon ? <GameIcon name={icon} size={16 * s} tint="ink" /> : null}
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
  return "Filter";
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
  groups: readonly PackGroup[];
  onChange: (next: PoolFilter) => void;
  onChoose: (chooser: "pack" | "trait" | "cost") => void;
}) {
  return (
    <View>
      <Text accessibilityRole="header" className="mb-2 text-label text-inkLabel">
        Sphere
      </Text>
      <View className="flex-row flex-wrap" accessibilityRole="radiogroup" accessibilityLabel="Sphere">
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
      <OptionRow opens label="Pack or cycle" detail={packDetail(filter, groups)} onPress={() => onChoose("pack")} />
      <OptionRow opens label="Trait" detail={filter.trait ?? "Any"} onPress={() => onChoose("trait")} />
      <OptionRow opens label="Cost" icon="cost" detail={filter.cost ?? "Any"} onPress={() => onChoose("cost")} />
      <SettingSwitch surface="paper" roomy label="Unique" value={filter.unique} onChange={(unique) => onChange({ ...filter, unique })} testID="pool-unique" />
      <SettingSwitch surface="paper" roomy label="Active text" value={filter.activeText} onChange={(activeText) => onChange({ ...filter, activeText })} testID="pool-active-text" />
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

/** The pool's card types in the game's order: the type chips over the list (the sheet leaves the type to them). */
export function typeChoices(rows: readonly { typeCode: string; typeName: string }[]): { code: string; name: string }[] {
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
