import { asc, eq, sql } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import { backfillRuns, type KnownGame, type KnownSave, type RunRecord } from "../campaign/runs";
import { parseLog, parseSeatCount } from "../campaign/save";
import { parseStandaloneLoadout, parseStandaloneResult } from "../campaign/standalone";
import { runs, saves, settings, standaloneGames } from "./user-schema";

// user.db `runs`: written when a scenario ends, read by History. The rules stay in src/campaign/runs.ts.
type UserDb<TRun> = BaseSQLiteDatabase<"sync", TRun>;

const BACKFILL_KEY = "runs-backfill";

/** Writes the run once. A run is never rewritten: a second write with the same id changes nothing. */
export function writeRun<TRun>(user: UserDb<TRun>, run: RunRecord): void {
  user.insert(runs).values(run).onConflictDoNothing().run();
}

/** Every run in the order it was written; History sorts and filters them (history-list.ts). */
export function listRuns<TRun>(user: UserDb<TRun>): RunRecord[] {
  return user
    .select()
    .from(runs)
    .orderBy(asc(sql`rowid`))
    .all()
    .map((row) => ({ ...row, seatCount: parseSeatCount(row.seatCount) }));
}

/** The ids of the saves and the standalone games that still exist: a run whose id is not here says it was deleted. */
export function existingRefs<TRun>(user: UserDb<TRun>): { saves: ReadonlySet<string>; archived: ReadonlySet<string>; games: ReadonlySet<string> } {
  const rows = user.select({ id: saves.id, archivedAt: saves.archivedAt }).from(saves).all();
  return {
    saves: new Set(rows.map((row) => row.id)),
    // A playthrough put away: its runs stay listed.
    archived: new Set(rows.filter((row) => row.archivedAt != null).map((row) => row.id)),
    games: new Set(user.select({ id: standaloneGames.id }).from(standaloneGames).all().map((row) => row.id)),
  };
}

function knownSaves<TRun>(user: UserDb<TRun>): KnownSave[] {
  return user
    .select()
    .from(saves)
    .orderBy(asc(sql`rowid`))
    .all()
    .flatMap((row) => {
      try {
        return [{ id: row.id, campaignId: row.campaignId, seatCount: parseSeatCount(row.seatCount), log: parseLog(row.log) }];
      } catch {
        // A log that does not read has nothing to back-fill; the playthrough reports it where it opens.
        return [];
      }
    });
}

function knownGames<TRun>(user: UserDb<TRun>): KnownGame[] {
  return user
    .select()
    .from(standaloneGames)
    .orderBy(asc(standaloneGames.createdAt))
    .all()
    .map((row) => ({
      id: row.id,
      campaignId: row.campaignId,
      scenarioId: row.scenarioId,
      seatCount: parseSeatCount(row.seatCount),
      seats: parseStandaloneLoadout(row.loadout)?.seats.map((seat) => seat.heroes) ?? [],
      result: parseStandaloneResult(row.result),
      createdAt: row.createdAt,
    }));
}

/**
 * Writes the runs the store already knows, once (a `settings` mark records it): each won scenario on every save's log and each
 * standalone game with a result, archived ones included. A run already written for the same win is left alone. Returns how
 * many rows it wrote. It runs when the databases open, after the migration that made the table.
 */
export function backfillRunTable<TRun>(user: UserDb<TRun>, boxOf: (scenarioId: string) => string | null): number {
  if (user.select({ key: settings.key }).from(settings).where(eq(settings.key, BACKFILL_KEY)).get()) return 0;
  const have = new Set(listRuns(user).map((run) => `${run.kind}:${run.refId}:${run.scenarioId}:${run.result}`));
  let written = 0;
  for (const run of backfillRuns(knownSaves(user), knownGames(user), boxOf)) {
    // A campaign win can only be there already if it was written live; a standalone game has one run.
    if (have.has(`${run.kind}:${run.refId}:${run.scenarioId}:${run.result}`)) continue;
    writeRun(user, run);
    written += 1;
  }
  user.insert(settings).values({ key: BACKFILL_KEY, value: true }).onConflictDoNothing().run();
  return written;
}
