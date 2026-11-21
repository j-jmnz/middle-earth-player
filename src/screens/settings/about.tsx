// Settings' About page (docs/design-system.md, Settings): the app and card data versions, a later release while one is offered, Check for new
// versions with Check now, Debug tools, the credits, Privacy policy, Support, and Restore defaults, which asks twice, in place, as Delete does
// (ask-in-place.tsx). The question is the last thing on the page, so the page's scroll moves fully above the dock while it asks.
import { useEffect, useState, type ComponentRef, type RefObject } from "react";
import { ScrollView, View } from "react-native";
import { useStore } from "zustand";

import { BodyText, Label, TextButton } from "../kit/chrome";
import { AskInPlace } from "../kit/ask-in-place";
import { CATALOG_VERSION } from "../../catalog/version";
import { SettingRow } from "../../play/chrome/setting-rows";
import { CREDITS } from "../../play/chrome/settings-words";
import { restoreDefaults, tableSettings, type TableSettings } from "../../ui/table-settings";
import { useUiScale } from "../../ui/ui-scale";
import { CHECK_NOW_HINT, CHECK_NOW_LABEL, checksFor, manualLine, offerLinkLabel, offerOf, OFFER_LINK_HINT, offerTitle, releasedLine, updateStore } from "../../ui/update/offer";
import { checkNow } from "../update/check";
import { APP_VERSION, useUpdateOffer } from "../update/offer";
import { openPrivacyPolicy, openReleasePage, openSupport } from "./links";

type Change = Partial<TableSettings>;

/** The later release Check now or the daily check found, or null: the line under About in the category list says it too. */
export function useShownOffer() {
  // The offer stays here after the ribbon is closed (src/ui/update/offer.ts). Check now's answer shows its offer even with the switch off: the player asked.
  const asked = useStore(updateStore, (state) => (state.manual === "answered" ? offerOf(state.stored, APP_VERSION, true) : null));
  return useUpdateOffer() ?? asked;
}

export function AboutPage({ settings, onChange, scrollRef }: { settings: TableSettings; onChange: (change: Change) => void; scrollRef: RefObject<ComponentRef<typeof ScrollView> | null> }) {
  const s = useUiScale();
  const [confirming, setConfirming] = useState(false);
  // Asking is the last thing on the page: scroll it fully above the dock, where Restore and Keep can be reached.
  useEffect(() => {
    if (!confirming) return;
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
    return () => clearTimeout(id);
  }, [confirming, scrollRef]);
  const manual = useStore(updateStore, (state) => state.manual);
  const offer = useShownOffer();
  const checkLine = manualLine(manual, offer, checksFor(APP_VERSION));
  const released = useStore(updateStore, (state) => releasedLine(state.stored.latest?.publishedAt ?? null));
  return (
    <View testID="app-settings-about" style={{ gap: 4 * s }}>
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
      <SettingRow id="checkUpdates" settings={settings} onChange={onChange} always={[]} testPrefix="app-settings" />
      {checksFor(APP_VERSION) ? (
        <View className="-mx-3 items-start">
          <TextButton label={CHECK_NOW_LABEL} tone="accent" testID="app-settings-check-now" accessibilityHint={CHECK_NOW_HINT} disabled={manual === "checking"} onPress={checkNow} />
        </View>
      ) : null}
      {checkLine ? (
        <Label className="pb-2" testID="app-settings-check-line">
          {checkLine}
        </Label>
      ) : null}
      <SettingRow id="debugTools" settings={settings} onChange={onChange} always={[]} testPrefix="app-settings" />
      <Label className="pb-2" testID="app-settings-credits">
        {CREDITS}
      </Label>
      <View className="-mx-3 items-start">
        <TextButton label="Privacy policy" tone="accent" testID="app-settings-privacy" accessibilityHint="Opens the privacy policy in your browser" onPress={openPrivacyPolicy} />
        <TextButton label="Support" tone="accent" testID="app-settings-support" accessibilityHint="Opens how to support the app in your browser" onPress={openSupport} />
      </View>
      {confirming ? (
        <AskInPlace
          testID="app-settings-restore-ask"
          sentence="Put every setting back to its default? Your games, decks and collection are not touched."
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
    </View>
  );
}
