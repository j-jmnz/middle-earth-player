// user.db `settings` key "sections": which of the screens' sections the viewer folded (fold-state.ts). Read when a screen
// mounts, written on each change.
import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { parseSections, withAllFolded, withFolded, type Sections } from "../kit/fold-state";
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

function store<TRun>(user: Db<TRun>, next: Sections): Sections {
  const json = next as unknown as StoredJson;
  user.insert(settings).values({ key: KEY, value: json }).onConflictDoUpdate({ target: settings.key, set: { value: json } }).run();
  return next;
}

/** Sets one section and returns the map as stored. */
export function writeSection<TRun>(user: Db<TRun>, id: string, folded: boolean, defaultFolded: boolean): Sections {
  return store(user, withFolded(readSections(user), id, folded, defaultFolded));
}

/** Sets every one of `ids` at once (Collapse all, Expand all) in one write and returns the map as stored. */
export function writeSections<TRun>(user: Db<TRun>, ids: readonly { id: string; defaultFolded: boolean }[], folded: boolean): Sections {
  return store(user, withAllFolded(readSections(user), ids, folded));
}
