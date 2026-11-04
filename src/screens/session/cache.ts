// The sessions the table has opened, kept so the Resolution (and the outcome screen) of a game just played does not replay it again.
// An entry is the session as `openTable` built it, valid for one exact save: its fingerprint is the whole save as JSON (the log, the
// loadout, the seed, every intent) with the catalog version, so an Undo followed by a new intent, a new deal on the same save id,
// a log edit or a data change all miss. A session holds only immutable values (the reducer's state, the world, the facts); each
// table builds its own store from it, so sharing one is safe. At most SESSIONS_KEPT ids are kept, the last used first out.

export const SESSIONS_KEPT = 3;

/** What a playing table stands for: the fingerprint and the session of the save as it was last written. */
export type Following<S> = () => { fingerprint: string; session: S };

export type SessionCache<S> = {
  /** The session opened for exactly this save, or null. */
  get: (id: string, fingerprint: string) => S | null;
  /** Keeps a session just replayed. */
  set: (id: string, fingerprint: string, session: S) => void;
  /**
   * A table is playing `id`: asked for the id later, the cache reads the table's current game instead of replaying the save the
   * table wrote. The fingerprint is computed only at that ask, never per intent.
   */
  follow: (id: string, now: Following<S>) => void;
  size: () => number;
};

type Slot<S> = { entry: { fingerprint: string; session: S } | null; following: Following<S> | null };

export function createSessionCache<S>(kept: number = SESSIONS_KEPT): SessionCache<S> {
  // A Map keeps insertion order: the first key is the least recently used.
  const slots = new Map<string, Slot<S>>();
  const touch = (id: string): Slot<S> => {
    const slot = slots.get(id) ?? { entry: null, following: null };
    slots.delete(id);
    slots.set(id, slot);
    for (const old of slots.keys()) {
      if (slots.size <= kept) break;
      slots.delete(old);
    }
    return slot;
  };
  return {
    get: (id, fingerprint) => {
      const slot = slots.get(id);
      if (!slot) return null;
      if (slot.entry?.fingerprint === fingerprint) {
        touch(id);
        return slot.entry.session;
      }
      const now = slot.following?.();
      if (now?.fingerprint !== fingerprint) return null;
      slot.entry = { fingerprint, session: now.session };
      touch(id);
      return now.session;
    },
    set: (id, fingerprint, session) => {
      touch(id).entry = { fingerprint, session };
    },
    follow: (id, now) => {
      touch(id).following = now;
    },
    size: () => slots.size,
  };
}

// One cache for each user database and kind of session (a test opens several databases; a save id and a game id are
// different namespaces), in a WeakMap so a closed handle takes its sessions with it.
const caches = new WeakMap<object, Map<string, SessionCache<unknown>>>();

export function sessionCacheOf<S>(owner: object, kind: "save" | "standalone"): SessionCache<S> {
  let kinds = caches.get(owner);
  if (!kinds) {
    kinds = new Map();
    caches.set(owner, kinds);
  }
  let cache = kinds.get(kind);
  if (!cache) {
    cache = createSessionCache<unknown>();
    kinds.set(kind, cache);
  }
  return cache as SessionCache<S>;
}

/** The save (or standalone game) as one string: equal strings mean the same replay. */
export function fingerprintOf(holder: unknown, catalogVersion: number): string {
  return `${catalogVersion}|${JSON.stringify(holder)}`;
}
