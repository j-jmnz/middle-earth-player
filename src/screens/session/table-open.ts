// Opens the scenario a save has in progress for the table: reads the save, loads the cards from catalog.db, and replays the intents
// through the reducer (open-game.ts). An open scenario played on another engine version or other card data, or one the reducer
// refuses now, is not dropped: the open is "stale" and the table asks the player to continue it or restart it (continueTable,
// restartTable), the only writes. One that does not read at all is dropped, the log and decks staying. A save already opened as it now stands is not replayed again (session/cache.ts). Pure of React: the hooks
// that open it for a screen are in table-session.ts.
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { addActive, stampedWorld, staleReason } from "../../campaign/replay";
import type { Save } from "../../campaign/save";
import { continueSave, drop, finish, isWon, record, restartSave, resume, unrecord } from "../../campaign/session";
import { logCodes, loadWorld, worldHash, type World } from "../../campaign/world";
import { CATALOG_VERSION } from "../../catalog/version";
import { dealSeed } from "../nav/e2e";
import { CANNOT_CONTINUE, MISSING_GAME, restartProblems, type StaleChoice } from "./stale-words";
import { EFFECTS } from "../../effects";
import type { TableStore } from "../../play/store/store";

import { afterPaint } from "../nav/after-paint";
import { campaignOf, scenarioOf } from "../data/campaign-data";
import { readSaveChecked, writeActive, type ReadSave } from "../data/campaign-store";
import { committingStore, replayForTable, type ReplayedGame } from "./open-game";
import { flushRunsOnLeave } from "./flush-runs-on-leave";
import { flushRuns, queueRun } from "../data/pending-runs";
import { recordCampaignRun } from "../data/run-writers";
import { createPlayClock, type PlayClock } from "./play-clock";
import { fingerprintOf, sessionCacheOf } from "./cache";

type Db<TRun> = BaseSQLiteDatabase<"sync", TRun>;

// `stamp` is the save to write when the open game was saved before it carried a world hash and is current: the first open stamps it.
export type TableSession = ({ ok: true; save: Save; stamp: Save | null } & ReplayedGame) | { ok: false; reason: "missing" | "none" | "dropped" | "stale"; save: Save | null; write: Save | null };

/** The codes the open scenario can show: the log's cards, the Ring-bearer and every card of each dealt deck. */
export function loadoutCodes(save: Save): string[] {
  const loadout = save.loadout;
  if (!loadout) return logCodes(save.log);
  return [...logCodes(save.log), ...(loadout.ringBearer ? [loadout.ringBearer] : []), ...loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck])];
}

type Opened = Extract<TableSession, { ok: true }>;

/**
 * Reads and replays the open scenario. It writes nothing: when the open scenario has to be dropped (it does not read), the save to write is
 * returned as `write`; a stale one returns reason "stale" and no write, and useTableSession writes it in an effect, never during a render. A save already opened as it now stands
 * (session/cache.ts) is not replayed again.
 */
export function openTable<TCatalog, TUser>(catalog: Db<TCatalog>, user: Db<TUser>, saveId: string): TableSession {
  return openRead(catalog, user, readSaveChecked(user, saveId));
}

/** The session already opened for this save as it now stands (session/cache.ts), or null: nothing is replayed. */
export function cachedTable<TUser>(user: Db<TUser>, saveId: string): Opened | null {
  const save = readSaveChecked(user, saveId)?.save;
  if (!save?.active || !save.loadout) return null;
  return sessionCacheOf<Opened>(user, "save").get(save.id, fingerprintOf(save, CATALOG_VERSION));
}

function openRead<TCatalog, TUser>(catalog: Db<TCatalog>, user: Db<TUser>, read: ReadSave | null): TableSession {
  if (!read) return { ok: false, reason: "missing", save: null, write: null };
  const save = read.save;
  if (!save.active || !save.loadout) return { ok: false, reason: read.unreadable ? "dropped" : "none", save, write: read.unreadable ? save : null };
  const campaign = campaignOf(save.campaignId);
  const scenario = scenarioOf(save.loadout.scenarioId);
  if (!campaign || !scenario) {
    const dropped = drop(save);
    return { ok: false, reason: "dropped", save: dropped, write: dropped };
  }
  // Without a world: the engine version, and the catalog version of a save that has no world stamp yet.
  if (staleReason(save.active, null)) return { ok: false, reason: "stale", save, write: null };
  const cache = sessionCacheOf<Opened>(user, "save");
  const kept = cache.get(save.id, fingerprintOf(save, CATALOG_VERSION));
  if (kept) return kept;
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, loadoutCodes(save));
  const hash = worldHash(world);
  if (staleReason(save.active, hash)) return { ok: false, reason: "stale", save, write: null };
  // A save from before the world stamp is current: it is stamped, and written once by the hook that opened it.
  const stamped: Save = { ...save, active: stampedWorld(save.active, hash) };
  const replayed = replayForTable(catalog, world, (observe) => resume(stamped, world, observe));
  if (!replayed) {
    // The reducer refused a stored intent, or the start no longer builds: the player chooses, nothing is dropped.
    return { ok: false, reason: "stale", save, write: null };
  }
  const opened: Opened = { ok: true, save: stamped, stamp: null, ...replayed };
  cache.set(save.id, fingerprintOf(stamped, CATALOG_VERSION), opened);
  return stamped.active === save.active ? opened : { ...opened, stamp: stamped };
}

// The world of an open scenario, or null when its campaign or scenario is not in the build or its cards do not load.
function worldOf<TCatalog>(catalog: Db<TCatalog>, save: Save): World | null {
  const campaign = campaignOf(save.campaignId);
  const scenario = save.loadout ? scenarioOf(save.loadout.scenarioId) : null;
  if (!campaign || !scenario) return null;
  try {
    return loadWorld(catalog, campaign, scenario, EFFECTS, loadoutCodes(save));
  } catch {
    return null;
  }
}

/**
 * Continue (the stale sheet): replays the open scenario on the new rules as far as its intents are accepted and writes that prefix,
 * stamped with the engine version and world it now plays on. The session cache misses on the new save, so the next open replays it.
 */
export function continueTable<TCatalog, TUser>(catalog: Db<TCatalog>, user: Db<TUser>, saveId: string): StaleChoice {
  const save = readSaveChecked(user, saveId)?.save;
  const world = save ? worldOf(catalog, save) : null;
  if (!save || !world) return { ok: false, message: MISSING_GAME };
  const continued = continueSave(save, world);
  if (!continued.ok) return { ok: false, message: CANNOT_CONTINUE };
  writeActive(user, continued.holder);
  return { ok: true };
}

/** Restart (the stale sheet): deals the scenario again with the stored loadout and a new seed; the log and the decks stay. */
export function restartTable<TCatalog, TUser>(catalog: Db<TCatalog>, user: Db<TUser>, saveId: string): StaleChoice {
  const save = readSaveChecked(user, saveId)?.save;
  const world = save ? worldOf(catalog, save) : null;
  if (!save || !world) return { ok: false, message: MISSING_GAME };
  const dealt = restartSave(save, world, dealSeed(), Date.now());
  if (!dealt.ok) return { ok: false, message: restartProblems(dealt.briefing?.problems ?? null) };
  writeActive(user, dealt.save);
  return { ok: true };
}

export type SessionStore = { store: TableStore; save: () => Save; clock: PlayClock };

/**
 * The table store for an opened session. Each intent the reducer accepts is appended to the save and written at once, and an
 * undo takes the last one off, so a kill and relaunch replays the same game. `save` is the save as last written. `clock` counts the
 * foreground time (play-clock.ts): each intent and each undo folds what it took into the save it writes, and a pause writes once more
 * for the time since the last write.
 */
export function sessionStore<TRun>(session: Opened, user: Db<TRun>): SessionStore {
  let saved: Save = session.save;
  const cache = sessionCacheOf<Opened>(user, "save");
  const base = createPlayClock();
  // The foreground time since the last write, added to the open scenario.
  // Nothing taken leaves the save as it is (the same object), so a pause with no new time writes nothing.
  const fold = (save: Save): Save => {
    if (!save.active) return save;
    const active = addActive(save.active, base.take());
    return active === save.active ? save : { ...save, active };
  };
  // Asked for the save later (the Resolution), the cache reads this table's game as it stands now; the save it must match is `saved`.
  const follow = () => {
    const { game, roundSteps, history } = store.getState();
    cache.follow(saved.id, () => ({ fingerprint: fingerprintOf(saved, CATALOG_VERSION), session: { ...session, save: saved, game, roundSteps, history } }));
  };
  const store = committingStore(
    session,
    (intent, game) => {
      saved = fold(record(saved, intent));
      writeActive(user, saved);
      // A lost game can no longer be undone, and its run id is fixed: write the run now, so closing the Resolution any way (or never)
      // still leaves it. A win waits for its Resolution choices (the reward).
      if (game.lost) recordCampaignRun(user, saved, finish(saved, session.world, game), session.world, game);
      follow();
    },
    () => {
      saved = fold(unrecord(saved));
      writeActive(user, saved);
      follow();
    },
  );
  // A pause (the table left, the app in the background) writes the time since the last write, once; a game that is over, won or lost, writes nothing
  // (its last intent folded the time already, and a pause must never write a finished scenario back).
  const clock: PlayClock = {
    resume: base.resume,
    take: base.take,
    pause: () => {
      base.pause();
      const { game } = store.getState();
      if (game.lost || isWon(game)) return;
      const folded = fold(saved);
      if (folded === saved) return;
      saved = folded;
      writeActive(user, saved);
      follow();
    },
  };
  follow();
  return { store, save: () => saved, clock };
}

/**
 * Writes the run of an open scenario that is over but was never closed, before the save drops or deletes it (a new deal, a
 * deleted playthrough). A win's reward is chosen at the Resolution, so it is left out. A scenario still going, one that
 * cannot be replayed (another engine version) and one that is not open write nothing.
 *
 * The save is read now, since the caller is about to overwrite or delete it; the run is written after the next paint (or when
 * History next reads the runs, or the app leaves the foreground), once, and its replay is the one the table left in the session cache when it can be. `endedAt` is
 * the time of the call.
 */
export function recordUnclosedRun<TCatalog, TUser>(catalog: Db<TCatalog>, user: Db<TUser>, saveId: string, later: (work: () => void) => void = afterPaint): void {
  const read = readUnclosed(user, saveId);
  if (!read) return;
  const now = Date.now();
  queueRun(() => writeUnclosedRun(catalog, user, read, now));
  // Written after the next paint, or at once when the app leaves the foreground first (it may be killed there); the queue runs a job once.
  flushRunsOnLeave();
  later(flushRuns);
}

// The save to write the run of, or null when it cannot be read: a run is a record, so that must not stop the deal or the delete.
function readUnclosed<TUser>(user: Db<TUser>, saveId: string): ReadSave | null {
  try {
    return readSaveChecked(user, saveId);
  } catch {
    return null;
  }
}

function writeUnclosedRun<TCatalog, TUser>(catalog: Db<TCatalog>, user: Db<TUser>, read: ReadSave | null, now: number): void {
  try {
    const session = openRead(catalog, user, read);
    if (!session.ok) return;
    const state = session.game;
    if (!state.lost && !isWon(state)) return;
    recordCampaignRun(user, session.save, session.save, session.world, state, now);
  } catch {
    // The run is a record, not a step: a scenario that will not replay must not stop the deal or the delete.
  }
}
