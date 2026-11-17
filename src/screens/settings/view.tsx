// The Settings screen (docs/design-system.md, Settings; user request, 2026-10-28): the app's settings on one page, grouped
// by topic, no sub-menus. Every change applies at once and is saved by bindTableSettings; the page itself reflows when the scale
// or the theme changes, which is the feedback. Restore defaults asks twice, in place, as Delete does (ask-in-place.tsx).
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useStore } from "zustand";

import { BodyText, Column, IconButton, Label, Screen, ScreenScroll, ScreenTitle, SettingSwitch, TextButton } from "../kit/chrome";
import { AskInPlace } from "../kit/ask-in-place";
import { goBack } from "../nav/go-back";
import { cardNames } from "../data/card-names";
import { useDatabases } from "../data/databases";
import { CATALOG_VERSION } from "../../catalog/version";
import { EFFECTS } from "../../effects";
import { SettingGroup, SettingsRows } from "../../play/chrome/setting-rows";
import { restoreDefaults, tableSettings } from "../../ui/table-settings";
import { alwaysCodes, alwaysRows, CREDITS } from "../../play/chrome/settings-words";
import { useUiScale } from "../../ui/ui-scale";
import { useSplitColumns } from "../nav/use-split-columns";
import { CHECK_LABEL, CHECK_LINE, OFFER_LINK_HINT, offerLinkLabel, offerTitle, releasedLine, updateStore } from "../../ui/update/offer";
import { APP_VERSION, useUpdateOffer } from "../update/offer";
import { openPrivacyPolicy, openReleasePage, openSupport } from "./links";

type Change = Parameters<ReturnType<typeof tableSettings.getState>["update"]>[0];
const change = (next: Change) => tableSettings.getState().update(next);

// A pushed screen with Back beside its title (docs/design-system.md, Navigation): to the hub whose gear opened it, or, when `fromTable` is
// set (route param `from=table`, the table's All settings), to the table.
export function SettingsView({ fromTable = false }: { fromTable?: boolean }) {
  const s = useUiScale();
  const { size, equal, measure } = useSplitColumns(null);
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
  // The offer stays here after the ribbon is closed (src/ui/update/offer.ts): its line, the release date and Get it.
  const offer = useUpdateOffer();
  const released = useStore(updateStore, (state) => releasedLine(state.stored.latest?.publishedAt ?? null));
  const about = (
    <SettingGroup title="About" testID="app-settings-about">
      <View style={{ paddingVertical: 6 * s }}>
        <BodyText testID="app-settings-version">{`App version ${APP_VERSION}`}</BodyText>
        <Label testID="app-settings-catalog">{`Card data version ${CATALOG_VERSION}`}</Label>
      </View>
      {offer ? (
        <View testID="app-settings-update" style={{ paddingVertical: 6 * s }}>
          <BodyText>{offerTitle(offer)}</BodyText>
          <Label>{released ? `${released}. Install it over this one; your saves stay.` : "Install it over this one; your saves stay."}</Label>
          <View className="-mx-3 items-start">
            <TextButton label="Get it" tone="accent" testID="app-settings-update-get" accessibilityLabel={offerLinkLabel(offer)} accessibilityHint={OFFER_LINK_HINT} onPress={() => openReleasePage(offer)} />
          </View>
        </View>
      ) : null}
      <SettingSwitch roomy label={CHECK_LABEL} detail={CHECK_LINE} value={settings.checkUpdates} onChange={(checkUpdates) => change({ checkUpdates })} testID="app-settings-check-updates" />
      <Label className="pb-2" testID="app-settings-credits">
        {CREDITS}
      </Label>
      <View className="-mx-3 items-start">
        <TextButton
          label="Privacy policy"
          tone="accent"
          testID="app-settings-privacy"
          accessibilityHint="Opens the privacy policy in your browser"
          onPress={openPrivacyPolicy}
        />
        <TextButton
          label="Support"
          tone="accent"
          testID="app-settings-support"
          accessibilityHint="Opens how to support the app in your browser"
          onPress={openSupport}
        />
      </View>
      {confirming ? (
        <AskInPlace
          testID="app-settings-restore-ask"
          sentence="Put every setting back to its default? Your games and decks are not touched."
          confirm={{
            label: "Restore",
            testID: "app-settings-restore-confirm",
            accessibilityLabel: "Restore every setting to its default",
            onPress: () => {
              tableSettings.getState().hydrate(restoreDefaults(tableSettings.getState().settings));
              setConfirming(false);
            },
          }}
          keep={{ testID: "app-settings-restore-keep", accessibilityLabel: "Keep my settings", onPress: () => setConfirming(false) }}
        />
      ) : (
        <View className="-mx-3 items-start">
          <TextButton label="Restore defaults" tone="muted" testID="app-settings-restore" onPress={() => setConfirming(true)} />
        </View>
      )}
    </SettingGroup>
  );
  return (
    <Screen scene="calm" testID="app-settings">
      <Column max={equal ? "wide" : "readable"}>
        <View className="flex-row items-center gap-3 pb-1 pt-2">
          <IconButton chevron testID="app-settings-back" label={fromTable ? "Back to the table" : "Back"} onPress={() => goBack(router, "/")} />
          <ScreenTitle>Settings</ScreenTitle>
        </View>
      </Column>
      <ScreenScroll top={8} bottom={32} testID="app-settings-scroll" scrollRef={scroll} max={size === "expanded" ? "wide" : "readable"}>
        {size === "expanded" ? <View style={{ height: 0 }} onLayout={measure} /> : null}
        {equal ? (
          // Two columns of groups (docs/design-system.md, Tablets): what you see and how hard the phone works, then how the game moves,
          // what the table does and the page's own facts.
          <View className="flex-row items-start" style={{ gap: equal.gap }} testID="app-settings-columns">
            <View className="flex-1">
              <SettingsRows settings={settings} onChange={change} always={always} testPrefix="app-settings" groups={["display", "performance"]} />
            </View>
            <View className="flex-1">
              <SettingsRows settings={settings} onChange={change} always={always} testPrefix="app-settings" groups={["motion", "table"]} stops />
              {about}
            </View>
          </View>
        ) : (
          <Column>
            <SettingsRows settings={settings} onChange={change} always={always} testPrefix="app-settings" stops />
            {about}
          </Column>
        )}
      </ScreenScroll>
    </Screen>
  );
}
