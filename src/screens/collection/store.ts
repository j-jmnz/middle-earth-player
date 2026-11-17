// user.db `settings`, key "collection": the packs the player has switched off, as `{ notOwned: [...] }` (src/catalog/collection.ts).
// No row is everything owned. Read once when the databases open and written on each change; Restore defaults never touches it,
// since it is the player's, like their decks.
import { eq } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import { parseCollection, switchPacks } from "../../catalog/collection";
import { settings, type StoredJson } from "../data/user-schema";

type Db<TRun> = BaseSQLiteDatabase<"sync", TRun>;

const COLLECTION_KEY = "collection";

type CollectionState = {
  // Sorted pack codes; a new array on every change, so a selector can hold it.
  notOwned: readonly string[];
  hydrate: (notOwned: readonly string[]) => void;
  switchPacks: (packs: readonly string[], owned: boolean) => void;
  ownAll: () => void;
  ownNone: (every: readonly string[]) => void;
};

export const collectionStore = createStore<CollectionState>()((set, get) => ({
  notOwned: [],
  hydrate: (notOwned) => set({ notOwned }),
  switchPacks: (packs, owned) => set({ notOwned: switchPacks(get().notOwned, packs, owned) }),
  ownAll: () => set({ notOwned: [] }),
  ownNone: (every) => set({ notOwned: [...new Set(every)].sort() }),
}));

/** The packs switched off. */
export function useNotOwned(): readonly string[] {
  return useStore(collectionStore, (state) => state.notOwned);
}

export function readCollection<TRun>(user: Db<TRun>): string[] {
  const row = user.select({ value: settings.value }).from(settings).where(eq(settings.key, COLLECTION_KEY)).get();
  return parseCollection(row?.value ?? null);
}

export function writeCollection<TRun>(user: Db<TRun>, notOwned: readonly string[]): void {
  const json: StoredJson = { notOwned: [...notOwned] };
  user.insert(settings).values({ key: COLLECTION_KEY, value: json }).onConflictDoUpdate({ target: settings.key, set: { value: json } }).run();
}

/**
 * Loads the collection into its store and writes every later change back. Returns the unsubscribe. A row that cannot be read
 * leaves everything owned and is written over by the next change; `warn` hears each failure.
 */
export function bindCollection<TRun>(user: Db<TRun>, warn: (message: string) => void): () => void {
  try {
    collectionStore.getState().hydrate(readCollection(user));
  } catch (error: unknown) {
    warn(`The collection did not load (${error instanceof Error ? error.message : "unknown error"}); every card counts as owned until the next change is saved`);
  }
  return collectionStore.subscribe((state, previous) => {
    if (state.notOwned === previous.notOwned) return;
    try {
      writeCollection(user, state.notOwned);
    } catch (error: unknown) {
      warn(`The collection was not saved (${error instanceof Error ? error.message : "unknown error"})`);
    }
  });
}
