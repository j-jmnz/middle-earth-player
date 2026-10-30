// Opens the scenario a save has in progress for the table: reads the save, drops an open scenario played on another engine
// version or other card data (the log and decks stay), loads the cards from catalog.db, and replays the intents through the
// reducer (open-game.ts). A save already opened as it now stands is not replayed again (session-cache.ts). Pure of React: the hooks
// that open it for a screen are in table-session.ts.
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import type { Save } from "../campaign/save";
import { drop, finish, isWon, record, resume, staleReason, unrecord } from "../campaign/session";
import { logCodes, loadWorld } from "../campaign/world";
import { CATALOG_VERSION } from "../catalog/version";
import { EFFECTS } from "../effects";
import type { TableStore } from "../play/store";

import { afterPaint } from "./after-paint";
import { campaignOf, scenarioOf } from "./campaign-data";
import { readSaveChecked, writeActive, type ReadSave } from "./campaign-store";
import { committingStore, replayForTable, type ReplayedGame } from "./open-game";
import { flushRuns, queueRun } from "./pending-runs";
import { recordCampaignRun } from "./run-writers";
import { fingerprintOf, sessionCacheOf } from "./session-cache";

type Db<TRun> = BaseSQLiteDatabase<"sync", TRun>;

export type TableSession = ({ ok: true; save: Save } & ReplayedGame) | { ok: false; reason: "missing" | "none" | "dropped"; save: Save | null; write: Save | null };

/** The codes the open scenario can show: the log's cards, the Ring-bearer and every card of each dealt deck. */
export function loadoutCodes(save: Save): string[] {
  const loadout = save.loadout;
  if (!loadout) return logCodes(save.log);
  return [...logCodes(save.log), ...(loadout.ringBearer ? [loadout.ringBearer] : []), ...loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck])];
}

type Opened = Extract<TableSession, { ok: true }>;

/**
 * Reads and replays the open scenario. It writes nothing: when the open scenario has to be dropped, the save to write is
 * returned as `write`, and useTableSession writes it in an effect, never during a render. A save already opened as it now stands
 * (session-cache.ts) is not replayed again.
 */
export function openTable<TCatalog, TUser>(catalog: Db<TCatalog>, user: Db<TUser>, saveId: string): TableSession {
  return openRead(catalog, user, readSaveChecked(user, saveId));
}

function openRead<TCatalog, TUser>(catalog: Db<TCatalog>, user: Db<TUser>, read: ReadSave | null): TableSession {
  if (!read) return { ok: false, reason: "missing", save: null, write: null };
  const save = read.save;
  if (!save.active || !save.loadout) return { ok: false, reason: read.unreadable ? "dropped" : "none", save, write: read.unreadable ? save : null };
  const campaign = campaignOf(save.campaignId);
  const scenario = scenarioOf(save.loadout.scenarioId);
  if (!campaign || !scenario || staleReason(save.active, CATALOG_VERSION)) {
    const dropped = drop(save);
    return { ok: false, reason: "dropped", save: dropped, write: dropped };
  }
  const cache = sessionCacheOf<Opened>(user, "save");
  const fingerprint = fingerprintOf(save, CATALOG_VERSION);
  const kept = cache.get(save.id, fingerprint);
  if (kept) return kept;
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, loadoutCodes(save));
  const replayed = replayForTable(catalog, world, (observe) => resume(save, world, CATALOG_VERSION, observe));
  if (!replayed) {
    // The reducer refused a stored intent, or the start no longer builds: drop the open scenario and keep the log.
    const dropped = drop(save);
    return { ok: false, reason: "dropped", save: dropped, write: dropped };
  }
  const opened: Opened = { ok: true, save, ...replayed };
  cache.set(save.id, fingerprint, opened);
  return opened;
}

export type SessionStore = { store: TableStore; save: () => Save };

/**
 * The table store for an opened session. Each intent the reducer accepts is appended to the save and written at once, and an
 * undo takes the last one off, so a kill and relaunch replays the same game. `save` is the save as last written.
 */
export function sessionStore<TRun>(session: Opened, user: Db<TRun>): SessionStore {
  let saved: Save = session.save;
  const cache = sessionCacheOf<Opened>(user, "save");
  // Asked for the save later (the Resolution), the cache reads this table's game as it stands now; the save it must match is `saved`.
  const follow = () => {
    const { game, roundSteps, history } = store.getState();
    cache.follow(saved.id, () => ({ fingerprint: fingerprintOf(saved, CATALOG_VERSION), session: { ...session, save: saved, game, roundSteps, history } }));
  };
  const store = committingStore(
    session,
    (intent, game) => {
      saved = record(saved, intent);
      writeActive(user, saved);
      // A lost game can no longer be undone, and its run id is fixed: write the run now, so closing the Resolution any way (or never)
      // still leaves it. A win waits for its Resolution choices (the reward).
      if (game.lost) recordCampaignRun(user, saved, finish(saved, session.world, game), session.world, game);
      follow();
    },
    () => {
      saved = unrecord(saved);
      writeActive(user, saved);
      follow();
    },
  );
  follow();
  return { store, save: () => saved };
}

/**
 * Writes the run of an open scenario that is over but was never closed, before the save drops or deletes it (a new deal, a
 * deleted playthrough). A win's reward is chosen at the Resolution, so it is left out. A scenario still going, one that
 * cannot be replayed (another engine version) and one that is not open write nothing.
 *
 * The save is read now, since the caller is about to overwrite or delete it; the run is written after the next paint (or when
 * History next reads the runs), once, and its replay is the one the table left in the session cache when it can be. `endedAt` is
 * the time of the call.
 */
export function recordUnclosedRun<TCatalog, TUser>(catalog: Db<TCatalog>, user: Db<TUser>, saveId: string, later: (work: () => void) => void = afterPaint): void {
  const read = readUnclosed(user, saveId);
  if (!read) return;
  const now = Date.now();
  queueRun(() => writeUnclosedRun(catalog, user, read, now));
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
