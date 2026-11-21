// The first page of Settings (docs/design-system.md, Settings; user decision, 2026-11-21): the categories, each with what it is set to now,
// the quick setups, and the search's results in their place while a query is typed. The categories, the search and the setups are
// settings-catalog.ts; the rows are setting-row.tsx.
import { View } from "react-native";

import { BodyText, Label, ListRow, Section, TextButton } from "../kit/chrome";
import { SettingRow } from "../../play/chrome/setting-row";
import { categoriesFor, categoryOf, categorySummary, quickSetups, searchSettings, setupInUse, type CategoryId, type QuickSetup } from "../../play/chrome/settings-catalog";
import { SETTINGS_PLATFORM } from "../../play/chrome/settings-platform";
import type { AlwaysRow } from "../../play/chrome/settings-words";
import { announce } from "../../ui/announce";
import { tableSettings, type TableSettings } from "../../ui/table-settings";
import { useUiScale } from "../../ui/ui-scale";

type Change = Partial<TableSettings>;

/**
 * The categories as list rows, each with its current values under its name; About's line is `aboutLine` (the version, or the release
 * offered). In a list-detail pane `picked` marks the open category (null while the search's results fill the detail); undefined outside one.
 */
export function CategoryList({ settings, aboutLine, picked, onOpen }: { settings: TableSettings; aboutLine: string; picked?: CategoryId | null; onOpen: (id: CategoryId) => void }) {
  return (
    <View testID="app-settings-categories">
      {categoriesFor(SETTINGS_PLATFORM).map((category) => (
        <ListRow
          key={category.id}
          testID={`app-settings-open-${category.id}`}
          label={category.title}
          detail={category.id === "about" ? aboutLine : categorySummary(category.id, settings, SETTINGS_PLATFORM)}
          selected={picked === undefined ? undefined : picked === category.id}
          onPress={() => onOpen(category.id)}
        />
      ))}
    </View>
  );
}

function SetupRow({ setup, settings, onChange }: { setup: QuickSetup; settings: TableSettings; onChange: (change: Change) => void }) {
  const s = useUiScale();
  const inUse = setupInUse(settings, setup);
  return (
    <View testID={`app-settings-setup-${setup.id}`} className="min-h-touch flex-row items-center" style={{ gap: 12 * s, paddingVertical: 6 * s }}>
      <View className="min-w-0 flex-1">
        <BodyText className="font-semibold">{setup.title}</BodyText>
        <Label>{setup.line}</Label>
      </View>
      {inUse ? (
        <Label testID={`app-settings-setup-${setup.id}-in-use`}>In use</Label>
      ) : (
        <TextButton
          label="Use"
          tone="accent"
          testID={`app-settings-setup-${setup.id}-use`}
          accessibilityLabel={`Use ${setup.title}`}
          onPress={() => {
            onChange(setup.change);
            announce(`${setup.title} is in use. Each setting can still be changed.`);
          }}
        />
      )}
    </View>
  );
}

/** The quick setups: each changes several settings at once and says In use while all of them have its values. */
export function QuickSetups({ settings, onChange }: { settings: TableSettings; onChange: (change: Change) => void }) {
  return (
    <View testID="app-settings-setups" className="mt-4">
      <Section title="Quick setups" />
      <Label className="pb-1">Each changes several settings at once. You can still change each one after.</Label>
      {quickSetups(SETTINGS_PLATFORM).map((setup) => (
        <SetupRow key={setup.id} setup={setup} settings={settings} onChange={onChange} />
      ))}
    </View>
  );
}

/** What a query finds: each setting with its category over it, working in place, then the categories whose names match. */
export function SearchResults({ query, settings, always, onChange, onOpen }: { query: string; settings: TableSettings; always: readonly AlwaysRow[]; onChange: (change: Change) => void; onOpen: (id: CategoryId) => void }) {
  const s = useUiScale();
  const hits = searchSettings(query, SETTINGS_PLATFORM);
  if (hits.length === 0) {
    return (
      <BodyText testID="app-settings-no-match" tone="muted" className="mt-4">
        {`No setting matches “${query.trim()}”.`}
      </BodyText>
    );
  }
  return (
    <View testID="app-settings-results" style={{ gap: 8 * s, paddingTop: 8 * s }}>
      {hits.map((hit) =>
        hit.kind === "setting" ? (
          <View key={hit.id}>
            <Label tone="faint">{`In ${categoryOf(hit.home).title}`}</Label>
            <SettingRow id={hit.id} settings={settings} onChange={onChange} always={always} testPrefix="app-settings" />
          </View>
        ) : (
          <ListRow key={`category-${hit.id}`} testID={`app-settings-found-${hit.id}`} label={`Open ${categoryOf(hit.id).title}`} onPress={() => onOpen(hit.id)} />
        ),
      )}
    </View>
  );
}

/** Changes a setting from any Settings page; the store saves it. */
export const changeSettings = (change: Change) => tableSettings.getState().update(change);
