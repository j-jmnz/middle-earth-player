// The update ribbon (docs/design-system.md, Update ribbon; user request, 2026-11-17): a floating strip at the top of every screen but the table while a
// later release is offered (src/ui/update-offer.ts). It sits above the root stack, in the top safe-area inset, so the screen under it starts below it
// and no Back, gear or title is covered: the screens below hear a top inset of 0 and keep their own TOP_ROOM (src/screens/nav/top-inset.ts). Get it
// opens the release page in the browser; the ✕ closes it until a later version. Settings, About and the table menu still say the offer.
import Constants from "expo-constants";
import { usePathname } from "expo-router";
import { useEffect, type ReactNode } from "react";
import { useWindowDimensions, View } from "react-native";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "zustand";

import { announce } from "../../ui/announce";
import { CrossMark, GlassIconButton, TextButton } from "../../ui/buttons";
import { GameIcon } from "../../ui/game-icon";
import { floatingSurface } from "../../ui/surfaces";
import { tableSettings } from "../../ui/table-settings";
import { Text } from "../../ui/text";
import { useUiScale } from "../../ui/ui-scale";
import { OFFER_LINK_HINT, offerDetail, offerOf, offerTitle, ribbonShows, updateStore } from "../../ui/update-offer";
import { useTableTokens } from "../../ui/use-table-tokens";
import { topInsetOf } from "../nav/top-inset";
import { openReleasePage } from "../settings/links";
import { dismissUpdate } from "./check";
import { ribbonFits } from "./ribbon-place";

/** The running app's version, as Settings shows it. */
export const APP_VERSION: string = Constants.expoConfig?.version ?? "unknown";

/** The version on offer, or null: subscribed narrowly, a string or null, so a check that finds nothing new draws nothing again. */
export function useUpdateOffer(): string | null {
  const enabled = useStore(tableSettings, (state) => state.settings.checkUpdates);
  return useStore(updateStore, (state) => offerOf(state.stored, APP_VERSION, enabled));
}

function UpdateRibbon({ version, top, left, right }: { version: string; top: number; left: number; right: number }) {
  const t = useTableTokens();
  const s = useUiScale();
  const title = offerTitle(version);
  // A screen reader hears the offer once when the ribbon appears; the ribbon is then the first thing it reaches on every screen.
  useEffect(() => {
    announce(title);
  }, [title]);
  return (
    <View testID="update-ribbon" style={{ zIndex: 1, paddingTop: top, paddingLeft: left + 12 * s, paddingRight: right + 12 * s }}>
      <View
        style={{
          alignSelf: "center",
          width: "100%",
          maxWidth: 640 * s,
          minHeight: 60 * s,
          borderRadius: 20 * s,
          flexDirection: "row",
          alignItems: "center",
          gap: 10 * s,
          paddingLeft: 14 * s,
          paddingRight: 6 * s,
          paddingVertical: 8 * s,
          ...floatingSurface(t),
        }}
      >
        <GameIcon name="oneRing" size={22 * s} tint="accent" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text testID="update-ribbon-title" className="font-display text-body text-bone">
            {title}
          </Text>
          <Text className="text-label text-muted">{offerDetail(APP_VERSION)}</Text>
        </View>
        <TextButton label="Get it" tone="accent" testID="update-ribbon-get" accessibilityLabel={`Get version ${version}`} accessibilityHint={OFFER_LINK_HINT} onPress={() => openReleasePage(version)} />
        <GlassIconButton label="Close until the next version" testID="update-ribbon-close" mark={(color) => <CrossMark color={color} />} onPress={() => dismissUpdate(version)} />
      </View>
    </View>
  );
}

/**
 * The root stack's frame: the ribbon, when it shows, above the stack, taking the top safe-area inset, and the stack under it told its top inset is 0.
 * The tree keeps its shape either way (the ribbon's slot is empty, the provider always there), so the stack never remounts when the ribbon comes or goes.
 */
export function UpdateFrame({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const s = useUiScale();
  const path = usePathname();
  const { width, height } = useWindowDimensions();
  const offer = useUpdateOffer();
  const dismissed = useStore(updateStore, (state) => state.stored.dismissed);
  const shown = offer != null && ribbonShows(offer, dismissed) && ribbonFits(path, width, height) ? offer : null;
  const below = shown ? { ...insets, top: 0 } : insets;
  return (
    <View style={{ flex: 1 }}>
      {shown ? <UpdateRibbon version={shown} top={topInsetOf(insets.top, s)} left={insets.left} right={insets.right} /> : null}
      <SafeAreaInsetsContext.Provider value={below}>
        <View style={{ flex: 1 }}>{children}</View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}
