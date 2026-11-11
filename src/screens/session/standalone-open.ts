// Opens a standalone game for the table and the outcome screen: reads the row, loads the cards from catalog.db, and replays the intents through the reducer (open-game.ts). No log, pool or checklist. A game already opened as it now stands is
// not replayed again (session/cache.ts). Pure of React: the hooks that open it for a screen are in standalone-session.ts.
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { addActive } from "../../campaign/replay";
import { isWon, record, staleReason, unrecord } from "../../campaign/session";
import { continueStandalone, dropStandalone, resumeStandalone, restartStandalone, type StandaloneGame } from "../../campaign/standalone";
import { loadWorld } from "../../campaign/world";
import { CATALOG_VERSION } from "../../catalog/version";
import { EFFECTS } from "../../effects";
import type { TableStore } from "../../play/store/store";

import { campaignOf, scenarioOf } from "../data/campaign-data";
import { committingStore, replayForTable, type ReplayedGame } from "./open-game";
import { createPlayClock, type PlayClock } from "./play-clock";
import { fingerprintOf, sessionCacheOf } from "./cache";
import { readStandalone, writeStandaloneActive } from "../data/standalone-store";
import { dealSeed } from "../nav/e2e";
import { CANNOT_CONTINUE, MISSING_GAME, restartProblems, type StaleChoice } from "./stale-words";

type Db<TRun> = BaseSQLiteDatabase<"sync", TRun>;

export type StandaloneSession =
  | ({ ok: true; stored: StandaloneGame } & ReplayedGame)
  | { ok: false; reason: "missing" | "none" | "dropped" | "stale"; stored: StandaloneGame | null; write: StandaloneGame | null };

/** The codes the game can show: the Ring-bearer and every card of each dealt deck. */
export function standaloneCodes(game: StandaloneGame): string[] {
  const loadout = game.loadout;
  if (!loadout) return [];
  return [...(loadout.ringBearer ? [loadout.ringBearer] : []), ...loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck])];
}

type Opened = Extract<StandaloneSession, { ok: true }>;

/** The session already opened for this game as it now stands (session/cache.ts), or null: nothing is replayed. */
export function cachedStandalone<TUser>(user: Db<TUser>, gameId: string): Opened | null {
  const stored = readStandalone(user, gameId)?.game;
  if (!stored?.active || !stored.loadout) return null;
  return sessionCacheOf<Opened>(user, "standalone").get(stored.id, fingerprintOf(stored, CATALOG_VERSION));
}

/** Reads and replays the open game. It writes nothing: a drop it decides on (a game that does not read) is returned as `write`; a stale game returns reason "stale" (continueStandaloneGame, restartStandaloneGame). A game already opened as it now stands (session/cache.ts) is not replayed again. */
export function openStandalone<TCatalog, TUser>(catalog: Db<TCatalog>, user: Db<TUser>, gameId: string): StandaloneSession {
  const read = readStandalone(user, gameId);
  if (!read) return { ok: false, reason: "missing", stored: null, write: null };
  const stored = read.game;
  if (!stored.active || !stored.loadout) return { ok: false, reason: read.unreadable ? "dropped" : "none", stored, write: read.unreadable ? stored : null };
  const campaign = campaignOf(stored.campaignId);
  const scenario = scenarioOf(stored.scenarioId);
  if (!campaign || !scenario) {
    const dropped = dropStandalone(stored);
    return { ok: false, reason: "dropped", stored: dropped, write: dropped };
  }
  if (staleReason(stored.active, CATALOG_VERSION)) return { ok: false, reason: "stale", stored, write: null };
  const cache = sessionCacheOf<Opened>(user, "standalone");
  const fingerprint = fingerprintOf(stored, CATALOG_VERSION);
  const kept = cache.get(stored.id, fingerprint);
  if (kept) return kept;
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, standaloneCodes(stored));
  const replayed = replayForTable(catalog, world, (observe) => resumeStandalone(stored, world, CATALOG_VERSION, observe));
  if (!replayed) return { ok: false, reason: "stale", stored, write: null };
  const opened: Opened = { ok: true, stored, ...replayed };
  cache.set(stored.id, fingerprint, opened);
  return opened;
}

function worldOf<TCatalog>(catalog: Db<TCatalog>, game: StandaloneGame) {
  const campaign = campaignOf(game.campaignId);
  const scenario = scenarioOf(game.scenarioId);
  if (!campaign || !scenario) return null;
  try {
    return loadWorld(catalog, campaign, scenario, EFFECTS, standaloneCodes(game));
  } catch {
    return null;
  }
}

/** Continue (the stale sheet): replays the game on the new rules as far as its intents are accepted and writes that prefix, restamped. */
export function continueStandaloneGame<TCatalog, TUser>(catalog: Db<TCatalog>, user: Db<TUser>, gameId: string): StaleChoice {
  const game = readStandalone(user, gameId)?.game;
  const world = game ? worldOf(catalog, game) : null;
  if (!game || !world) return { ok: false, message: MISSING_GAME };
  const continued = continueStandalone(game, world, CATALOG_VERSION);
  if (!continued.ok) return { ok: false, message: CANNOT_CONTINUE };
  writeStandaloneActive(user, continued.holder);
  return { ok: true };
}

/** Restart (the stale sheet): deals the game again with its stored loadout and a new seed; the row and its loadout stay. */
export function restartStandaloneGame<TCatalog, TUser>(catalog: Db<TCatalog>, user: Db<TUser>, gameId: string): StaleChoice {
  const game = readStandalone(user, gameId)?.game;
  const world = game ? worldOf(catalog, game) : null;
  if (!game || !world) return { ok: false, message: MISSING_GAME };
  const dealt = restartStandalone(game, world, dealSeed(), CATALOG_VERSION);
  if (!dealt.ok) return { ok: false, message: restartProblems(dealt.briefing?.problems ?? null) };
  writeStandaloneActive(user, dealt.game);
  return { ok: true };
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
