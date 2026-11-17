// The table settings' store on the web and the desktop (store.ts is the phone's, unchanged; metro.config.js serves this file in its place on the web platform only, and it
// imports the phone's without the file extension). The desktop build starts a profile that has stored no interface size at the step its window suits (default-scale.ts)
// and stores that step once, so later launches open at it whatever their window; every other read, and the write, are the phone's.
import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { Dimensions } from "react-native";

import { defaultUiScale, hasStoredScale } from "./default-scale";
import { bindTableSettings as bindPhoneSettings, readTableSettings as readPhoneSettings, writeTableSettings } from "./store";
import { parseSettings, tableSettings, type TableSettings, type UiScaleOption } from "../../ui/table-settings";
import { settings } from "../data/user-schema";
import { desktopBuild } from "../nav/desktop";

export { writeTableSettings };

type Db<TRun> = BaseSQLiteDatabase<"sync", TRun>;

const TABLE_KEY = "table";

function storedRow<TRun>(user: Db<TRun>): unknown {
  return user.select({ value: settings.value }).from(settings).where(eq(settings.key, TABLE_KEY)).get()?.value ?? null;
}

// The step the window suits, when this is the desktop build and the profile has stored none; null otherwise.
function firstLaunchScale<TRun>(user: Db<TRun>): UiScaleOption | null {
  if (!desktopBuild() || hasStoredScale(storedRow(user))) return null;
  const { width, height } = Dimensions.get("window");
  return defaultUiScale(width, height);
}

/** The stored table settings, defaulted where a key is missing or the row is absent; the interface size by the window where none is stored (the desktop build). */
export function readTableSettings<TRun>(user: Db<TRun>): TableSettings {
  if (!desktopBuild()) return readPhoneSettings(user);
  const read = parseSettings(storedRow(user));
  const scale = firstLaunchScale(user);
  return scale ? { ...read, uiScale: scale } : read;
}

/**
 * The phone's binding (store.ts: load, then write every change back), and on the desktop's first launch the window's interface size, set through the store so the
 * binding stores it. Returns the unsubscribe.
 */
export function bindTableSettings<TRun>(user: Db<TRun>, warn: (message: string) => void): () => void {
  const unbind = bindPhoneSettings(user, warn);
  const scale = readScale(user, warn);
  if (scale) tableSettings.getState().update({ uiScale: scale });
  return unbind;
}

function readScale<TRun>(user: Db<TRun>, warn: (message: string) => void): UiScaleOption | null {
  try {
    return firstLaunchScale(user);
  } catch (error: unknown) {
    warn(`The interface size for this window was not set (${error instanceof Error ? error.message : "unknown error"})`);
    return null;
  }
}
