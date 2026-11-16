// The table settings' store on the web and the desktop (store.ts is the phone's, unchanged; metro.config.js serves this file in its place on the web platform only, and it
// imports the phone's without the file extension). The desktop build starts a profile that has stored no interface size at the step its window suits (default-scale.ts);
// every other read, and the write, are the phone's.
import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { Dimensions } from "react-native";

import { defaultUiScale, hasStoredScale } from "./default-scale";
import { readTableSettings as readPhoneSettings, writeTableSettings } from "./store";
import { parseSettings, tableSettings, type TableSettings } from "../../ui/table-settings";
import { settings } from "../data/user-schema";
import { desktopBuild } from "../nav/desktop";

export { writeTableSettings };

type Db<TRun> = BaseSQLiteDatabase<"sync", TRun>;

const TABLE_KEY = "table";

/** The stored table settings, defaulted where a key is missing or the row is absent; the interface size by the window where none is stored (the desktop build). */
export function readTableSettings<TRun>(user: Db<TRun>): TableSettings {
  if (!desktopBuild()) return readPhoneSettings(user);
  const stored: unknown = user.select({ value: settings.value }).from(settings).where(eq(settings.key, TABLE_KEY)).get()?.value ?? null;
  const read = parseSettings(stored);
  if (hasStoredScale(stored)) return read;
  const { width, height } = Dimensions.get("window");
  return { ...read, uiScale: defaultUiScale(width, height) };
}

/**
 * Loads the table settings into the app's store and writes every later change back. Returns the unsubscribe. A row that
 * cannot be read leaves the defaults in place and is still written over by the next change, so a change is never lost
 * quietly; `warn` hears each failure.
 */
export function bindTableSettings<TRun>(user: Db<TRun>, warn: (message: string) => void): () => void {
  try {
    tableSettings.getState().hydrate(readTableSettings(user));
  } catch (error: unknown) {
    warn(`Table settings did not load (${error instanceof Error ? error.message : "unknown error"}); the defaults are used and the next change is saved over them`);
  }
  return tableSettings.subscribe((state, previous) => {
    if (state.settings === previous.settings) return;
    try {
      writeTableSettings(user, state.settings);
    } catch (error: unknown) {
      warn(`Table settings were not saved (${error instanceof Error ? error.message : "unknown error"})`);
    }
  });
}
