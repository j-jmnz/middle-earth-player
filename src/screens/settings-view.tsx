// The Settings tab (docs/plans/settings-theme-and-ui-scale.md; user request, 2026-10-28): the app's settings on one page, grouped
// by topic, no sub-menus. Every change applies at once and is saved by bindTableSettings; the page itself reflows when the scale
// or the theme changes, which is the feedback. Restore defaults asks twice, in place, as Delete does (keep-or-delete.tsx).
import Constants from "expo-constants";
import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useStore } from "zustand";

import { BodyText, Label, Screen, ScreenScroll, ScreenTitle, Section, Segmented, SettingSwitch, TextButton } from "./chrome";
import { cardNames } from "./card-names";
import { useDatabases } from "./databases";
import { CATALOG_VERSION } from "../catalog/version";
import { EFFECTS } from "../effects";
import { REDUCE_MOTION_OPTIONS, restoreDefaults, tableSettings, THEME_OPTIONS, UI_SCALE_OPTIONS } from "../play/table-settings";
import { SPEEDS } from "../play/motion-tokens";
import { alwaysCodes, alwaysRows, AWAKE_LINE, CONTRAST_LINE, CREDITS, GUIDE_LINE, HAPTICS_LINE, NONE_YET, REDUCE_MOTION_LINE, REDUCE_MOTION_WORDS, SCALE_LINE, SCALE_WORDS, SPEED_LINE, SPEED_WORDS, SPOTLIGHT_LINE, STOPS_LINE, THEME_LINE, THEME_WORDS } from "../play/settings-words";
import { useUiScale } from "../play/ui-scale";

type Change = Parameters<ReturnType<typeof tableSettings.getState>["update"]>[0];
const change = (next: Change) => tableSettings.getState().update(next);

// A choice row: its name and what it does over the control, which keeps the full width so three words fit at Large.
function Choice({ title, detail, children, testID }: { title: string; detail?: string; children: ReactNode; testID: string }) {
  const s = useUiScale();
  return (
    <View testID={testID} className="min-h-touch" style={{ paddingVertical: 6 * s, gap: 6 * s }}>
      <View>
        <BodyText>{title}</BodyText>
        {detail ? <Label>{detail}</Label> : null}
      </View>
      {children}
    </View>
  );
}

function Group({ title, testID, children }: { title: string; testID: string; children: ReactNode }) {
  const s = useUiScale();
  return (
    <View testID={testID} style={{ marginTop: 20 * s }}>
      <Section title={title} />
      <View style={{ gap: 4 * s }}>{children}</View>
    </View>
  );
}

export function SettingsView() {
  const s = useUiScale();
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
      <View className="pt-4">
        <ScreenTitle>Settings</ScreenTitle>
      </View>
      <ScreenScroll top={8} bottom={32} testID="app-settings-scroll" scrollRef={scroll}>
        <Group title="Display" testID="app-settings-display">
          <Choice title="Theme" detail={THEME_LINE} testID="app-settings-theme">
            <Segmented options={THEME_OPTIONS} value={settings.theme} onChange={(theme) => change({ theme })} testIDPrefix="app-settings-theme" stretch words={THEME_WORDS} />
          </Choice>
          <Choice title="UI scale" detail={SCALE_LINE} testID="app-settings-scale">
            <Segmented options={UI_SCALE_OPTIONS} value={settings.uiScale} onChange={(uiScale) => change({ uiScale })} testIDPrefix="app-settings-scale" stretch words={SCALE_WORDS} />
          </Choice>
          <SettingSwitch roomy label="Strong outlines" detail={CONTRAST_LINE} value={settings.highContrast} onChange={(highContrast) => change({ highContrast })} testID="app-settings-contrast" />
        </Group>

        <Group title="Motion and feel" testID="app-settings-motion">
          <Choice title="Animation speed" detail={SPEED_LINE} testID="app-settings-speed">
            <Segmented options={SPEEDS} value={settings.animationSpeed} onChange={(animationSpeed) => change({ animationSpeed })} testIDPrefix="app-settings-speed" stretch words={SPEED_WORDS} />
          </Choice>
          <Choice title="Reduce motion" detail={REDUCE_MOTION_LINE} testID="app-settings-reduce-motion">
            <Segmented options={REDUCE_MOTION_OPTIONS} value={settings.reduceMotion} onChange={(reduceMotion) => change({ reduceMotion })} testIDPrefix="app-settings-reduce-motion" stretch words={REDUCE_MOTION_WORDS} />
          </Choice>
          <SettingSwitch roomy label="Combat spotlight" detail={SPOTLIGHT_LINE} value={settings.spotlight} onChange={(spotlight) => change({ spotlight })} testID="app-settings-spotlight" />
          <SettingSwitch roomy label="Haptics" detail={HAPTICS_LINE} value={settings.haptics} onChange={(haptics) => change({ haptics })} testID="app-settings-haptics" />
        </Group>

        <Group title="At the table" testID="app-settings-table">
          <SettingSwitch roomy label="First-game guide" detail={GUIDE_LINE} value={settings.guide} onChange={(guide) => change({ guide, ...(guide ? { guideSeen: {} } : {}) })} testID="app-settings-guide" />
          <SettingSwitch roomy label="Stops on" detail={STOPS_LINE} value={settings.stopsOn} onChange={(stopsOn) => change({ stopsOn })} testID="app-settings-stops" />
          <SettingSwitch roomy label="Keep screen awake" detail={AWAKE_LINE} value={settings.keepAwake} onChange={(keepAwake) => change({ keepAwake })} testID="app-settings-awake" />
          <Choice title="Responses used every time" detail={always.length > 0 ? "Tap one to have the table ask again." : undefined} testID="app-settings-always">
            {always.length === 0 ? <Label testID="app-settings-always-none">{NONE_YET}</Label> : null}
            <View className="-mx-3 items-start">
              {always.map((row) => (
                <TextButton key={row.effectId} label={row.label} accessibilityLabel={`Ask again: ${row.label}`} tone="gold" testID={`app-settings-always-${row.effectId}`} onPress={() => change({ alwaysUse: settings.alwaysUse.filter((id) => id !== row.effectId) })} />
              ))}
            </View>
          </Choice>
        </Group>

        <Group title="About" testID="app-settings-about">
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
        </Group>
      </ScreenScroll>
    </Screen>
  );
}
