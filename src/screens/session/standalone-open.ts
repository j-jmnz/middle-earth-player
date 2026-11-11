// Opens a standalone game for the table and the outcome screen: reads the row, loads the cards from catalog.db, and replays the intents through the reducer (open-game.ts). No log, pool or checklist. A game already opened as it now stands is
// not replayed again (session/cache.ts). A game whose campaign or scenario is not in this build is left as it is and reads as not open. Pure of React: the hooks that open it for a screen are in standalone-session.ts.
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { staleChanges } from "../../campaign/changes";
import { needsChoiceBeforeOpen } from "../../campaign/replay";
import { continueStandalone, restartStandalone, resumeStandalone, type StandaloneGame } from "../../campaign/standalone";
import { dealtCodes, loadWorld, type World } from "../../campaign/world";
import { CATALOG_VERSION } from "../../catalog/version";
import { EFFECTS } from "../../effects";

import { campaignOf, scenarioOf } from "../data/campaign-data";
import { replayForTable, type ReplayedGame } from "./open-game";
import type { PlayClock } from "./play-clock";
import { fingerprintOf, sessionCacheOf } from "./cache";
import { readStandalone, readStandaloneCheckpoint, writeStandaloneActive, writeStandaloneCheckpoint, writeStandaloneReplaced, writeStandaloneUndone } from "../data/standalone-store";
import { dealSeed } from "../nav/e2e";
import { gameStore } from "./game-store";
import { continueChoice, gameWorld, restartChoice, staleFields } from "./stale-game";
import type { StaleChoice } from "./stale-words";
import type { TableStore } from "../../play/store/store";

type Db<TRun> = BaseSQLiteDatabase<"sync", TRun>;

export type StandaloneSession =
  // `stamp` is the game to write once when the open left it different from its row (table-open.ts, TableSession). `takenBack` on a stale result is how many moves Continue would take back, when a checked replay found one that does not match; `fromCheckpoint` says Continue will rebase onto the game's checkpoint instead; `changes` is what changed under the game, for the sheet.
  | ({ ok: true; stored: StandaloneGame; stamp: StandaloneGame | null } & ReplayedGame)
  | { ok: false; reason: "missing" | "none" | "dropped" | "stale"; stored: StandaloneGame | null; write: StandaloneGame | null; takenBack?: number | null; fromCheckpoint?: boolean; changes?: readonly string[] };

/** The codes the game can show: the Ring-bearer and every card of each dealt deck. */
export function standaloneCodes(game: StandaloneGame): string[] {
  return dealtCodes(game.loadout);
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
  if (!campaign || !scenario) return { ok: false, reason: "none", stored, write: null };
  const { active } = stored;
  // Without a world: the engine version, and the catalog version of a game that has no world stamp yet. One of another engine version
  // without checks to compare has nothing to replay: the player chooses, without loading the world.
  if (needsChoiceBeforeOpen(active, active.intents.length, active.checks?.length ?? null)) return { ok: false, reason: "stale", stored, write: null, takenBack: null, changes: staleChanges(active, stored.scenarioId, null) };
  const cache = sessionCacheOf<Opened>(user, "standalone");
  const kept = cache.get(stored.id, fingerprintOf(stored, CATALOG_VERSION));
  if (kept) return kept;
  const world = loadWorld(catalog, campaign, scenario, EFFECTS, standaloneCodes(stored));
  const replayed = replayForTable(catalog, world, (observe) => resumeStandalone(stored, world, observe));
  if (!replayed.ok) return { ok: false, reason: "stale", stored, write: null, ...staleFields(active, stored.scenarioId, world, standaloneCodes(stored), replayed.at, readStandaloneCheckpoint(user, stored.id), stored.seatCount) };
  const stamped: StandaloneGame = replayed.stamp ? { ...stored, active: replayed.stamp } : stored;
  const opened: Opened = { ok: true, stored: stamped, stamp: null, ...replayed.game };
  cache.set(stored.id, fingerprintOf(stamped, CATALOG_VERSION), opened);
  return stamped === stored ? opened : { ...opened, stamp: stamped };
}

function worldOf<TCatalog>(catalog: Db<TCatalog>, game: StandaloneGame): World | null {
  return gameWorld(catalog, game.campaignId, game.scenarioId, standaloneCodes(game));
}

/** Continue (the stale sheet): rebases the game onto its checkpoint when that passes the check, otherwise replays it on the new rules as far as its intents are accepted; writes the result, restamped, with the checkpoint cleared. */
export function continueStandaloneGame<TCatalog, TUser>(catalog: Db<TCatalog>, user: Db<TUser>, gameId: string): StaleChoice {
  const game = readStandalone(user, gameId)?.game ?? null;
  return continueChoice(game, game ? worldOf(catalog, game) : null, (held, world) => continueStandalone(held, world, readStandaloneCheckpoint(user, gameId)), (held) => writeStandaloneReplaced(user, held));
}

/** Restart (the stale sheet): deals the game again with its stored loadout, a new seed and a new start time; the row and its loadout stay. */
export function restartStandaloneGame<TCatalog, TUser>(catalog: Db<TCatalog>, user: Db<TUser>, gameId: string): StaleChoice {
  const game = readStandalone(user, gameId)?.game ?? null;
  const deal = (held: StandaloneGame, world: World) => {
    const dealt = restartStandalone(held, world, dealSeed(), Date.now());
    return dealt.ok ? { ok: true as const, holder: dealt.game } : { ok: false as const, problems: dealt.briefing?.problems ?? null };
  };
  return restartChoice(game, game ? worldOf(catalog, game) : null, deal, (held) => writeStandaloneReplaced(user, held));
}

export type StandaloneTable = { store: TableStore; clock: PlayClock };

/**
 * The table store for an opened game (game-store.ts). Each intent the reducer accepts is appended and written at once; Undo takes it off. `clock`
 * counts the foreground time as the session store's does (table-open.ts): folded into each write, and written once on a pause.
 */
export function standaloneStore<TRun>(session: Opened, user: Db<TRun>): StandaloneTable {
  const { store, clock } = gameStore<StandaloneGame, Opened>({
    session,
    initial: session.stored,
    cache: sessionCacheOf<Opened>(user, "standalone"),
    // The open's stamp is written already (table-open.ts, sessionStore).
    reopened: (stored, now) => ({ ...session, stamp: null, stored, ...now }),
    writers: { active: (game) => writeStandaloneActive(user, game), undone: (game) => writeStandaloneUndone(user, game), checkpoint: (id, checkpoint) => writeStandaloneCheckpoint(user, id, checkpoint) },
  });
  return { store, clock };
}
