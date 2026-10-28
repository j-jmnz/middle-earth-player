// The Settings tab (docs/plans/settings-theme-and-ui-scale.md; user request, 2026-10-28): the app's settings on one page, grouped
// by topic, no sub-menus. Every change applies at once and is saved by bindTableSettings; the page itself reflows when the scale
// or the theme changes, which is the feedback. Restore defaults asks twice, in place, as Delete does (keep-or-delete.tsx).
import Constants from "expo-constants";
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useStore } from "zustand";

import { BodyText, Label, NavBar, Screen, ScreenScroll, ScreenTitle, TextButton } from "./chrome";
import { cardNames } from "./card-names";
import { useDatabases } from "./databases";
import { CATALOG_VERSION } from "../catalog/version";
import { EFFECTS } from "../effects";
import { SettingGroup, SettingsRows } from "../play/setting-rows";
import { restoreDefaults, tableSettings } from "../play/table-settings";
import { alwaysCodes, alwaysRows, CREDITS } from "../play/settings-words";
import { useUiScale } from "../play/ui-scale";

type Change = Parameters<ReturnType<typeof tableSettings.getState>["update"]>[0];
const change = (next: Change) => tableSettings.getState().update(next);

// `fromTable` is set when the table's All settings opened the page (route param `from=table`): the page then carries a Back to the table,
// since the table is landscape-only and the tab bar's own way back is not there. The tab, opened from the dock, has none.
export function SettingsView({ fromTable = false }: { fromTable?: boolean }) {
  const s = useUiScale();
  const router = useRouter();
  const settings = useStore(tableSettings, (state) => state.settings);
  const { catalog } = useDatabases();
  const [confirming, setConfirming] = useState(false);
  const codes = useMemo(() => alwaysCodes(settings.alwaysUse, EFFECTS), [settings.alwaysUse]);
  const names = useMemo(() => cardNames(catalog, codes), [catalog, codes]);
  const always = alwaysRows(settings.alwaysUse, EFFECTS, (code) => names.get(code));
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  // Asking is the last thing on the page: scroll it fully above the dock, where Restore and Keep can be reached.
  useEffect(() => {
    if (!confirming) return;
    const id = setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 50);
    return () => clearTimeout(id);
  }, [confirming]);
  const appVersion = Constants.expoConfig?.version ?? "unknown";
  return (
    <Screen scene="plain" testID="app-settings">
      {fromTable ? <NavBar onBack={() => router.back()} backTestID="app-settings-back" backLabel="the table" /> : null}
      <View className={fromTable ? "pt-1" : "pt-4"}>
        <ScreenTitle>Settings</ScreenTitle>
      </View>
      <ScreenScroll top={8} bottom={32} testID="app-settings-scroll" scrollRef={scroll}>
        <SettingsRows settings={settings} onChange={change} always={always} testPrefix="app-settings" stops />

        <SettingGroup title="About" testID="app-settings-about">
          <View style={{ paddingVertical: 6 * s }}>
            <BodyText testID="app-settings-version">{`App version ${appVersion}`}</BodyText>
            <Label testID="app-settings-catalog">{`Card data version ${CATALOG_VERSION}`}</Label>
          </View>
          <Label className="pb-2" testID="app-settings-credits">
            {CREDITS}
          </Label>
          {confirming ? (
            <View testID="app-settings-restore-ask" className="gap-1">
              <BodyText tone="danger">Put every setting back to its default? Your games and decks are not touched.</BodyText>
              <View className="-mx-3 flex-row">
                <TextButton
                  label="Restore"
                  tone="danger"
                  testID="app-settings-restore-confirm"
                  accessibilityLabel="Restore every setting to its default"
                  onPress={() => {
                    tableSettings.getState().hydrate(restoreDefaults(tableSettings.getState().settings));
                    setConfirming(false);
                  }}
                />
                <TextButton label="Keep" testID="app-settings-restore-keep" accessibilityLabel="Keep my settings" onPress={() => setConfirming(false)} />
              </View>
            </View>
          ) : (
            <View className="-mx-3 items-start">
              <TextButton label="Restore defaults" tone="muted" testID="app-settings-restore" onPress={() => setConfirming(true)} />
            </View>
          )}
        </SettingGroup>
      </ScreenScroll>
    </Screen>
  );
}
