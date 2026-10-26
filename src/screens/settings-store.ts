// user.db `settings`: the table's settings as one JSON row (key "table"). Read once when the databases open, written on
// each change; src/play/table-settings.ts holds them while the app runs.
import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { parseSettings, tableSettings, type TableSettings } from "../play/table-settings";
import { settings, type StoredJson } from "./user-schema";

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

/** Loads the table settings into the app's store and writes every later change back. Returns the unsubscribe. */
export function bindTableSettings<TRun>(user: Db<TRun>): () => void {
  tableSettings.getState().hydrate(readTableSettings(user));
  return tableSettings.subscribe((state, previous) => {
    if (state.settings !== previous.settings) writeTableSettings(user, state.settings);
  });
}
