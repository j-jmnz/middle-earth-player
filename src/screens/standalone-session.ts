// Opens a standalone game for the table and the outcome screen: reads the row, drops an open game played on another engine
// version or other card data (the row and its loadout stay, so it can be dealt again), loads the cards from catalog.db,
// and replays the intents through the reducer (open-game.ts). No log, pool or checklist.
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { useEffect, useMemo } from "react";

import { record, unrecord } from "../campaign/session";
import { droppedIfStale, dropStandalone, resumeStandalone, type StandaloneGame } from "../campaign/standalone";
import { loadWorld } from "../campaign/world";
import { CATALOG_VERSION } from "../catalog/version";
import { EFFECTS } from "../effects";
import type { TableStore } from "../play/store";

import { campaignOf, scenarioOf } from "./campaign-data";
import { useDatabases } from "./databases";
import { committingStore, replayForTable, type ReplayedGame } from "./open-game";
import { readStandalone, writeStandalone } from "./standalone-store";

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

/** Reads and replays the open game. It writes nothing: a drop it decides on is returned as `write`. */
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
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, standaloneCodes(stored));
  const replayed = replayForTable(catalog, world, (observe) => resumeStandalone(stored, world, CATALOG_VERSION, observe));
  if (!replayed) {
    const dropped = dropStandalone(stored);
    return { ok: false, reason: "dropped", stored: dropped, write: dropped };
  }
  return { ok: true, stored, ...replayed };
}

/** The open game, opened once per id. A drop it decided on is written after the render. */
export function useStandaloneSession(gameId: string | null): StandaloneSession | null {
  const { catalog, user } = useDatabases();
  const session = useMemo(() => (gameId ? openStandalone(catalog, user, gameId) : null), [catalog, user, gameId]);
  useEffect(() => {
    if (session && !session.ok && session.write) writeStandalone(user, session.write);
  }, [session, user]);
  return session;
}

/** The table store for an opened game. Each intent the reducer accepts is appended and written at once; Undo takes it off. */
export function standaloneStore<TRun>(session: Extract<StandaloneSession, { ok: true }>, user: Db<TRun>): TableStore {
  let saved: StandaloneGame = session.stored;
  return committingStore(
    session,
    (intent) => {
      saved = record(saved, intent);
      writeStandalone(user, saved);
    },
    () => {
      saved = unrecord(saved);
      writeStandalone(user, saved);
    },
  );
}
