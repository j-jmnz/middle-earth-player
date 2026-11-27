// Opens the scenario a save has in progress for the table: reads the save, loads the cards from catalog.db, and replays the intents
// through the reducer (open-game.ts). An open scenario played on another engine version or other card data, or one the reducer
// refuses now, is not dropped: the open is "stale" and the table asks the player to continue it or restart it (continueTable,
// restartTable), the only writes. One that does not read at all is dropped, the log and decks staying; one whose campaign or scenario is not in this build
// is left as it is and reads as not open. A save already opened as it now stands is not replayed again (session/cache.ts). Pure of React: the hooks
// that open it for a screen are in table-session.ts.
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { needsChoiceBeforeOpen } from "../../campaign/replay";
import { staleChanges } from "../../campaign/changes";
import type { Save } from "../../campaign/save";
import { continueSave, finish, isWon, restartSave, resume, savedCodes } from "../../campaign/session";
import { loadWorld, type World } from "../../campaign/world";
import { CATALOG_VERSION } from "../../catalog/version";
import { dealSeed } from "../nav/e2e";
import { EFFECTS } from "../../effects";
import type { ScenarioState, TableStore } from "../../play/store/store";

import { afterPaint } from "../nav/after-paint";
import { campaignOf, scenarioOf } from "../data/campaign-data";
import { readCheckpoint, readSaveChecked, writeActive, writeCheckpoint, writeReplaced, writeUndone, type ReadSave } from "../data/campaign-store";
import { replayForTable, type ReplayedGame } from "./open-game";
import { flushRunsOnLeave } from "./flush-runs-on-leave";
import { flushRuns, queueRun } from "../data/pending-runs";
import { recordCampaignRun } from "../data/run-writers";
import { deleteRun } from "../data/run-store";
import { campaignRunId } from "../../campaign/runs";
import type { PlayClock } from "./play-clock";
import { fingerprintOf, sessionCacheOf } from "./cache";
import { gameStore } from "./game-store";
import { continueChoice, gameWorld, restartChoice, staleFields } from "./stale-game";
import type { StaleChoice } from "./stale-words";

type Db<TRun> = BaseSQLiteDatabase<"sync", TRun>;

// `stamp` is the save to write once when the open left the game different from its row: stamped with the world (a save from before it), restamped
// after a checked replay matched every move on another engine version, or given the checks it lacked. `takenBack` on a stale result is how many moves Continue would take back
// when a checked replay found the first that does not match (null: nothing was compared). `fromCheckpoint` says Continue will rebase onto the game's checkpoint instead
// (it passes the check): then no move is taken back but the ones after it that do not match. `changes` is what changed under the game, for the sheet (campaign/changes.ts).
export type TableSession =
  | ({ ok: true; save: Save; stamp: Save | null } & ReplayedGame)
  | { ok: false; reason: "missing" | "none" | "dropped" | "stale"; save: Save | null; write: Save | null; takenBack?: number | null; fromCheckpoint?: boolean; changes?: readonly string[] };

/** The codes the open scenario can show: the log's cards, the Ring-bearer and every card of each dealt deck. */
export function loadoutCodes(save: Save): string[] {
  return savedCodes(save, save.loadout);
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
  const { active, loadout } = save;
  // A game whose campaign or scenario is not in this build is left as it is: it reads as not open, and nothing is written.
  const campaign = campaignOf(save.campaignId);
  const scenario = scenarioOf(loadout.scenarioId);
  if (!campaign || !scenario) return { ok: false, reason: "none", save, write: null };
  // Without a world: the engine version, and the catalog version of a save that has no world stamp yet. One of another engine
  // version without checks to compare has nothing to replay: the player chooses, without loading the world.
  if (needsChoiceBeforeOpen(active, active.intents.length, active.checks?.length ?? null)) return { ok: false, reason: "stale", save, write: null, takenBack: null, changes: staleChanges(active, loadout.scenarioId, null) };
  const cache = sessionCacheOf<Opened>(user, "save");
  const kept = cache.get(save.id, fingerprintOf(save, CATALOG_VERSION));
  if (kept) return kept;
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, loadoutCodes(save));
  const replayed = replayForTable(catalog, world, (observe) => resume(save, world, observe));
  // Another engine version or world that did not match, the reducer refused a stored intent, or the start no longer builds: the player chooses, nothing is dropped.
  if (!replayed.ok) return { ok: false, reason: "stale", save, write: null, ...staleFields(active, loadout.scenarioId, world, loadoutCodes(save), replayed.at, readCheckpoint(user, save.id), save.seatCount) };
  // The row as the replay leaves it (stamped, restamped, or given its checks) is the save the table opens on, and the hook that opened it writes it once.
  const stamped: Save = replayed.stamp ? { ...save, active: replayed.stamp } : save;
  const opened: Opened = { ok: true, save: stamped, stamp: null, ...replayed.game };
  cache.set(save.id, fingerprintOf(stamped, CATALOG_VERSION), opened);
  return stamped === save ? opened : { ...opened, stamp: stamped };
}

// The world of an open scenario, or null when its campaign or scenario is not in the build or its cards do not load.
function worldOf<TCatalog>(catalog: Db<TCatalog>, save: Save): World | null {
  return save.loadout ? gameWorld(catalog, save.campaignId, save.loadout.scenarioId, loadoutCodes(save)) : null;
}

/**
 * Continue (the stale sheet): rebases the open scenario onto its checkpoint when that passes the check, and otherwise replays it on the new rules as far as its
 * intents are accepted. It writes the result (with its rebase, the checkpoint cleared), stamped with the engine version and world it now plays on. The session
 * cache misses on the new save, so the next open replays it.
 */
export function continueTable<TCatalog, TUser>(catalog: Db<TCatalog>, user: Db<TUser>, saveId: string): StaleChoice {
  const save = readSaveChecked(user, saveId)?.save ?? null;
  return continueChoice(save, save ? worldOf(catalog, save) : null, (held, world) => continueSave(held, world, readCheckpoint(user, saveId)), (held) => writeReplaced(user, held));
}

/** Restart (the stale sheet): deals the scenario again with the stored loadout and a new seed; the log and the decks stay. */
export function restartTable<TCatalog, TUser>(catalog: Db<TCatalog>, user: Db<TUser>, saveId: string): StaleChoice {
  const save = readSaveChecked(user, saveId)?.save ?? null;
  const deal = (held: Save, world: World) => {
    const dealt = restartSave(held, world, dealSeed(), Date.now());
    return dealt.ok ? { ok: true as const, holder: dealt.save } : { ok: false as const, problems: dealt.briefing?.problems ?? null };
  };
  return restartChoice(save, save ? worldOf(catalog, save) : null, deal, (held) => writeReplaced(user, held));
}

export type SessionStore = { store: TableStore; save: () => Save; clock: PlayClock };

/**
 * The table store for an opened session (game-store.ts). Each intent the reducer accepts is appended to the save and written at once, and an
 * undo takes the last one off, so a kill and relaunch replays the same game. `save` is the save as last written.
 */
export function sessionStore<TRun>(session: Opened, user: Db<TRun>): SessionStore {
  const { store, saved, clock } = gameStore<Save, Opened>({
    session,
    initial: session.save,
    cache: sessionCacheOf<Opened>(user, "save"),
    // The open's stamp is written already: a session the cache hands out later carries none, so the Resolution's open never writes the save as it stood at the table's open.
    reopened: (save, now) => ({ ...session, stamp: null, save, ...now }),
    writers: { active: (save) => writeActive(user, save), undone: (save) => writeUndone(user, save), checkpoint: (id, checkpoint) => writeCheckpoint(user, id, checkpoint) },
    // A lost game: write the run now, so closing the Resolution any way (or never) still leaves it.
    onLost: (save, game: ScenarioState) => recordCampaignRun(user, save, finish(save, session.world, game), session.world, game),
    // Undo takes the lost move back: the run it wrote goes (a new run has the same id, and a second write would change nothing).
    onLostUndone: (save, left) => {
      if (save.active) deleteRun(user, campaignRunId(save.id, left.scenarioId, save.active.seed, save.active.startedAt));
    },
  });
  return { store, save: saved, clock };
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
