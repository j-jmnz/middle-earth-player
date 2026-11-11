// Opens a standalone game for the table and the outcome screen: reads the row, loads the cards from catalog.db, and replays the intents through the reducer (open-game.ts). No log, pool or checklist. A game already opened as it now stands is
// not replayed again (session/cache.ts). Pure of React: the hooks that open it for a screen are in standalone-session.ts.
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { atPhaseBoundary, checkpointOf } from "../../campaign/checkpoint";
import { staleChanges } from "../../campaign/changes";
import { addActive, fullChecks, staleReason } from "../../campaign/replay";
import { continuesFromCheckpoint, isWon, record, unrecord } from "../../campaign/session";
import { continueStandalone, dropStandalone, resumeStandalone, restartStandalone, type StandaloneGame } from "../../campaign/standalone";
import { loadWorld, worldHash } from "../../campaign/world";
import { CATALOG_VERSION } from "../../catalog/version";
import { EFFECTS } from "../../effects";
import type { ScenarioState, TableStore } from "../../play/store/store";

import { campaignOf, scenarioOf } from "../data/campaign-data";
import { committingStore, replayForTable, type ReplayedGame } from "./open-game";
import { createPlayClock, type PlayClock } from "./play-clock";
import { fingerprintOf, sessionCacheOf } from "./cache";
import { clearStandaloneCheckpointPast, readStandalone, readStandaloneCheckpoint, writeStandaloneActive, writeStandaloneCheckpoint, writeStandaloneReplaced } from "../data/standalone-store";
import { dealSeed } from "../nav/e2e";
import { CANNOT_CONTINUE, MISSING_GAME, restartProblems, type StaleChoice } from "./stale-words";

type Db<TRun> = BaseSQLiteDatabase<"sync", TRun>;

export type StandaloneSession =
  // `stamp` is the game to write once when the open left it different from its row (table-open.ts, TableSession). `takenBack` on a stale result is how many moves Continue would take back, when a checked replay found one that does not match; `fromCheckpoint` says Continue will rebase onto the game's checkpoint instead; `changes` is what changed under the game, for the sheet.
  | ({ ok: true; stored: StandaloneGame; stamp: StandaloneGame | null } & ReplayedGame)
  | { ok: false; reason: "missing" | "none" | "dropped" | "stale"; stored: StandaloneGame | null; write: StandaloneGame | null; takenBack?: number | null; fromCheckpoint?: boolean; changes?: readonly string[] };

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
  // Without a world: the engine version, and the catalog version of a game that has no world stamp yet. One of another engine version
  // without checks to compare has nothing to replay: the player chooses, without loading the world.
  if (staleReason(stored.active, null) && (stored.active.intents.length === 0 || !fullChecks(stored.active))) return { ok: false, reason: "stale", stored, write: null, takenBack: null, changes: staleChanges(stored.active, stored.scenarioId, null) };
  const cache = sessionCacheOf<Opened>(user, "standalone");
  const kept = cache.get(stored.id, fingerprintOf(stored, CATALOG_VERSION));
  if (kept) return kept;
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, standaloneCodes(stored));
  const replayed = replayForTable(catalog, world, (observe) => resumeStandalone(stored, world, observe));
  if (!replayed.ok) return { ok: false, reason: "stale", stored, write: null, changes: staleChanges(stored.active, stored.scenarioId, worldHash(world)), takenBack: replayed.at == null ? null : stored.active.intents.length - replayed.at, fromCheckpoint: continuesFromCheckpoint(stored.active, readStandaloneCheckpoint(user, stored.id), world, stored.seatCount) };
  const stamped: StandaloneGame = replayed.stamp ? { ...stored, active: replayed.stamp } : stored;
  const opened: Opened = { ok: true, stored: stamped, stamp: null, ...replayed.game };
  cache.set(stored.id, fingerprintOf(stamped, CATALOG_VERSION), opened);
  return stamped === stored ? opened : { ...opened, stamp: stamped };
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

/** Continue (the stale sheet): rebases the game onto its checkpoint when that passes the check, otherwise replays it on the new rules as far as its intents are accepted; writes the result, restamped, with the checkpoint cleared. */
export function continueStandaloneGame<TCatalog, TUser>(catalog: Db<TCatalog>, user: Db<TUser>, gameId: string): StaleChoice {
  const game = readStandalone(user, gameId)?.game;
  const world = game ? worldOf(catalog, game) : null;
  if (!game || !world) return { ok: false, message: MISSING_GAME };
  const continued = continueStandalone(game, world, readStandaloneCheckpoint(user, gameId));
  if (!continued.ok) return { ok: false, message: CANNOT_CONTINUE };
  writeStandaloneReplaced(user, continued.holder);
  return { ok: true };
}

/** Restart (the stale sheet): deals the game again with its stored loadout and a new seed; the row and its loadout stay. */
export function restartStandaloneGame<TCatalog, TUser>(catalog: Db<TCatalog>, user: Db<TUser>, gameId: string): StaleChoice {
  const game = readStandalone(user, gameId)?.game;
  const world = game ? worldOf(catalog, game) : null;
  if (!game || !world) return { ok: false, message: MISSING_GAME };
  const dealt = restartStandalone(game, world, dealSeed());
  if (!dealt.ok) return { ok: false, message: restartProblems(dealt.briefing?.problems ?? null) };
  writeStandaloneReplaced(user, dealt.game);
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
  // How many intents the checkpoint this session last wrote counted (table-open.ts, sessionStore).
  let checkpointed: number | null = null;
  const checkpoint = (state: ScenarioState) => {
    if (!saved.active || checkpointed === saved.active.intents.length) return;
    writeStandaloneCheckpoint(user, saved.id, checkpointOf(state, saved.active));
    checkpointed = saved.active.intents.length;
  };
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
    (intent, game) => {
      saved = fold(record(saved, intent, game));
      writeStandaloneActive(user, saved);
      // The table at each phase boundary, never per intent.
      if (atPhaseBoundary(game) && !game.lost && !isWon(game)) checkpoint(game);
      follow();
    },
    () => {
      saved = fold(unrecord(saved));
      writeStandaloneActive(user, saved);
      if (saved.active) {
        clearStandaloneCheckpointPast(user, saved.id, saved.active.intents.length);
        if (checkpointed != null && checkpointed > saved.active.intents.length) checkpointed = null;
      }
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
      if (folded !== saved) {
        saved = folded;
        writeStandaloneActive(user, saved);
        follow();
      }
      checkpoint(game);
    },
  };
  follow();
  return { store, clock };
}
