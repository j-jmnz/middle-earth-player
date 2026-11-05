import { ScrollView, View } from "react-native";

import { SearchField, Segmented, SphereMark, ToggleChip, markedSphere, sphereWord } from "../kit/chrome";
import { deckListFiltered, setDeckListView, useDeckListView, type DeckListFilter, type DeckListStatus } from "./list";
import { Text } from "../../ui/text";

// The deck list's search, Cards / List switch and filter chips, shared by the Decks tab and the briefing's deck picker.

const VIEWS = ["Cards", "List"] as const;
const STATUSES: { key: DeckListStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ready", label: "Ready" },
  { key: "unready", label: "Not ready" },
];

// A filter chip: a capsule, tinted when on. A sphere chip carries the sphere's icon.
function FilterChip({ label, selected, onPress, sphere, testID }: { label: string; selected: boolean; onPress: () => void; sphere?: string; testID: string }) {
  const mark = sphere ? markedSphere(sphere) : null;
  return <ToggleChip testID={testID} label={label} selected={selected} onPress={onPress} leading={mark ? <SphereMark sphere={mark} size={12} /> : null} />;
}

export function DeckListBar({
  filter,
  onFilter,
  spheres,
  shown,
  total,
  testIDPrefix = "decks",
}: {
  filter: DeckListFilter;
  onFilter: (next: DeckListFilter) => void;
  spheres: { code: string; name: string }[];
  // How many decks the filter keeps, of how many: "1 of 2 decks" while a filter is on.
  shown: number;
  total: number;
  testIDPrefix?: string;
}) {
  const view = useDeckListView();
  return (
    <View className="mt-2">
      <View className="flex-row items-center gap-2">
        <SearchField testID={`${testIDPrefix}-search`} value={filter.query} onChangeText={(query) => onFilter({ ...filter, query })} placeholder="Search" accessibilityLabel="Search decks or heroes" />
        <Segmented options={VIEWS} value={view} onChange={setDeckListView} testIDPrefix={`${testIDPrefix}-view`} accessibilityLabel="Deck view" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" className="-mx-6 mt-2 grow-0" contentContainerClassName="gap-1.5 px-6">
        {STATUSES.map((status) => (
          <FilterChip
            key={status.key}
            testID={`${testIDPrefix}-status-${status.key}`}
            label={status.label}
            selected={filter.status === status.key}
            onPress={() => onFilter({ ...filter, status: status.key })}
          />
        ))}
        {spheres.map((sphere) => (
          <FilterChip
            key={sphere.code}
            testID={`${testIDPrefix}-sphere-${sphere.code}`}
            label={sphereWord(sphere.name)}
            sphere={sphere.code}
            selected={filter.sphere === sphere.code}
            onPress={() => onFilter({ ...filter, sphere: filter.sphere === sphere.code ? null : sphere.code })}
          />
        ))}
      </ScrollView>
      {deckListFiltered(filter) ? <Text testID={`${testIDPrefix}-count`} className="mt-2 text-label text-muted">{`${shown} of ${total} decks`}</Text> : null}
    </View>
  );
}
