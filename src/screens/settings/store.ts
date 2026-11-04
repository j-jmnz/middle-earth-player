// user.db `settings`: the table's settings as one JSON row (key "table"). Read once when the databases open, written on
// each change; src/ui/table-settings.ts holds them while the app runs.
import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { parseSettings, tableSettings, type TableSettings } from "../../ui/table-settings";
import { settings, type StoredJson } from "../data/user-schema";

type Db<TRun> = BaseSQLiteDatabase<"sync", TRun>;

const TABLE_KEY = "table";

/** The stored table settings, defaulted where a key is missing or the row is absent. */
export function readTableSettings<TRun>(user: Db<TRun>): TableSettings {
  const row = user.select({ value: settings.value }).from(settings).where(eq(settings.key, TABLE_KEY)).get();
  return parseSettings(row?.value ?? null);
}

export function writeTableSettings<TRun>(user: Db<TRun>, value: TableSettings): void {
  const json = value as unknown as StoredJson;
  user.insert(settings).values({ key: TABLE_KEY, value: json }).onConflictDoUpdate({ target: settings.key, set: { value: json } }).run();
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
