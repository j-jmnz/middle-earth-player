// Opens the scenario a save has in progress for the table: reads the save, drops an open scenario played on another engine
// version or other card data (the log and decks stay), loads the cards from catalog.db, and replays the intents through the
// reducer, keeping the steps of the round it reopens on for the log sheet. The table's state is never read from SQLite again
// after this: the store holds the reducer's result (docs/architecture.md, State).
import { inArray } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import type { Save } from "../campaign/save";
import { contextOf, drop, record, resume, staleReason } from "../campaign/session";
import { logCodes, loadWorld, type World } from "../campaign/world";
import { cards } from "../catalog/schema";
import { CATALOG_VERSION } from "../catalog/version";
import { EFFECTS } from "../effects";
import { createTableStore, nextRoundSteps, type EngineStep, type ReduceContext, type ScenarioState, type TableStore } from "../play/store";
import { campaignOf, scenarioOf } from "./campaign-data";
import { readSaveChecked, writeSave } from "./campaign-store";

type Db<TRun> = BaseSQLiteDatabase<"sync", TRun>;

export type CardFacts = { imagesrc: string | null; text: string | null };

export type TableSession =
  | { ok: true; save: Save; world: World; ctx: ReduceContext; game: ScenarioState; roundSteps: readonly EngineStep[]; facts: ReadonlyMap<string, CardFacts> }
  | { ok: false; reason: "missing" | "none" | "dropped"; save: Save | null };

/** The codes the open scenario can show: the log's cards, the Ring-bearer and every card of each dealt deck. */
export function loadoutCodes(save: Save): string[] {
  const loadout = save.loadout;
  if (!loadout) return logCodes(save.log);
  return [...logCodes(save.log), ...(loadout.ringBearer ? [loadout.ringBearer] : []), ...loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck])];
}

function factsOf<TRun>(catalog: Db<TRun>, codes: Iterable<string>): Map<string, CardFacts> {
  const wanted = [...new Set(codes)];
  if (wanted.length === 0) return new Map();
  const rows = catalog.select({ code: cards.code, imagesrc: cards.imagesrc, text: cards.text }).from(cards).where(inArray(cards.code, wanted)).all();
  return new Map(rows.map((row) => [row.code, { imagesrc: row.imagesrc, text: row.text }]));
}

export function openTable<TCatalog, TUser>(catalog: Db<TCatalog>, user: Db<TUser>, saveId: string): TableSession {
  const read = readSaveChecked(user, saveId);
  if (!read) return { ok: false, reason: "missing", save: null };
  let save = read.save;
  if (read.unreadable) writeSave(user, save);
  if (!save.active || !save.loadout) return { ok: false, reason: read.unreadable ? "dropped" : "none", save };
  const campaign = campaignOf(save.campaignId);
  const scenario = scenarioOf(save.loadout.scenarioId);
  if (!campaign || !scenario || staleReason(save.active, CATALOG_VERSION)) {
    save = drop(save);
    writeSave(user, save);
    return { ok: false, reason: "dropped", save };
  }
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, loadoutCodes(save));
  let roundSteps: readonly EngineStep[] = [];
  const resumed = resume(save, world, CATALOG_VERSION, (before, after, steps) => {
    roundSteps = nextRoundSteps(roundSteps, before, after, steps);
  });
  if (!resumed.ok) {
    // The reducer refused a stored intent, or the start no longer builds: drop the open scenario and keep the log.
    save = drop(save);
    writeSave(user, save);
    return { ok: false, reason: "dropped", save };
  }
  return { ok: true, save, world, ctx: contextOf(world), game: resumed.state, roundSteps, facts: factsOf(catalog, world.cards.keys()) };
}

export type SessionStore = { store: TableStore; save: () => Save };

/**
 * The table store for an opened session. Each intent the reducer accepts is appended to the save and written at once, so a
 * kill and relaunch replays the same game. `save` is the save as last written.
 */
export function sessionStore<TRun>(session: Extract<TableSession, { ok: true }>, user: Db<TRun>): SessionStore {
  let saved: Save = session.save;
  const store = createTableStore({
    ctx: session.ctx,
    game: session.game,
    roundSteps: session.roundSteps,
    onCommit: (intent) => {
      saved = record(saved, intent);
      writeSave(user, saved);
    },
  });
  return { store, save: () => saved };
}
