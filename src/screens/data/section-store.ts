// user.db `settings` key "sections": which of the screens' sections the viewer folded (fold-state.ts). Read when a screen
// mounts, written on each change.
import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { parseSections, withFolded, type Sections } from "../kit/fold-state";
import { settings, type StoredJson } from "./user-schema";

type Db<TRun> = BaseSQLiteDatabase<"sync", TRun>;

const KEY = "sections";

/** The stored fold map; empty when the row is absent or does not read. */
export function readSections<TRun>(user: Db<TRun>): Sections {
  try {
    return parseSections(user.select({ value: settings.value }).from(settings).where(eq(settings.key, KEY)).get()?.value);
  } catch {
    return {};
  }
}

/** Sets one section and returns the map as stored. */
export function writeSection<TRun>(user: Db<TRun>, id: string, folded: boolean, defaultFolded: boolean): Sections {
  const next = withFolded(readSections(user), id, folded, defaultFolded);
  const json = next as unknown as StoredJson;
  user.insert(settings).values({ key: KEY, value: json }).onConflictDoUpdate({ target: settings.key, set: { value: json } }).run();
  return next;
}
