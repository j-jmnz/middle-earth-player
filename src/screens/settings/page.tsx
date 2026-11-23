// One category's page of Settings (docs/design-system.md, Settings): its note when it has one, then its rows, the same rows the search and
// the table's panel draw. About is its own page (about.tsx); Saves is the page it is handed (`saves`: phone-saves.native.tsx, or web/backup-group.tsx on the web and the desktop).
import type { ComponentRef, ReactNode, RefObject } from "react";
import { ScrollView, View } from "react-native";

import { Label } from "../kit/chrome";
import { SettingRows } from "../../play/chrome/setting-row";
import { categoryOf, rowsFor, type CategoryId } from "../../play/chrome/settings-catalog";
import { SETTINGS_PLATFORM } from "../../play/chrome/settings-platform";
import type { AlwaysRow } from "../../play/chrome/settings-words";
import type { TableSettings } from "../../ui/table-settings";
import { useUiScale } from "../../ui/ui-scale";
import { AboutPage } from "./about";

export function CategoryPage({
  id,
  settings,
  always,
  onChange,
  saves,
  scrollRef,
}: {
  id: CategoryId;
  settings: TableSettings;
  always: readonly AlwaysRow[];
  onChange: (change: Partial<TableSettings>) => void;
  saves?: ReactNode;
  scrollRef: RefObject<ComponentRef<typeof ScrollView> | null>;
}) {
  const s = useUiScale();
  const category = categoryOf(id);
  if (id === "about") return <AboutPage settings={settings} onChange={onChange} scrollRef={scrollRef} />;
  return (
    <View testID={`app-settings-page-${id}`} style={{ gap: 4 * s }}>
      {category.note ? (
        <Label testID={`app-settings-page-${id}-note`} className="pb-1">
          {category.note}
        </Label>
      ) : null}
      {id === "saves" ? saves : <SettingRows rows={rowsFor(category.rows, SETTINGS_PLATFORM)} settings={settings} onChange={onChange} always={always} testPrefix="app-settings" />}
    </View>
  );
}
