// Opens the scenario a save has in progress for the table: reads the save, drops an open scenario played on another engine
// version or other card data (the log and decks stay), loads the cards from catalog.db, and replays the intents through the
// reducer (open-game.ts).
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { useEffect, useMemo } from "react";

import type { Save } from "../campaign/save";
import { drop, record, resume, staleReason } from "../campaign/session";
import { logCodes, loadWorld } from "../campaign/world";
import { CATALOG_VERSION } from "../catalog/version";
import { EFFECTS } from "../effects";
import type { TableStore } from "../play/store";

import { campaignOf, scenarioOf } from "./campaign-data";
import { useDatabases } from "./databases";
import { readSaveChecked, writeSave } from "./campaign-store";
import { committingStore, replayForTable, type ReplayedGame } from "./open-game";

type Db<TRun> = BaseSQLiteDatabase<"sync", TRun>;

export type TableSession = ({ ok: true; save: Save } & ReplayedGame) | { ok: false; reason: "missing" | "none" | "dropped"; save: Save | null; write: Save | null };

/** The codes the open scenario can show: the log's cards, the Ring-bearer and every card of each dealt deck. */
export function loadoutCodes(save: Save): string[] {
  const loadout = save.loadout;
  if (!loadout) return logCodes(save.log);
  return [...logCodes(save.log), ...(loadout.ringBearer ? [loadout.ringBearer] : []), ...loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck])];
}

/**
 * Reads and replays the open scenario. It writes nothing: when the open scenario has to be dropped, the save to write is
 * returned as `write`, and useTableSession writes it in an effect, never during a render.
 */
export function openTable<TCatalog, TUser>(catalog: Db<TCatalog>, user: Db<TUser>, saveId: string): TableSession {
  const read = readSaveChecked(user, saveId);
  if (!read) return { ok: false, reason: "missing", save: null, write: null };
  const save = read.save;
  if (!save.active || !save.loadout) return { ok: false, reason: read.unreadable ? "dropped" : "none", save, write: read.unreadable ? save : null };
  const campaign = campaignOf(save.campaignId);
  const scenario = scenarioOf(save.loadout.scenarioId);
  if (!campaign || !scenario || staleReason(save.active, CATALOG_VERSION)) {
    const dropped = drop(save);
    return { ok: false, reason: "dropped", save: dropped, write: dropped };
  }
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, loadoutCodes(save));
  const replayed = replayForTable(catalog, world, (observe) => resume(save, world, CATALOG_VERSION, observe));
  if (!replayed) {
    // The reducer refused a stored intent, or the start no longer builds: drop the open scenario and keep the log.
    const dropped = drop(save);
    return { ok: false, reason: "dropped", save: dropped, write: dropped };
  }
  return { ok: true, save, ...replayed };
}

/** The open scenario of a save, opened once per save id. A drop it decided on is written after the render. */
export function useTableSession(saveId: string | null): TableSession | null {
  const { catalog, user } = useDatabases();
  const session = useMemo(() => (saveId ? openTable(catalog, user, saveId) : null), [catalog, user, saveId]);
  useEffect(() => {
    if (session && !session.ok && session.write) writeSave(user, session.write);
  }, [session, user]);
  return session;
}

export type SessionStore = { store: TableStore; save: () => Save };

/**
 * The table store for an opened session. Each intent the reducer accepts is appended to the save and written at once, so a
 * kill and relaunch replays the same game. `save` is the save as last written.
 */
export function sessionStore<TRun>(session: Extract<TableSession, { ok: true }>, user: Db<TRun>): SessionStore {
  let saved: Save = session.save;
  const store = committingStore(session, (intent) => {
    saved = record(saved, intent);
    writeSave(user, saved);
  });
  return { store, save: () => saved };
}
