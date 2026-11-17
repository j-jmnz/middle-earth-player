// The version on offer, read by the ribbon, Settings and the table menu (src/ui/update-offer.ts holds the rules).
import Constants from "expo-constants";
import { useStore } from "zustand";

import { tableSettings } from "../../ui/table-settings";
import { offerOf, updateStore } from "../../ui/update-offer";

/** The running app's version, as Settings shows it. */
export const APP_VERSION: string = Constants.expoConfig?.version ?? "unknown";

/** The version on offer, or null: subscribed narrowly, a string or null, so a check that finds nothing new draws nothing again. */
export function useUpdateOffer(): string | null {
  const enabled = useStore(tableSettings, (state) => state.settings.checkUpdates);
  return useStore(updateStore, (state) => offerOf(state.stored, APP_VERSION, enabled));
}
