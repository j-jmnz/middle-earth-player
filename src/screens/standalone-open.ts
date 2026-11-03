// Opens a standalone game for the table and the outcome screen: reads the row, drops an open game played on another engine
// version or other card data (the row and its loadout stay, so it can be dealt again), loads the cards from catalog.db,
// and replays the intents through the reducer (open-game.ts). No log, pool or checklist. A game already opened as it now stands is
// not replayed again (session-cache.ts). Pure of React: the hooks that open it for a screen are in standalone-session.ts.
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { addActive } from "../campaign/replay";
import { isWon, record, unrecord } from "../campaign/session";
import { droppedIfStale, dropStandalone, resumeStandalone, type StandaloneGame } from "../campaign/standalone";
import { loadWorld } from "../campaign/world";
import { CATALOG_VERSION } from "../catalog/version";
import { EFFECTS } from "../effects";
import type { TableStore } from "../play/store";

import { campaignOf, scenarioOf } from "./campaign-data";
import { committingStore, replayForTable, type ReplayedGame } from "./open-game";
import { createPlayClock, type PlayClock } from "./play-clock";
import { fingerprintOf, sessionCacheOf } from "./session-cache";
import { readStandalone, writeStandaloneActive } from "./standalone-store";

type Db<TRun> = BaseSQLiteDatabase<"sync", TRun>;

export type StandaloneSession =
  | ({ ok: true; stored: StandaloneGame } & ReplayedGame)
  | { ok: false; reason: "missing" | "none" | "dropped"; stored: StandaloneGame | null; write: StandaloneGame | null };

/** The codes the game can show: the Ring-bearer and every card of each dealt deck. */
export function standaloneCodes(game: StandaloneGame): string[] {
  const loadout = game.loadout;
  if (!loadout) return [];
  return [...(loadout.ringBearer ? [loadout.ringBearer] : []), ...loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck])];
}

type Opened = Extract<StandaloneSession, { ok: true }>;

/** The session already opened for this game as it now stands (session-cache.ts), or null: nothing is replayed. */
export function cachedStandalone<TUser>(user: Db<TUser>, gameId: string): Opened | null {
  const stored = readStandalone(user, gameId)?.game;
  if (!stored?.active || !stored.loadout) return null;
  return sessionCacheOf<Opened>(user, "standalone").get(stored.id, fingerprintOf(stored, CATALOG_VERSION));
}

/** Reads and replays the open game. It writes nothing: a drop it decides on is returned as `write`. A game already opened as it now stands (session-cache.ts) is not replayed again. */
export function openStandalone<TCatalog, TUser>(catalog: Db<TCatalog>, user: Db<TUser>, gameId: string): StandaloneSession {
  const read = readStandalone(user, gameId);
  if (!read) return { ok: false, reason: "missing", stored: null, write: null };
  const stored = read.game;
  if (!stored.active || !stored.loadout) return { ok: false, reason: read.unreadable ? "dropped" : "none", stored, write: read.unreadable ? stored : null };
  const campaign = campaignOf(stored.campaignId);
  const scenario = scenarioOf(stored.scenarioId);
  const stale = droppedIfStale(stored, CATALOG_VERSION);
  if (!campaign || !scenario || stale) {
    const dropped = stale ?? dropStandalone(stored);
    return { ok: false, reason: "dropped", stored: dropped, write: dropped };
  }
  const cache = sessionCacheOf<Opened>(user, "standalone");
  const fingerprint = fingerprintOf(stored, CATALOG_VERSION);
  const kept = cache.get(stored.id, fingerprint);
  if (kept) return kept;
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, standaloneCodes(stored));
  const replayed = replayForTable(catalog, world, (observe) => resumeStandalone(stored, world, CATALOG_VERSION, observe));
  if (!replayed) {
    const dropped = dropStandalone(stored);
    return { ok: false, reason: "dropped", stored: dropped, write: dropped };
  }
  const opened: Opened = { ok: true, stored, ...replayed };
  cache.set(stored.id, fingerprint, opened);
  return opened;
}

export type StandaloneTable = { store: TableStore; clock: PlayClock };

/**
 * The table store for an opened game. Each intent the reducer accepts is appended and written at once; Undo takes it off. `clock`
 * counts the foreground time as the session store's does (table-open.ts): folded into each write, and written once on a pause.
 */
export function standaloneStore<TRun>(session: Opened, user: Db<TRun>): StandaloneTable {
  let saved: StandaloneGame = session.stored;
  const cache = sessionCacheOf<Opened>(user, "standalone");
  const base = createPlayClock();
  // Nothing taken leaves the game as it is (the same object), so a pause with no new time writes nothing.
  const fold = (game: StandaloneGame): StandaloneGame => {
    if (!game.active) return game;
    const active = addActive(game.active, base.take());
    return active === game.active ? game : { ...game, active };
  };
  // Asked for the game later (the outcome screen), the cache reads this table's game as it stands now; the row it must match is `saved`.
  const follow = () => {
    const { game, roundSteps, history } = store.getState();
    cache.follow(saved.id, () => ({ fingerprint: fingerprintOf(saved, CATALOG_VERSION), session: { ...session, stored: saved, game, roundSteps, history } }));
  };
  const store = committingStore(
    session,
    (intent) => {
      saved = fold(record(saved, intent));
      writeStandaloneActive(user, saved);
      follow();
    },
    () => {
      saved = fold(unrecord(saved));
      writeStandaloneActive(user, saved);
      follow();
    },
  );
  const clock: PlayClock = {
    resume: base.resume,
    take: base.take,
    // A game that is over, won or lost, writes nothing on a pause: its last intent folded the time already.
    pause: () => {
      base.pause();
      const { game } = store.getState();
      if (game.lost || isWon(game)) return;
      const folded = fold(saved);
      if (folded === saved) return;
      saved = folded;
      writeStandaloneActive(user, saved);
      follow();
    },
  };
  follow();
  return { store, clock };
}
